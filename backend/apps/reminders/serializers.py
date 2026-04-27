from rest_framework import serializers

from apps.accounts.serializers import MeSerializer

from .models import Reminder


class ReminderSerializer(serializers.ModelSerializer):
    user = MeSerializer(read_only=True)

    class Meta:
        model = Reminder
        fields = (
            "id",
            "user",
            "title",
            "description",
            "remind_at",
            "priority",
            "is_completed",
            "is_snoozed",
            "snoozed_until",
            "repeat_type",
            "created_at",
        )
        read_only_fields = ("user", "created_at")
