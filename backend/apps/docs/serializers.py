from rest_framework import serializers

from apps.accounts.serializers import MeSerializer
from apps.core.models import Tag

from .models import Document, DocumentCategory, DocumentVersion


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("id", "name", "color")


class DocumentCategorySerializer(serializers.ModelSerializer):
    created_by = MeSerializer(read_only=True)

    class Meta:
        model = DocumentCategory
        fields = ("id", "name", "color", "icon", "created_by", "created_at")
        read_only_fields = ("created_by", "created_at")


class DocumentSerializer(serializers.ModelSerializer):
    client_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    category = DocumentCategorySerializer(read_only=True)
    category_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    author = MeSerializer(read_only=True)
    last_edited_by = MeSerializer(read_only=True)

    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(child=serializers.UUIDField(), write_only=True, required=False)

    class Meta:
        model = Document
        fields = (
            "id",
            "title",
            "client",
            "client_id",
            "content",
            "content_text",
            "category",
            "category_id",
            "author",
            "tags",
            "tag_ids",
            "is_published",
            "created_at",
            "updated_at",
            "last_edited_by",
        )
        read_only_fields = ("author", "created_at", "updated_at", "last_edited_by")

    def create(self, validated_data):
        client_id = validated_data.pop("client_id", None)
        category_id = validated_data.pop("category_id", None)
        tag_ids = validated_data.pop("tag_ids", [])

        if client_id is not None:
            validated_data["client_id"] = client_id

        if category_id:
            validated_data["category"] = DocumentCategory.objects.get(id=category_id)

        validated_data["author"] = self.context["request"].user
        validated_data["last_edited_by"] = self.context["request"].user

        doc = super().create(validated_data)
        if tag_ids:
            doc.tags.set(Tag.objects.filter(id__in=tag_ids))
        return doc

    def update(self, instance, validated_data):
        client_id = validated_data.pop("client_id", None)
        category_id = validated_data.pop("category_id", None)
        tag_ids = validated_data.pop("tag_ids", None)

        if client_id is not None:
            instance.client_id = client_id

        if category_id is not None:
            instance.category = DocumentCategory.objects.get(id=category_id) if category_id else None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.last_edited_by = self.context["request"].user
        instance.save()

        if tag_ids is not None:
            instance.tags.set(Tag.objects.filter(id__in=tag_ids))

        return instance


class DocumentVersionSerializer(serializers.ModelSerializer):
    saved_by = MeSerializer(read_only=True)

    class Meta:
        model = DocumentVersion
        fields = ("id", "document", "content", "saved_by", "saved_at", "version_number")
        read_only_fields = ("saved_by", "saved_at", "version_number")
