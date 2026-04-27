from rest_framework import serializers

from apps.tickets.models import Client

from .models import Boilerplate


class BoilerplateClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ("id", "name")


class BoilerplateSerializer(serializers.ModelSerializer):
    client = BoilerplateClientSerializer(read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        source="client",
        queryset=Client.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Boilerplate
        fields = ("id", "title", "content", "is_checked", "client", "client_id", "created_at", "updated_at")

    def validate(self, attrs):
        if self.instance is None and attrs.get("client") is None:
            raise serializers.ValidationError({"client_id": "This field is required."})
        return attrs
