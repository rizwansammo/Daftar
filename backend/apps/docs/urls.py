from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DocumentCategoryViewSet, DocumentVersionViewSet, DocumentViewSet

router = DefaultRouter()
router.register(r"doc-categories", DocumentCategoryViewSet, basename="doc-category")
router.register(r"docs", DocumentViewSet, basename="doc")
router.register(r"doc-versions", DocumentVersionViewSet, basename="doc-version")

urlpatterns = [
    path("", include(router.urls)),
]
