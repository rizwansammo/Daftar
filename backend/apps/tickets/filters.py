import django_filters

from .models import Ticket


class TicketFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(field_name="status")
    priority = django_filters.CharFilter(field_name="priority")
    client = django_filters.UUIDFilter(field_name="client_id")
    assigned_agent = django_filters.UUIDFilter(field_name="assigned_agent_id")
    created_from = django_filters.DateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_to = django_filters.DateTimeFilter(field_name="created_at", lookup_expr="lte")

    class Meta:
        model = Ticket
        fields = [
            "status",
            "priority",
            "client",
            "assigned_agent",
            "created_from",
            "created_to",
        ]
