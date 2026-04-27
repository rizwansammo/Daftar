from django.contrib import admin

from .models import Boilerplate


@admin.register(Boilerplate)
class BoilerplateAdmin(admin.ModelAdmin):
    list_display = ("title", "client", "user", "is_checked", "updated_at")
    search_fields = ("title", "content", "client__name", "user__email")
    list_filter = ("client", "is_checked")
