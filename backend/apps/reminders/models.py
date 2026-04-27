import uuid

from django.conf import settings
from django.db import models


class Reminder(models.Model):
    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    class RepeatType(models.TextChoices):
        NONE = "NONE", "None"
        DAILY = "DAILY", "Daily"
        WEEKLY = "WEEKLY", "Weekly"
        MONTHLY = "MONTHLY", "Monthly"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reminders")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    remind_at = models.DateTimeField()
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    is_completed = models.BooleanField(default=False)
    is_snoozed = models.BooleanField(default=False)
    snoozed_until = models.DateTimeField(null=True, blank=True)
    repeat_type = models.CharField(max_length=10, choices=RepeatType.choices, default=RepeatType.NONE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.title

    class Meta:
        ordering = ["is_completed", "remind_at"]
