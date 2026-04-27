import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        AGENT = "AGENT", "Agent"

    class ThemePreference(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"
        SYSTEM = "system", "System"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    username = models.CharField(max_length=150, blank=True)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    display_name = models.CharField(max_length=255, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.AGENT)
    timezone = models.CharField(max_length=64, default="UTC")
    theme_preference = models.CharField(
        max_length=10, choices=ThemePreference.choices, default=ThemePreference.SYSTEM
    )

    color_tag = models.CharField(max_length=16, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self) -> str:
        return self.email

    class Meta:
        ordering = ["-date_joined"]
