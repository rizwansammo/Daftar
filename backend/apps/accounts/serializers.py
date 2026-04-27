from rest_framework import serializers

from .models import CustomUser


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = (
            "id",
            "email",
            "full_name",
            "avatar",
            "role",
            "timezone",
            "theme_preference",
            "is_active",
            "date_joined",
            "last_login",
            "color_tag",
        )
