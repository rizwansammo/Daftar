from rest_framework import permissions, viewsets

from .models import Boilerplate
from .serializers import BoilerplateSerializer


class BoilerplateViewSet(viewsets.ModelViewSet):
    serializer_class = BoilerplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    search_fields = ["title", "content", "client__name"]
    filterset_fields = ["is_checked", "client"]
    ordering_fields = ["title", "created_at", "updated_at"]
    pagination_ordering = "title"

    def get_queryset(self):
        queryset = Boilerplate.objects.filter(user=self.request.user).select_related("client")
        client_id = self.request.query_params.get("client_id")
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
