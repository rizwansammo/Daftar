from rest_framework import permissions, viewsets

from .models import ShiftAssignment
from .serializers import ShiftAssignmentSerializer


class ShiftAssignmentViewSet(viewsets.ModelViewSet):
    queryset = ShiftAssignment.objects.select_related("agent", "created_by").all()
    serializer_class = ShiftAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    filterset_fields = ["date", "shift_type", "agent_id"]
    ordering_fields = ["date", "created_at"]
    pagination_ordering = "-date"
