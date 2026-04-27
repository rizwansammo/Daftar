from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ClientViewSet, TicketNoteViewSet, TicketViewSet, TimeEntryViewSet

router = DefaultRouter()
router.register(r"clients", ClientViewSet, basename="client")
router.register(r"tickets", TicketViewSet, basename="ticket")
router.register(r"ticket-notes", TicketNoteViewSet, basename="ticket-note")
router.register(r"time-entries", TimeEntryViewSet, basename="time-entry")

urlpatterns = [
    path("tickets/export/", TicketViewSet.as_view({"get": "export_tickets"}), name="ticket-export-compat"),
    path("tickets/import/", TicketViewSet.as_view({"post": "import_tickets"}), name="ticket-import-compat"),
    path("", include(router.urls)),
]
