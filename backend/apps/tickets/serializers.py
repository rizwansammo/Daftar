from rest_framework import serializers

from apps.accounts.serializers import MeSerializer
from apps.core.models import Tag

from .models import Client, Ticket, TicketNote, TimeEntry


def _split_ticket(value: str) -> tuple[str, str]:
    raw = (value or "").strip()
    if not raw:
        raise serializers.ValidationError({"ticket": "Ticket is required"})

    ticket_parts = raw.split(" - ", 1)
    if len(ticket_parts) != 2:
        raise serializers.ValidationError({"ticket": "Use format: TICKET_NUMBER - Subject"})

    ticket_number = ticket_parts[0].strip()
    title = ticket_parts[1].strip()
    if not ticket_number or not title:
        raise serializers.ValidationError({"ticket": "Use format: TICKET_NUMBER - Subject"})
    return ticket_number, title


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("id", "name", "color")


class ClientSerializer(serializers.ModelSerializer):
    ticket_count = serializers.IntegerField(read_only=True)
    doc_count = serializers.IntegerField(read_only=True)
    boilerplate_count = serializers.IntegerField(read_only=True)
    completed_ticket_count = serializers.IntegerField(read_only=True)
    pending_ticket_count = serializers.IntegerField(read_only=True)
    handed_over_ticket_count = serializers.IntegerField(read_only=True)
    total_time_seconds = serializers.IntegerField(read_only=True)

    class Meta:
        model = Client
        fields = (
            "id",
            "name",
            "color_tag",
            "contact_email",
            "notes",
            "created_at",
            "ticket_count",
            "doc_count",
            "boilerplate_count",
            "completed_ticket_count",
            "pending_ticket_count",
            "handed_over_ticket_count",
            "total_time_seconds",
        )


class TicketNoteSerializer(serializers.ModelSerializer):
    created_by = MeSerializer(read_only=True)

    class Meta:
        model = TicketNote
        fields = ("id", "ticket", "content", "created_by", "created_at")
        read_only_fields = ("ticket", "created_by", "created_at")


class TimeEntrySerializer(serializers.ModelSerializer):
    agent = MeSerializer(read_only=True)
    ticket_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = TimeEntry
        fields = (
            "id",
            "ticket",
            "ticket_id",
            "agent",
            "started_at",
            "ended_at",
            "duration_seconds",
            "note",
            "is_manual",
            "is_running",
            "live_duration_seconds",
        )
        read_only_fields = ("ticket", "agent", "duration_seconds")

    def validate(self, attrs):
        started_at = attrs.get("started_at")
        ended_at = attrs.get("ended_at")
        if started_at and ended_at and ended_at < started_at:
            raise serializers.ValidationError({"ended_at": "ended_at must be after started_at"})
        return attrs

    def create(self, validated_data):
        ticket_id = validated_data.pop("ticket_id", None)
        if not ticket_id:
            raise serializers.ValidationError({"ticket_id": "This field is required."})

        ticket = Ticket.objects.get(id=ticket_id)
        request = self.context.get("request")
        agent = getattr(request, "user", None)
        if not agent or not agent.is_authenticated:
            raise serializers.ValidationError("Authentication required")

        validated_data.setdefault("is_manual", True)

        return TimeEntry.objects.create(ticket=ticket, agent=agent, **validated_data)


class TicketSerializer(serializers.ModelSerializer):
    ticket = serializers.CharField(required=False)
    ticket_number = serializers.CharField(required=False)
    title = serializers.CharField(required=False)
    client = ClientSerializer(read_only=True)
    client_id = serializers.UUIDField(write_only=True)

    assigned_agent = MeSerializer(read_only=True)
    assigned_agent_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    created_by = MeSerializer(read_only=True)

    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(child=serializers.UUIDField(), write_only=True, required=False)

    total_time_seconds = serializers.IntegerField(read_only=True)

    class Meta:
        model = Ticket
        fields = (
            "id",
            "ticket",
            "ticket_number",
            "title",
            "client",
            "client_id",
            "status",
            "priority",
            "assigned_agent",
            "assigned_agent_id",
            "created_by",
            "created_at",
            "updated_at",
            "completed_at",
            "due_date",
            "tags",
            "tag_ids",
            "total_time_seconds",
        )

    def validate(self, attrs):
        ticket_raw = attrs.pop("ticket", None)
        if ticket_raw is not None:
            ticket_number, title = _split_ticket(ticket_raw)
            attrs["ticket_number"] = ticket_number
            attrs["title"] = title

        if self.instance is None:
            ticket_number = (attrs.get("ticket_number") or "").strip()
            title = (attrs.get("title") or "").strip()
            if not ticket_number or not title:
                raise serializers.ValidationError({"ticket": "Ticket is required"})

        return attrs

    def create(self, validated_data):
        from django.contrib.auth import get_user_model

        client_id = validated_data.pop("client_id")
        assigned_agent_id = validated_data.pop("assigned_agent_id", None)
        tag_ids = validated_data.pop("tag_ids", [])

        client = Client.objects.get(id=client_id)
        ticket = Ticket.objects.create(client=client, created_by=self.context["request"].user, **validated_data)

        if assigned_agent_id:
            User = get_user_model()
            ticket.assigned_agent = User.objects.get(id=assigned_agent_id)
            ticket.save(update_fields=["assigned_agent"])
        elif self.context.get("request") and self.context["request"].user.is_authenticated:
            ticket.assigned_agent = self.context["request"].user
            ticket.save(update_fields=["assigned_agent"])

        if tag_ids:
            ticket.tags.set(Tag.objects.filter(id__in=tag_ids))

        return ticket

    def update(self, instance, validated_data):
        from django.contrib.auth import get_user_model

        client_id = validated_data.pop("client_id", None)
        assigned_agent_id = validated_data.pop("assigned_agent_id", None)
        tag_ids = validated_data.pop("tag_ids", None)

        if client_id is not None:
            instance.client = Client.objects.get(id=client_id)

        if assigned_agent_id is not None:
            User = get_user_model()
            instance.assigned_agent = User.objects.get(id=assigned_agent_id) if assigned_agent_id else None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if tag_ids is not None:
            instance.tags.set(Tag.objects.filter(id__in=tag_ids))

        return instance
