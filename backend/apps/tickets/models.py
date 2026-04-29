import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import Tag


class Client(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    color_tag = models.CharField(max_length=16, blank=True)
    contact_email = models.EmailField(blank=True)
    notes = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name

    class Meta:
        ordering = ["name"]


class Ticket(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        PENDING = "PENDING", "Pending"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED = "COMPLETED", "Completed"
        ESCALATED = "ESCALATED", "Escalated"
        CANCELLED = "CANCELLED", "Cancelled"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        NORMAL = "NORMAL", "Normal"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_number = models.CharField(max_length=32)
    title = models.CharField(max_length=200)

    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="tickets")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.NORMAL)

    assigned_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_tickets"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_tickets"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)

    tags = models.ManyToManyField(Tag, blank=True, related_name="tickets")

    def __str__(self) -> str:
        return f"{self.ticket_number} - {self.title}"

    @property
    def ticket(self) -> str:
        ticket_number = (self.ticket_number or "").strip()
        title = (self.title or "").strip()
        if ticket_number and title:
            return f"{ticket_number} - {title}"
        return ticket_number or title

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["ticket_number"]),
            models.Index(fields=["status"]),
            models.Index(fields=["priority"]),
        ]

    @property
    def total_time_seconds(self) -> int:
        return int(self.time_entries.aggregate(total=models.Sum("duration_seconds")).get("total") or 0)


class TicketNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="notes")
    content = models.TextField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="ticket_notes")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Note for {self.ticket.ticket_number}"

    class Meta:
        ordering = ["created_at"]


class TimeEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="time_entries")
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="time_entries")

    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)
    note = models.CharField(max_length=255, blank=True)
    is_manual = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"{self.ticket.ticket_number} - {self.duration_seconds}s"

    class Meta:
        ordering = ["-started_at"]

    def save(self, *args, **kwargs):
        if self.ended_at and self.started_at:
            delta = self.ended_at - self.started_at
            self.duration_seconds = max(0, int(delta.total_seconds()))
        super().save(*args, **kwargs)

    @property
    def is_running(self) -> bool:
        return self.ended_at is None

    @property
    def live_duration_seconds(self) -> int:
        if self.ended_at:
            return self.duration_seconds
        return max(0, int((timezone.now() - self.started_at).total_seconds()))
