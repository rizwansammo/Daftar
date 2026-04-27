from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BoilerplateViewSet

router = DefaultRouter()
router.register(r"boilerplates", BoilerplateViewSet, basename="boilerplate")

urlpatterns = [
    path("", include(router.urls)),
]
