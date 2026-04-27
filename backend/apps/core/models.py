import uuid

from django.db import models


class Tag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=64, unique=True)
    color = models.CharField(max_length=32, blank=True)

    def __str__(self) -> str:
        return self.name

    class Meta:
        ordering = ["name"]
