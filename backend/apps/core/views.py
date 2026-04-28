import os
from datetime import datetime, timedelta

from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.views import is_manager
from apps.docs.models import Document, DocumentCategory
from apps.tickets.models import Client, TimeEntry


STARTED_AT = timezone.now()


def _start_of_day(dt):
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def _start_of_week(dt):
    base = _start_of_day(dt)
    return base - timedelta(days=base.weekday())


def _parse_date_param(raw, fallback_dt):
    if not raw:
        return fallback_dt
    try:
        parsed = datetime.strptime(raw, "%Y-%m-%d").date()
        tz = timezone.get_current_timezone()
        return timezone.make_aware(datetime(parsed.year, parsed.month, parsed.day, 0, 0, 0), tz)
    except Exception:
        return fallback_dt


class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        query = (request.query_params.get("q") or "").strip()
        selected_raw = request.query_params.get("date")

        # date-based dashboard (daily). trend is fixed (last 30 days ending at selected date).
        selected_start = _parse_date_param(selected_raw, _start_of_day(now))
        selected_end = selected_start + timedelta(days=1)
        start_week = _start_of_week(selected_start)
        trend_days = 30
        start_trend = selected_start - timedelta(days=trend_days - 1)

        base_time_qs = TimeEntry.objects.select_related("agent", "ticket", "ticket__client").all()

        # Agent view (self)
        my_time_qs = base_time_qs.filter(agent=request.user)
        my_today_seconds = int(
            my_time_qs.filter(started_at__gte=selected_start, started_at__lt=selected_end)
            .aggregate(total=Sum("duration_seconds"))
            .get("total")
            or 0
        )
        my_week_seconds = int(
            my_time_qs.filter(started_at__gte=start_week).aggregate(total=Sum("duration_seconds")).get("total")
            or 0
        )
        my_trend = list(
            my_time_qs.filter(started_at__gte=start_trend, started_at__lt=selected_end)
            .annotate(day=TruncDate("started_at"))
            .values("day")
            .annotate(seconds=Sum("duration_seconds"))
            .order_by("day")
        )

        agent = {
            "hours": {
                "today_seconds": my_today_seconds,
                "week_seconds": my_week_seconds,
            },
            "trend": [
                {"date": x["day"].isoformat() if x.get("day") else None, "seconds": int(x["seconds"] or 0)}
                for x in my_trend
            ],
        }

        manager_payload = None
        if is_manager(request.user):
            leaderboard = list(
                base_time_qs.filter(started_at__gte=selected_start, started_at__lt=selected_end)
                .values("agent")
                .annotate(
                    seconds=Sum("duration_seconds"),
                    display_name=F("agent__display_name"),
                    full_name=F("agent__full_name"),
                    email=F("agent__email"),
                )
                .order_by("-seconds")
            )

            leaderboard_out = []
            for row in leaderboard:
                name = row.get("display_name") or row.get("full_name") or row.get("email") or "Unknown"
                leaderboard_out.append(
                    {
                        "user_id": str(row.get("agent")),
                        "name": name,
                        "seconds": int(row.get("seconds") or 0),
                    }
                )

            team_trend = list(
                base_time_qs.filter(started_at__gte=start_trend, started_at__lt=selected_end)
                .annotate(day=TruncDate("started_at"))
                .values("day")
                .annotate(seconds=Sum("duration_seconds"))
                .order_by("day")
            )

            # Docs stats
            docs_created_this_week = int(
                Document.objects.filter(created_at__gte=start_week).count()
            )
            docs_updated_recently = list(
                Document.objects.select_related("last_edited_by", "author")
                .filter(updated_at__gte=selected_start, updated_at__lt=selected_end)
                .order_by("-updated_at")
                .values(
                    "id",
                    "title",
                    "updated_at",
                    "last_edited_by__display_name",
                    "last_edited_by__full_name",
                    "last_edited_by__email",
                )[:12]
            )

            docs_created_today = list(
                Document.objects.select_related("author")
                .filter(created_at__gte=selected_start, created_at__lt=selected_end)
                .order_by("-created_at")
                .values(
                    "id",
                    "title",
                    "created_at",
                    "author__display_name",
                    "author__full_name",
                    "author__email",
                )[:12]
            )

            runbook_category = DocumentCategory.objects.filter(name__iexact="Runbook").first()
            if runbook_category:
                missing_runbook = list(
                    Client.objects.annotate(
                        runbook_docs=Count(
                            "documents",
                            filter=Q(documents__category=runbook_category),
                            distinct=True,
                        )
                    )
                    .filter(runbook_docs=0)
                    .values("id", "name")
                    .order_by("name")[:20]
                )
            else:
                missing_runbook = []

            search_results = []
            if query:
                search_results = list(
                    Document.objects.filter(content_text__icontains=query)
                    .order_by("-updated_at")
                    .values("id", "title", "updated_at")[:10]
                )

            manager_payload = {
                "leaderboard": leaderboard_out,
                "trend": [
                    {"date": x["day"].isoformat() if x.get("day") else None, "seconds": int(x["seconds"] or 0)}
                    for x in team_trend
                ],
                "docs": {
                    "created_this_week": docs_created_this_week,
                    "updated_recently": [
                        {
                            "id": str(d["id"]),
                            "title": d["title"],
                            "updated_at": d["updated_at"].isoformat() if d.get("updated_at") else None,
                            "last_edited_by": d.get("last_edited_by__display_name")
                            or d.get("last_edited_by__full_name")
                            or d.get("last_edited_by__email"),
                        }
                        for d in docs_updated_recently
                    ],
                    "created_today": [
                        {
                            "id": str(d["id"]),
                            "title": d["title"],
                            "created_at": d["created_at"].isoformat() if d.get("created_at") else None,
                            "author": d.get("author__display_name") or d.get("author__full_name") or d.get("author__email"),
                        }
                        for d in docs_created_today
                    ],
                    "clients_missing_runbook": [{"id": str(c["id"]), "name": c["name"]} for c in missing_runbook],
                    "runbook_category_exists": bool(runbook_category),
                },
                "search": {
                    "query": query,
                    "results": [
                        {
                            "id": str(d["id"]),
                            "title": d["title"],
                            "updated_at": d["updated_at"].isoformat() if d.get("updated_at") else None,
                        }
                        for d in search_results
                    ],
                },
            }

        system = {
            "server_time": now.isoformat(),
            "started_at": STARTED_AT.isoformat(),
            "uptime_seconds": int((now - STARTED_AT).total_seconds()),
            "version": os.environ.get("DAFTAR_VERSION") or os.environ.get("GIT_SHA") or None,
        }

        # NOTE: WrappedJSONRenderer will wrap this into {success,data,message,errors}
        return Response(
            {
                "system": system,
                "agent": agent,
                "manager": manager_payload,
                "selected_date": selected_start.date().isoformat(),
                "trend_days": trend_days,
            }
        )
