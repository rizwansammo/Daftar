from rest_framework import serializers

from .models import CustomUser


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = (
            "id",
            "email",
            "display_name",
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


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = (
            "id",
            "email",
            "display_name",
            "full_name",
            "role",
            "is_active",
            "date_joined",
            "last_login",
            "color_tag",
        )


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    display_name = serializers.CharField(required=True, allow_blank=False, max_length=255)

    class Meta:
        model = CustomUser
        fields = (
            "email",
            "display_name",
            "full_name",
            "role",
            "password",
            "timezone",
            "theme_preference",
        )

    def validate_email(self, value):
        email = value.strip().lower()
        if CustomUser.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("This email is already in use.")
        return email

    def validate_display_name(self, value):
        display_name = (value or "").strip()
        if not display_name:
            raise serializers.ValidationError("Display name is required.")
        return display_name

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = CustomUser(**validated_data)
        user.email = user.email.strip().lower()
        user.display_name = (user.display_name or "").strip()
        user.full_name = (user.full_name or "").strip()
        user.username = (user.display_name or user.full_name or user.email)[:150]
        user.set_password(password)
        user.save()
        return user


class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = (
            "email",
            "full_name",
            "display_name",
            "timezone",
            "theme_preference",
        )

    def validate_email(self, value):
        email = value.strip().lower()
        user_id = getattr(self.instance, "id", None)
        if CustomUser.objects.exclude(id=user_id).filter(email__iexact=email).exists():
            raise serializers.ValidationError("This email is already in use.")
        return email

    def validate_display_name(self, value):
        display_name = (value or "").strip()
        if not display_name:
            raise serializers.ValidationError("Display name is required.")
        return display_name

    def update(self, instance, validated_data):
        for key, value in validated_data.items():
            if isinstance(value, str):
                value = value.strip()
            setattr(instance, key, value)

        instance.username = (instance.display_name or instance.full_name or instance.email)[:150]
        instance.save()
        return instance


class ResetPasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=False, allow_blank=False, trim_whitespace=False)
    new_password = serializers.CharField(required=True, min_length=8, trim_whitespace=False)
