import uuid

from django.conf import settings
from django.db import models


class ShiftAssignment(models.Model):
    class ShiftType(models.TextChoices):
        MORNING = "MORNING", "Morning"
        AFTERNOON = "AFTERNOON", "Afternoon"
        FULL_DAY = "FULL_DAY", "Full Day"
        CUSTOM = "CUSTOM", "Custom"
        OFF = "OFF", "Off"
        WFH = "WFH", "WFH"
        REMOTE = "REMOTE", "Remote"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shift_assignments")
    date = models.DateField()
    shift_type = models.CharField(max_length=20, choices=ShiftType.choices)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_shifts"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.agent_id} {self.date} {self.shift_type}"

    class Meta:
        ordering = ["-date", "agent_id"]
        unique_together = ("agent", "date")
