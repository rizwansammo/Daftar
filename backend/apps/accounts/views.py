from decouple import config
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import CustomUser
from .serializers import (
    MeSerializer,
    MeUpdateSerializer,
    ResetPasswordSerializer,
    UserCreateSerializer,
    UserSerializer,
)


def is_manager(user):
    return bool(user and user.is_authenticated and user.role == CustomUser.Role.ADMIN)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_password = request.data.get("password")
        email = request.data.get("email")

        if not email or not raw_password:
            return Response(
                {
                    "success": False,
                    "data": {},
                    "message": "Missing credentials",
                    "errors": {"detail": ["email and password are required"]},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TokenObtainPairSerializer(data={"email": str(email).strip().lower(), "password": raw_password})
        serializer.is_valid(raise_exception=True)

        access = serializer.validated_data["access"]
        refresh = serializer.validated_data["refresh"]

        response = Response({"success": True, "data": {}, "message": "Logged in", "errors": {}}, status=status.HTTP_200_OK)

        cookie_secure = config("JWT_COOKIE_SECURE", default=False, cast=bool)
        cookie_samesite = config("JWT_COOKIE_SAMESITE", default="Lax")
        cookie_domain = config("JWT_COOKIE_DOMAIN", default=None)

        response.set_cookie(
            "daftar_access",
            access,
            httponly=True,
            secure=cookie_secure,
            samesite=cookie_samesite,
            domain=cookie_domain,
            path="/",
        )
        response.set_cookie(
            "daftar_refresh",
            refresh,
            httponly=True,
            secure=cookie_secure,
            samesite=cookie_samesite,
            domain=cookie_domain,
            path="/",
        )
        return response


class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_raw = request.COOKIES.get("daftar_refresh")
        if not refresh_raw:
            return Response(
                {"success": False, "data": {}, "message": "No refresh token", "errors": {"refresh": ["Missing"]}},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            token = RefreshToken(refresh_raw)
            access = str(token.access_token)

            response = Response({"success": True, "data": {}, "message": "Refreshed", "errors": {}}, status=status.HTTP_200_OK)
            cookie_secure = config("JWT_COOKIE_SECURE", default=False, cast=bool)
            cookie_samesite = config("JWT_COOKIE_SAMESITE", default="Lax")
            cookie_domain = config("JWT_COOKIE_DOMAIN", default=None)

            response.set_cookie(
                "daftar_access",
                access,
                httponly=True,
                secure=cookie_secure,
                samesite=cookie_samesite,
                domain=cookie_domain,
                path="/",
            )
            return response
        except TokenError:
            return Response(
                {"success": False, "data": {}, "message": "Invalid refresh token", "errors": {"refresh": ["Invalid"]}},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_raw = request.COOKIES.get("daftar_refresh")
        if refresh_raw:
            try:
                RefreshToken(refresh_raw).blacklist()
            except TokenError:
                pass

        response = Response({"success": True, "data": {}, "message": "Logged out", "errors": {}}, status=status.HTTP_200_OK)
        cookie_domain = config("JWT_COOKIE_DOMAIN", default=None)
        response.delete_cookie("daftar_access", path="/", domain=cookie_domain)
        response.delete_cookie("daftar_refresh", path="/", domain=cookie_domain)
        return response


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        data = MeSerializer(request.user).data
        return Response({"success": True, "data": data, "message": "OK", "errors": {}}, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        data = MeSerializer(request.user).data
        return Response({"success": True, "data": data, "message": "Updated", "errors": {}}, status=status.HTTP_200_OK)


class UserViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = CustomUser.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["display_name", "full_name", "email"]
    ordering_fields = ["display_name", "full_name", "email", "date_joined", "last_login", "role"]
    pagination_ordering = "display_name"

    def get_queryset(self):
        return super().get_queryset().order_by("display_name", "full_name", "email")

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        if not is_manager(request.user):
            return Response(
                {
                    "success": False,
                    "data": {},
                    "message": "Forbidden",
                    "errors": {"detail": "Only managers can create accounts"},
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        if not is_manager(request.user):
            return Response(
                {
                    "success": False,
                    "data": {},
                    "message": "Forbidden",
                    "errors": {"detail": "Only managers can delete accounts"},
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        target = self.get_object()
        if str(target.id) == str(request.user.id):
            return Response(
                {
                    "success": False,
                    "data": {},
                    "message": "Not allowed",
                    "errors": {"detail": "You cannot delete your own account"},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        target.delete()
        return Response({"success": True, "data": {}, "message": "Deleted", "errors": {}}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        target = self.get_object()
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        manager = is_manager(request.user)
        is_self = str(target.id) == str(request.user.id)

        if not manager and not is_self:
            return Response(
                {
                    "success": False,
                    "data": {},
                    "message": "Forbidden",
                    "errors": {"detail": "Agents can only reset their own password"},
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if not manager:
            current_password = serializer.validated_data.get("current_password")
            if not current_password or not target.check_password(current_password):
                return Response(
                    {
                        "success": False,
                        "data": {},
                        "message": "Invalid current password",
                        "errors": {"current_password": "Invalid current password"},
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        target.set_password(serializer.validated_data["new_password"])
        target.save(update_fields=["password"])

        return Response(
            {"success": True, "data": {}, "message": "Password reset successful", "errors": {}},
            status=status.HTTP_200_OK,
        )
