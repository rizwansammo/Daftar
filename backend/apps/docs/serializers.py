from rest_framework import serializers

from apps.accounts.serializers import MeSerializer
from apps.core.models import Tag
from apps.tickets.models import Client

from .models import Document, DocumentCategory, DocumentVersion


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("id", "name", "color")


class DocumentCategorySerializer(serializers.ModelSerializer):
    created_by = MeSerializer(read_only=True)
    client = serializers.UUIDField(source="client_id", read_only=True)
    parent = serializers.UUIDField(source="parent_id", read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        source="client",
        queryset=Client.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent",
        queryset=DocumentCategory.objects.select_related("parent", "client").all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = DocumentCategory
        fields = (
            "id",
            "name",
            "color",
            "icon",
            "client",
            "parent",
            "client_id",
            "parent_id",
            "created_by",
            "created_at",
        )
        read_only_fields = ("created_by", "created_at")

    def validate(self, attrs):
        parent = attrs.get("parent", self.instance.parent if self.instance else None)
        client = attrs.get("client", self.instance.client if self.instance else None)

        if parent and not client:
            attrs["client"] = parent.client
            client = parent.client

        if parent and client and parent.client_id and parent.client_id != client.id:
            raise serializers.ValidationError({"parent_id": "Parent folder belongs to a different client."})

        if self.instance and parent:
            cursor = parent
            while cursor:
                if cursor.id == self.instance.id:
                    raise serializers.ValidationError({"parent_id": "A folder cannot be nested inside itself."})
                cursor = cursor.parent

        return attrs


class DocumentSerializer(serializers.ModelSerializer):
    client_id = serializers.PrimaryKeyRelatedField(
        source="client",
        queryset=Client.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    category = DocumentCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=DocumentCategory.objects.select_related("client").all(),
        write_only=True,
        required=False,
        allow_null=True,
    )

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

    def validate(self, attrs):
        client = attrs.get("client", self.instance.client if self.instance else None)
        category = attrs.get("category", self.instance.category if self.instance else None)

        if category and category.client_id:
            if client and category.client_id != client.id:
                raise serializers.ValidationError({"category_id": "Selected folder belongs to a different client."})
            if client is None:
                attrs["client"] = category.client

        return attrs

    def create(self, validated_data):
        tag_ids = validated_data.pop("tag_ids", [])

        validated_data["author"] = self.context["request"].user
        validated_data["last_edited_by"] = self.context["request"].user

        doc = super().create(validated_data)
        if tag_ids:
            doc.tags.set(Tag.objects.filter(id__in=tag_ids))
        return doc

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)

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
