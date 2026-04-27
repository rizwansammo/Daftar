from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ShiftAssignmentViewSet

router = DefaultRouter()
router.register(r"shifts", ShiftAssignmentViewSet, basename="shift")

urlpatterns = [
    path("", include(router.urls)),
]
