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
    queryset = DocumentCategory.objects.select_related("created_by", "parent", "client").all()
    serializer_class = DocumentCategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]
    pagination_ordering = "name"

    def get_queryset(self):
        queryset = super().get_queryset()

        client_id = self.request.query_params.get("client_id")
        if client_id:
            queryset = queryset.filter(client_id=client_id)

        if "parent_id" in self.request.query_params:
            parent_id = (self.request.query_params.get("parent_id") or "").strip()
            if not parent_id or parent_id.lower() == "null":
                queryset = queryset.filter(parent__isnull=True)
            else:
                queryset = queryset.filter(parent_id=parent_id)

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"], url_path="path")
    def path(self, request, pk=None):
        folder = self.get_object()
        path_items = []
        cursor = folder
        while cursor:
            path_items.append({"id": str(cursor.id), "name": cursor.name})
            cursor = cursor.parent

        path_items.reverse()
        return Response(path_items, status=status.HTTP_200_OK)


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

    def get_queryset(self):
        queryset = super().get_queryset()

        if "folder_id" in self.request.query_params:
            folder_id = (self.request.query_params.get("folder_id") or "").strip()
            if not folder_id or folder_id.lower() == "null":
                queryset = queryset.filter(category__isnull=True)
            else:
                queryset = queryset.filter(category_id=folder_id)

        return queryset

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
