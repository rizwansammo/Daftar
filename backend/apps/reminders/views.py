from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Reminder
from .serializers import ReminderSerializer


class ReminderViewSet(viewsets.ModelViewSet):
    serializer_class = ReminderSerializer
    permission_classes = [permissions.IsAuthenticated]

    filterset_fields = ["is_completed", "priority", "repeat_type"]
    ordering_fields = ["remind_at", "created_at", "priority"]
    pagination_ordering = "remind_at"

    def get_queryset(self):
        return Reminder.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        reminder = self.get_object()
        reminder.is_completed = True
        reminder.is_snoozed = False
        reminder.snoozed_until = None
        reminder.save(update_fields=["is_completed", "is_snoozed", "snoozed_until"])
        return Response(
            {"success": True, "data": ReminderSerializer(reminder).data, "message": "Completed", "errors": {}},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="snooze")
    def snooze(self, request, pk=None):
        reminder = self.get_object()
        minutes = int(request.data.get("minutes", 15))
        reminder.is_snoozed = True
        reminder.snoozed_until = timezone.now() + timezone.timedelta(minutes=minutes)
        reminder.save(update_fields=["is_snoozed", "snoozed_until"])
        return Response(
            {"success": True, "data": ReminderSerializer(reminder).data, "message": "Snoozed", "errors": {}},
            status=status.HTTP_200_OK,
        )
