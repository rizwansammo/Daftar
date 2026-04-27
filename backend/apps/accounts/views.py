from decouple import config
from django.contrib.auth import get_user_model
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import MeSerializer


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        User = get_user_model()

        raw_password = request.data.get("password")
        identifier = request.data.get("email") or request.data.get("username")

        if not identifier or not raw_password:
            return Response(
                {
                    "success": False,
                    "data": {},
                    "message": "Missing credentials",
                    "errors": {"detail": ["email/username and password are required"]},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = identifier
        if "@" not in identifier:
            user = User.objects.filter(username=identifier).only("email").first()
            if not user:
                return Response(
                    {
                        "success": False,
                        "data": {},
                        "message": "Invalid credentials",
                        "errors": {"detail": ["Invalid credentials"]},
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            email = user.email

        serializer = TokenObtainPairSerializer(data={"email": email, "password": raw_password})
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
