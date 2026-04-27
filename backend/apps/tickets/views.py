from django.db.models import Count, Q, Sum
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .filters import TicketFilter
from .models import Client, Ticket, TicketNote, TimeEntry
from .serializers import (
    ClientSerializer,
    TicketNoteSerializer,
    TicketSerializer,
    TimeEntrySerializer,
)


class ClientViewSet(viewsets.ModelViewSet):
    queryset = (
        Client.objects.annotate(
            ticket_count=Count("tickets", distinct=True),
            doc_count=Count("documents", distinct=True),
            completed_ticket_count=Count(
                "tickets",
                filter=Q(tickets__status=Ticket.Status.COMPLETED),
                distinct=True,
            ),
            pending_ticket_count=Count(
                "tickets",
                filter=Q(tickets__status=Ticket.Status.PENDING),
                distinct=True,
            ),
            handed_over_ticket_count=Count(
                "tickets",
                filter=Q(tickets__status=Ticket.Status.ESCALATED),
                distinct=True,
            ),
            total_time_seconds=Sum("tickets__time_entries__duration_seconds"),
        )
        .order_by("name")
        .all()
    )
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["name", "contact_email"]
    pagination_ordering = "name"

    @action(detail=True, methods=["post"], url_path="delete")
    def delete_with_password(self, request, pk=None):
        password = request.data.get("password")
        if not isinstance(password, str) or not password.strip():
            return Response(
                {"success": False, "data": {}, "message": "Password required", "errors": {"password": "Required"}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        if not user.check_password(password):
            return Response(
                {"success": False, "data": {}, "message": "Invalid password", "errors": {"password": "Invalid"}},
                status=status.HTTP_403_FORBIDDEN,
            )

        client = self.get_object()
        try:
            client.delete()
        except ProtectedError:
            return Response(
                {
                    "success": False,
                    "data": {},
                    "message": "Client cannot be deleted while tickets exist",
                    "errors": {"detail": "Delete or move tickets first"},
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response({"success": True, "data": {}, "message": "Deleted", "errors": {}}, status=status.HTTP_200_OK)


class TicketViewSet(viewsets.ModelViewSet):
    queryset = (
        Ticket.objects.select_related("client", "assigned_agent", "created_by")
        .prefetch_related("tags")
        .all()
    )
    serializer_class = TicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    lookup_field = "ticket_number"
    lookup_url_kwarg = "ticket_number"
    lookup_value_regex = r"[^/]+"

    filterset_class = TicketFilter
    search_fields = ["ticket_number", "title"]
    ordering_fields = ["created_at", "updated_at", "priority", "status", "due_date"]
    pagination_ordering = "-created_at"

    def perform_update(self, serializer):
        prev_status = self.get_object().status
        instance = serializer.save()

        if prev_status != Ticket.Status.COMPLETED and instance.status == Ticket.Status.COMPLETED:
            instance.completed_at = timezone.now()
            instance.save(update_fields=["completed_at"])

        if prev_status == Ticket.Status.COMPLETED and instance.status != Ticket.Status.COMPLETED:
            instance.completed_at = None
            instance.save(update_fields=["completed_at"])

    @action(detail=False, methods=["delete"], url_path=r"by-id/(?P<ticket_id>[0-9a-f\-]{36})")
    def delete_by_id(self, request, ticket_id=None):
        ticket = self.get_queryset().filter(id=ticket_id).first()
        if not ticket:
            return Response(
                {"success": False, "data": {}, "message": "Not found", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        ticket.delete()
        return Response({"success": True, "data": {}, "message": "Deleted", "errors": {}}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path=r"by-id/(?P<ticket_id>[0-9a-f\-]{36})/notes")
    def add_note_by_id(self, request, ticket_id=None):
        ticket = self.get_queryset().filter(id=ticket_id).first()
        if not ticket:
            return Response(
                {"success": False, "data": {}, "message": "Not found", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TicketNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        note = TicketNote.objects.create(
            ticket=ticket,
            content=serializer.validated_data["content"],
            created_by=request.user,
        )

        return Response(
            {"success": True, "data": TicketNoteSerializer(note).data, "message": "Created", "errors": {}},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="notes")
    def add_note(self, request, pk=None):
        ticket = self.get_object()
        serializer = TicketNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        note = TicketNote.objects.create(
            ticket=ticket,
            content=serializer.validated_data["content"],
            created_by=request.user,
        )

        return Response(
            {"success": True, "data": TicketNoteSerializer(note).data, "message": "Created", "errors": {}},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="time/start")
    def start_timer(self, request, pk=None):
        ticket = self.get_object()

        running = TimeEntry.objects.filter(agent=request.user, ended_at__isnull=True).select_related("ticket").first()
        if running:
            running.ended_at = timezone.now()
            running.save(update_fields=["ended_at", "duration_seconds"])

        entry = TimeEntry.objects.create(
            ticket=ticket,
            agent=request.user,
            started_at=timezone.now(),
            ended_at=None,
            is_manual=False,
        )

        return Response(
            {"success": True, "data": TimeEntrySerializer(entry).data, "message": "Started", "errors": {}},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="time/stop")
    def stop_timer(self, request, pk=None):
        ticket = self.get_object()
        entry = TimeEntry.objects.filter(ticket=ticket, agent=request.user, ended_at__isnull=True).first()
        if not entry:
            return Response(
                {"success": False, "data": {}, "message": "No running timer", "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entry.ended_at = timezone.now()
        entry.save(update_fields=["ended_at", "duration_seconds"])

        return Response(
            {"success": True, "data": TimeEntrySerializer(entry).data, "message": "Stopped", "errors": {}},
            status=status.HTTP_200_OK,
        )


class TicketNoteViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    queryset = TicketNote.objects.select_related("ticket", "created_by").all()
    serializer_class = TicketNoteSerializer
    permission_classes = [permissions.IsAuthenticated]

    filterset_fields = ["ticket"]


class TimeEntryViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = TimeEntry.objects.select_related("ticket", "agent").all()
    serializer_class = TimeEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().filter(agent=self.request.user)
