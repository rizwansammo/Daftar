from django.db.models import Max
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Document, DocumentCategory, DocumentVersion
from .serializers import (
    DocumentCategorySerializer,
    DocumentSerializer,
    DocumentVersionSerializer,
)


class DocumentCategoryViewSet(viewsets.ModelViewSet):
    queryset = DocumentCategory.objects.select_related("created_by").all()
    serializer_class = DocumentCategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]
    pagination_ordering = "name"

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class DocumentViewSet(viewsets.ModelViewSet):
    queryset = (
        Document.objects.select_related("category", "author", "last_edited_by")
        .prefetch_related("tags")
        .all()
    )
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    search_fields = ["title", "content_text"]
    filterset_fields = ["client_id", "category_id", "is_published"]
    ordering_fields = ["updated_at", "created_at", "title"]
    pagination_ordering = "-updated_at"

    @action(detail=True, methods=["post"], url_path="versions")
    def create_version(self, request, pk=None):
        doc = self.get_object()
        next_version = (doc.versions.aggregate(v=Max("version_number")).get("v") or 0) + 1

        version = DocumentVersion.objects.create(
            document=doc,
            content=doc.content,
            saved_by=request.user,
            version_number=next_version,
        )

        return Response(
            {"success": True, "data": DocumentVersionSerializer(version).data, "message": "Saved", "errors": {}},
            status=status.HTTP_201_CREATED,
        )


class DocumentVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DocumentVersion.objects.select_related("document", "saved_by").all()
    serializer_class = DocumentVersionSerializer
    permission_classes = [permissions.IsAuthenticated]

    filterset_fields = ["document_id"]
    ordering_fields = ["saved_at", "version_number"]
    pagination_ordering = "-saved_at"
