from rest_framework import serializers

from apps.accounts.serializers import MeSerializer

from .models import ShiftAssignment


class ShiftAssignmentSerializer(serializers.ModelSerializer):
    agent = MeSerializer(read_only=True)
    agent_id = serializers.UUIDField(write_only=True)

    created_by = MeSerializer(read_only=True)

    class Meta:
        model = ShiftAssignment
        fields = (
            "id",
            "agent",
            "agent_id",
            "date",
            "shift_type",
            "start_time",
            "end_time",
            "note",
            "created_by",
            "created_at",
        )
        read_only_fields = ("created_by", "created_at")

    def create(self, validated_data):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        agent_id = validated_data.pop("agent_id")
        validated_data["agent"] = User.objects.get(id=agent_id)
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        agent_id = validated_data.pop("agent_id", None)
        if agent_id is not None:
            instance.agent = User.objects.get(id=agent_id)
        return super().update(instance, validated_data)
