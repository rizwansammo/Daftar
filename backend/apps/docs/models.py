import uuid

from django.conf import settings
from django.db import models

from apps.core.models import Tag
from apps.tickets.models import Client


class DocumentCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    color = models.CharField(max_length=32, blank=True)
    icon = models.CharField(max_length=64, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_doc_categories"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name

    class Meta:
        ordering = ["name"]


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, null=True, blank=True, related_name="documents")
    content = models.JSONField(default=dict)
    content_text = models.TextField(blank=True)
    category = models.ForeignKey(
        DocumentCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="documents"
    )
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="documents")
    tags = models.ManyToManyField(Tag, blank=True, related_name="documents")
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="edited_documents"
    )

    def __str__(self) -> str:
        return self.title

    class Meta:
        ordering = ["-updated_at"]


class DocumentVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="versions")
    content = models.JSONField(default=dict)
    saved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="saved_doc_versions"
    )
    saved_at = models.DateTimeField(auto_now_add=True)
    version_number = models.PositiveIntegerField()

    def __str__(self) -> str:
        return f"{self.document_id} v{self.version_number}"

    class Meta:
        ordering = ["-saved_at"]
        unique_together = ("document", "version_number")
