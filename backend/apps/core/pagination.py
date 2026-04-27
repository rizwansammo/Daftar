from rest_framework.pagination import CursorPagination


class DefaultCursorPagination(CursorPagination):
    page_size = 25
    ordering = "-created_at"
    cursor_query_param = "cursor"

    def get_ordering(self, request, queryset, view):
        ordering = None
        if hasattr(view, "pagination_ordering") and view.pagination_ordering:
            ordering = view.pagination_ordering
        elif hasattr(queryset.model, "created_at"):
            ordering = self.ordering
        else:
            ordering = "-id"

        if isinstance(ordering, str):
            ordering = (ordering,)

        ordering = tuple([o for o in ordering if isinstance(o, str) and o.strip()])
        return ordering or ("-id",)
