from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    ordering = ("email",)
    list_display = ("email", "display_name", "full_name", "role", "is_active", "last_login")
    search_fields = ("email", "display_name", "full_name")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Profile",
            {
                "fields": (
                    "display_name",
                    "full_name",
                    "avatar",
                    "role",
                    "timezone",
                    "theme_preference",
                    "color_tag",
                )
            },
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "display_name",
                    "full_name",
                    "role",
                    "password1",
                    "password2",
                ),
            },
        ),
    )

# Register your models here.
