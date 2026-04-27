from django_filters import rest_framework as filters

from .models import Reminder


class ReminderFilter(filters.FilterSet):
    start = filters.IsoDateTimeFilter(field_name="remind_at", lookup_expr="gte")
    end = filters.IsoDateTimeFilter(field_name="remind_at", lookup_expr="lte")

    class Meta:
        model = Reminder
        fields = ["is_completed", "priority", "repeat_type", "start", "end"]
