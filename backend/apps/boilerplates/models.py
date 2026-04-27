import uuid

from django.conf import settings
from django.db import models

from apps.tickets.models import Client


class Boilerplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="boilerplates")
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name="boilerplates")
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    is_checked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.title

    class Meta:
        ordering = ["title", "-updated_at"]
