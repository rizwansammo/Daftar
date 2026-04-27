from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ClientViewSet, TicketNoteViewSet, TicketViewSet, TimeEntryViewSet

router = DefaultRouter()
router.register(r"clients", ClientViewSet, basename="client")
router.register(r"tickets", TicketViewSet, basename="ticket")
router.register(r"ticket-notes", TicketNoteViewSet, basename="ticket-note")
router.register(r"time-entries", TimeEntryViewSet, basename="time-entry")

urlpatterns = [
    path("", include(router.urls)),
]
