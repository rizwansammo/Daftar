import csv
import io
import textwrap
from datetime import date as date_cls
from datetime import datetime, time as dt_time, timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.db.models.deletion import ProtectedError
from django.http import HttpResponse
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

STATUS_NORMALIZATION = {
    "OPEN": Ticket.Status.OPEN,
    "PENDING": Ticket.Status.PENDING,
    "IN_PROGRESS": Ticket.Status.IN_PROGRESS,
    "IN PROGRESS": Ticket.Status.IN_PROGRESS,
    "COMPLETED": Ticket.Status.COMPLETED,
    "ESCALATED": Ticket.Status.ESCALATED,
    "HANDED_OVER": Ticket.Status.ESCALATED,
    "HANDED OVER": Ticket.Status.ESCALATED,
    "CANCELLED": Ticket.Status.CANCELLED,
}

LEVEL_PRIORITY_MAP = {
    "L1": Ticket.Priority.LOW,
    "L2": Ticket.Priority.NORMAL,
    "L3": Ticket.Priority.HIGH,
}

PRIORITY_LEVEL_MAP = {
    Ticket.Priority.LOW: "L1",
    Ticket.Priority.NORMAL: "L2",
    Ticket.Priority.HIGH: "L3",
    Ticket.Priority.URGENT: "L3",
}


def _compose_ticket(ticket_number: str, title: str) -> str:
    number = (ticket_number or "").strip()
    subject = (title or "").strip()
    if number and subject:
        return f"{number} - {subject}"
    return number or subject


def _split_ticket(raw: str, strict: bool = False) -> tuple[str, str]:
    value = (raw or "").strip()
    if not value:
        if strict:
            raise ValueError("Ticket is required")
        return "", ""

    parts = value.split(" - ", 1)
    if len(parts) == 2:
        ticket_number = parts[0].strip()
        title = parts[1].strip()
        if ticket_number and title:
            return ticket_number, title

    if strict:
        raise ValueError("Ticket must be in format: TICKET_NUMBER - Subject")

    return value, ""


def _safe_name(value: str) -> str:
    text = "".join(ch if ch.isalnum() else "-" for ch in (value or "").strip().lower())
    text = "-".join(filter(None, text.split("-")))
    return text or "client"


def _agent_label(user) -> str:
    if not user:
        return "Unassigned"
    return user.display_name or user.full_name or user.email or "Unassigned"


def _format_worked(seconds) -> str:
    total = int(seconds or 0)
    hh = total // 3600
    mm = (total % 3600) // 60
    return f"{hh:02d}:{mm:02d}"


def _parse_worked_seconds(value: str) -> int:
    raw = (value or "").strip()
    if not raw:
        return 0

    if ":" in raw:
        parts = raw.split(":")
        if len(parts) != 2:
            raise ValueError("Worked must be HH:MM")
        hh = int(parts[0].strip())
        mm = int(parts[1].strip())
        if hh < 0 or mm < 0 or mm >= 60:
            raise ValueError("Worked must be HH:MM")
        return (hh * 3600) + (mm * 60)

    hours = float(raw)
    if hours < 0:
        raise ValueError("Worked must be a positive number")
    return int(hours * 3600)


def _parse_date(value: str) -> date_cls:
    raw = (value or "").strip()
    if not raw:
        raise ValueError("Date is required")

    for fmt in ("%Y-%m-%d", "%d %b %Y", "%d %B %Y", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unsupported date format: {raw}")


def _resolve_window(query_params):
    range_type = (query_params.get("range") or "day").strip().lower()
    tz = timezone.get_current_timezone()

    if range_type == "custom":
        start_date_raw = query_params.get("start_date")
        end_date_raw = query_params.get("end_date")
        if not start_date_raw or not end_date_raw:
            raise ValueError("start_date and end_date are required for custom range")

        start_date = _parse_date(start_date_raw)
        end_date = _parse_date(end_date_raw)
        if end_date < start_date:
            raise ValueError("end_date must be on or after start_date")
    else:
        reference_raw = query_params.get("date")
        if not reference_raw:
            raise ValueError("date is required")
        reference = _parse_date(reference_raw)

        if range_type == "week":
            start_date = reference - timedelta(days=reference.weekday())
            end_date = start_date + timedelta(days=6)
        elif range_type == "month":
            start_date = reference.replace(day=1)
            if start_date.month == 12:
                end_date = start_date.replace(year=start_date.year + 1, month=1) - timedelta(days=1)
            else:
                end_date = start_date.replace(month=start_date.month + 1) - timedelta(days=1)
        else:
            start_date = reference
            end_date = reference

    start_dt = timezone.make_aware(datetime.combine(start_date, dt_time.min), timezone=tz)
    end_dt_exclusive = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), dt_time.min), timezone=tz)
    return start_dt, end_dt_exclusive, start_date, end_date


def _latest_detail(ticket: Ticket) -> str:
    notes = list(ticket.notes.all())
    if not notes:
        return ""
    return (notes[-1].content or "").strip()


def _build_pdf_bytes(title: str, subtitle: str, rows: list[dict]) -> bytes:
    lines = [title, subtitle, ""]
    for idx, row in enumerate(rows, start=1):
        lines.append(f"{idx}. {row['ticket']}")
        lines.append(
            f"   Date: {row['date']}  |  Agent: {row['agent']}  |  Level: {row['level']}  |  Status: {row['status']}"
        )
        lines.append(f"   Worked: {row['worked']}")
        detail = row.get("detail") or "-"
        wrapped = textwrap.wrap(detail, width=110) or ["-"]
        lines.append(f"   Detail: {wrapped[0]}")
        for continuation in wrapped[1:]:
            lines.append(f"           {continuation}")
        lines.append("")

    def escape_pdf_text(value: str) -> str:
        return (
            value.replace("\\", "\\\\")
            .replace("(", "\\(")
            .replace(")", "\\)")
        )

    page_max_lines = 48
    chunks = [lines[i : i + page_max_lines] for i in range(0, len(lines), page_max_lines)] or [[]]

    objects = []
    page_object_numbers = []
    next_object_number = 4

    for chunk in chunks:
        page_object_number = next_object_number
        content_object_number = next_object_number + 1
        next_object_number += 2

        content_lines = [
            "BT",
            "/F1 11 Tf",
            "50 800 Td",
            "14 TL",
        ]
        for line in chunk:
            content_lines.append(f"({escape_pdf_text(line)}) Tj")
            content_lines.append("T*")
        content_lines.append("ET")

        stream_text = "\n".join(content_lines) + "\n"
        stream_bytes = stream_text.encode("latin-1", errors="replace")

        page_obj = (
            f"{page_object_number} 0 obj\n"
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content_object_number} 0 R >>\n"
            "endobj\n"
        ).encode("latin-1")

        content_obj_head = (
            f"{content_object_number} 0 obj\n"
            f"<< /Length {len(stream_bytes)} >>\n"
            "stream\n"
        ).encode("latin-1")
        content_obj_tail = b"endstream\nendobj\n"

        objects.append(page_obj)
        objects.append(content_obj_head + stream_bytes + content_obj_tail)
        page_object_numbers.append(page_object_number)

    kids = " ".join(f"{obj_num} 0 R" for obj_num in page_object_numbers)

    catalog_obj = b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    pages_obj = (
        f"2 0 obj\n<< /Type /Pages /Kids [{kids}] /Count {len(page_object_numbers)} >>\nendobj\n"
    ).encode("latin-1")
    font_obj = b"3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"

    all_objects = [catalog_obj, pages_obj, font_obj, *objects]

    buffer = io.BytesIO()
    buffer.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    offsets = [0]
    for obj in all_objects:
        offsets.append(buffer.tell())
        buffer.write(obj)

    xref_start = buffer.tell()
    buffer.write(f"xref\n0 {len(offsets)}\n".encode("latin-1"))
    buffer.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        buffer.write(f"{off:010d} 00000 n \n".encode("latin-1"))

    buffer.write(
        (
            "trailer\n"
            f"<< /Size {len(offsets)} /Root 1 0 R >>\n"
            "startxref\n"
            f"{xref_start}\n"
            "%%EOF\n"
        ).encode("latin-1")
    )
    return buffer.getvalue()


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["name", "contact_email"]
    pagination_ordering = "name"

    def get_queryset(self):
        archived_actions = {"restore_client", "purge_client_with_password"}
        if getattr(self, "action", "") in archived_actions:
            show_archived = True
        else:
            show_archived = (self.request.query_params.get("archived") or "").strip().lower() in {
                "1",
                "true",
                "yes",
            }

        return (
            Client.objects.annotate(
                ticket_count=Count("tickets", distinct=True),
                doc_count=Count("documents", distinct=True),
                boilerplate_count=Count(
                    "boilerplates",
                    filter=Q(boilerplates__user=self.request.user),
                    distinct=True,
                ),
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
            .filter(is_archived=show_archived)
            .order_by("name")
            .all()
        )

    def _require_manager(self, request):
        if getattr(request.user, "role", None) != "ADMIN":
            return Response(
                {
                    "success": False,
                    "data": {},
                    "message": "Only managers can manage client archives",
                    "errors": {"detail": "Manager role required"},
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    @action(detail=True, methods=["post"], url_path="archive")
    def archive_client(self, request, pk=None):
        denied = self._require_manager(request)
        if denied:
            return denied

        client = self.get_object()
        if client.is_archived:
            return Response({"success": True, "data": {}, "message": "Already archived", "errors": {}}, status=status.HTTP_200_OK)

        client.is_archived = True
        client.save(update_fields=["is_archived"])
        return Response({"success": True, "data": {}, "message": "Archived", "errors": {}}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore_client(self, request, pk=None):
        denied = self._require_manager(request)
        if denied:
            return denied

        client = self.get_object()
        if not client.is_archived:
            return Response({"success": True, "data": {}, "message": "Already active", "errors": {}}, status=status.HTTP_200_OK)

        client.is_archived = False
        client.save(update_fields=["is_archived"])
        return Response({"success": True, "data": {}, "message": "Restored", "errors": {}}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="purge")
    def purge_client_with_password(self, request, pk=None):
        denied = self._require_manager(request)
        if denied:
            return denied

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
        if not client.is_archived:
            return Response(
                {
                    "success": False,
                    "data": {},
                    "message": "Client must be archived before permanent deletion",
                    "errors": {"detail": "Archive the client first"},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            client.delete()
        except ProtectedError:
            return Response(
                {
                    "success": False,
                    "data": {},
                    "message": "Client cannot be deleted while tickets/docs exist",
                    "errors": {"detail": "Delete or move tickets/docs first"},
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response({"success": True, "data": {}, "message": "Deleted", "errors": {}}, status=status.HTTP_200_OK)

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

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete_with_password(self, request):
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

        client_ids = request.data.get("client_ids")
        if not isinstance(client_ids, list) or not client_ids:
            return Response(
                {
                    "success": False,
                    "data": {},
                    "message": "client_ids required",
                    "errors": {"client_ids": "Provide a non-empty list of client IDs"},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        protected_ids: list[str] = []
        not_found_ids: list[str] = []
        deleted_count = 0

        for client_id in client_ids:
            if not isinstance(client_id, str) or not client_id.strip():
                continue
            client = Client.objects.filter(id=client_id).first()
            if not client:
                not_found_ids.append(client_id)
                continue

            try:
                client.delete()
                deleted_count += 1
            except ProtectedError:
                protected_ids.append(client_id)

        if protected_ids:
            return Response(
                {
                    "success": False,
                    "data": {"deleted_count": deleted_count},
                    "message": "Some clients could not be deleted",
                    "errors": {
                        "protected_ids": protected_ids,
                        "not_found_ids": not_found_ids,
                        "detail": "Delete or move tickets first",
                    },
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            {
                "success": True,
                "data": {"deleted_count": deleted_count, "not_found_ids": not_found_ids},
                "message": "Deleted",
                "errors": {},
            },
            status=status.HTTP_200_OK,
        )


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

    @action(detail=False, methods=["get"], url_path="tools/export", url_name="tools-export")
    def export_tickets(self, request):
        client_id = (request.query_params.get("client_id") or "").strip()
        export_format = (request.query_params.get("file_type") or "csv").strip().lower()

        if not client_id:
            return Response(
                {"success": False, "data": {}, "message": "client_id is required", "errors": {"client_id": "Required"}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client = Client.objects.filter(id=client_id).first()
        if not client:
            return Response(
                {"success": False, "data": {}, "message": "Client not found", "errors": {"client_id": "Invalid"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if export_format not in {"csv", "pdf"}:
            return Response(
                {
                    "success": False,
                    "data": {},
                    "message": "file_type must be csv or pdf",
                    "errors": {"file_type": "Invalid"},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            start_dt, end_dt_exclusive, start_date, end_date = _resolve_window(request.query_params)
        except ValueError as exc:
            return Response(
                {"success": False, "data": {}, "message": str(exc), "errors": {"date": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tickets = (
            Ticket.objects.filter(client=client, created_at__gte=start_dt, created_at__lt=end_dt_exclusive)
            .select_related("client", "assigned_agent", "created_by")
            .prefetch_related("notes")
            .annotate(total_seconds=Sum("time_entries__duration_seconds"))
            .order_by("created_at", "ticket_number")
        )

        rows = []
        for ticket in tickets:
            rows.append(
                {
                    "date": timezone.localtime(ticket.created_at).strftime("%Y-%m-%d"),
                    "ticket": _compose_ticket(ticket.ticket_number, ticket.title),
                    "agent": _agent_label(ticket.assigned_agent),
                    "level": PRIORITY_LEVEL_MAP.get(ticket.priority, "L2"),
                    "status": ticket.status,
                    "worked": _format_worked(getattr(ticket, "total_seconds", 0)),
                    "detail": _latest_detail(ticket),
                }
            )

        safe_client = _safe_name(client.name)
        file_stamp = f"{start_date.isoformat()}_{end_date.isoformat()}"

        if export_format == "csv":
            response = HttpResponse(content_type="text/csv; charset=utf-8")
            response["Content-Disposition"] = f'attachment; filename="tickets-{safe_client}-{file_stamp}.csv"'

            writer = csv.writer(response)
            writer.writerow(["Date", "Ticket", "Agent", "Level", "Status", "Worked", "Detail"])
            for row in rows:
                writer.writerow(
                    [
                        row["date"],
                        row["ticket"],
                        row["agent"],
                        row["level"],
                        row["status"],
                        row["worked"],
                        row["detail"],
                    ]
                )
            return response

        subtitle = f"Client: {client.name} | Range: {start_date.isoformat()} to {end_date.isoformat()}"
        pdf_bytes = _build_pdf_bytes("Daftar Ticket Export", subtitle, rows)

        response = HttpResponse(content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="tickets-{safe_client}-{file_stamp}.pdf"'
        response.write(pdf_bytes)
        return response

    @action(detail=False, methods=["post"], url_path="tools/import", url_name="tools-import")
    def import_tickets(self, request):
        client_id = (request.data.get("client_id") or "").strip()
        file_obj = request.FILES.get("file")

        if not client_id:
            return Response(
                {"success": False, "data": {}, "message": "client_id is required", "errors": {"client_id": "Required"}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client = Client.objects.filter(id=client_id).first()
        if not client:
            return Response(
                {"success": False, "data": {}, "message": "Client not found", "errors": {"client_id": "Invalid"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not file_obj:
            return Response(
                {"success": False, "data": {}, "message": "CSV file is required", "errors": {"file": "Required"}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            csv_text = file_obj.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return Response(
                {"success": False, "data": {}, "message": "CSV must be UTF-8 encoded", "errors": {"file": "Encoding"}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reader = csv.DictReader(io.StringIO(csv_text))
        if not reader.fieldnames:
            return Response(
                {"success": False, "data": {}, "message": "CSV headers are missing", "errors": {"file": "Headers required"}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        User = get_user_model()
        all_users = list(User.objects.all())
        users_by_email = {(u.email or "").strip().lower(): u for u in all_users if u.email}
        users_by_display = {(u.display_name or "").strip().lower(): u for u in all_users if getattr(u, "display_name", "")}
        users_by_full = {(u.full_name or "").strip().lower(): u for u in all_users if u.full_name}

        def pick(data: dict, *keys: str) -> str:
            for key in keys:
                value = data.get(key)
                if value is not None and str(value).strip():
                    return str(value).strip()
            return ""

        created = 0
        updated = 0
        failed = 0
        errors = []
        tz = timezone.get_current_timezone()

        for row_index, row in enumerate(reader, start=2):
            normalized = {str(k or "").strip().lower(): str(v or "").strip() for k, v in row.items()}

            try:
                ticket = pick(normalized, "ticket")
                ticket_number = pick(normalized, "ticket number", "ticket_number")
                title = pick(normalized, "title", "subject", "ticket subject")

                if ticket:
                    parsed_ticket_number, parsed_title = _split_ticket(ticket, strict=True)
                    ticket_number = ticket_number or parsed_ticket_number
                    title = title or parsed_title

                if ticket_number and not title and " - " in ticket_number:
                    parsed_ticket_number, parsed_title = _split_ticket(ticket_number, strict=True)
                    ticket_number = parsed_ticket_number
                    title = parsed_title

                if not ticket_number or not title:
                    raise ValueError("ticket is required")

                status_raw = pick(normalized, "status").upper()
                ticket_status = STATUS_NORMALIZATION.get(status_raw, Ticket.Status.PENDING)

                level_raw = pick(normalized, "level", "priority").upper()
                ticket_priority = LEVEL_PRIORITY_MAP.get(level_raw, Ticket.Priority.NORMAL)

                date_raw = pick(normalized, "date", "created date", "created_at", "created")
                row_date = _parse_date(date_raw) if date_raw else timezone.localdate()

                worked_raw = pick(normalized, "worked", "worked time", "time worked", "worked_time")
                worked_seconds = _parse_worked_seconds(worked_raw) if worked_raw else 0

                detail = pick(normalized, "detail", "summary", "steps", "note")
                agent_key = pick(normalized, "agent", "assigned agent", "assigned_agent", "agent_email", "agent email")

                assigned_agent = request.user
                if agent_key:
                    lowered = agent_key.lower()
                    assigned_agent = (
                        users_by_email.get(lowered)
                        or users_by_display.get(lowered)
                        or users_by_full.get(lowered)
                        or request.user
                    )

                ticket = (
                    Ticket.objects.filter(client=client, ticket_number=ticket_number)
                    .order_by("-created_at")
                    .first()
                )
                is_new = ticket is None

                if is_new:
                    ticket = Ticket.objects.create(
                        ticket_number=ticket_number,
                        title=title,
                        client=client,
                        status=ticket_status,
                        priority=ticket_priority,
                        assigned_agent=assigned_agent,
                        created_by=request.user,
                    )
                else:
                    ticket.title = title
                    ticket.status = ticket_status
                    ticket.priority = ticket_priority
                    ticket.assigned_agent = assigned_agent
                    ticket.client = client

                if ticket_status == Ticket.Status.COMPLETED and not ticket.completed_at:
                    ticket.completed_at = timezone.now()
                if ticket_status != Ticket.Status.COMPLETED:
                    ticket.completed_at = None
                ticket.save()

                created_at = timezone.make_aware(datetime.combine(row_date, dt_time(hour=9, minute=0)), timezone=tz)
                Ticket.objects.filter(id=ticket.id).update(created_at=created_at, updated_at=timezone.now())

                if detail:
                    TicketNote.objects.create(ticket=ticket, content=detail, created_by=request.user)

                if worked_seconds > 0:
                    started_at = created_at
                    ended_at = started_at + timedelta(seconds=worked_seconds)
                    TimeEntry.objects.create(
                        ticket=ticket,
                        agent=assigned_agent,
                        started_at=started_at,
                        ended_at=ended_at,
                        note="Imported from CSV",
                        is_manual=True,
                    )

                if is_new:
                    created += 1
                else:
                    updated += 1
            except Exception as exc:
                failed += 1
                errors.append(f"Row {row_index}: {exc}")

        return Response(
            {
                "success": True,
                "data": {
                    "client_id": str(client.id),
                    "created": created,
                    "updated": updated,
                    "failed": failed,
                    "required_fields": ["date", "ticket", "agent", "level", "status", "worked"],
                    "errors": errors[:100],
                },
                "message": "Import completed",
                "errors": {},
            },
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
