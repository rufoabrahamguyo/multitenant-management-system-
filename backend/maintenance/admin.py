from django.contrib import admin

from .models import MaintenanceRequest


@admin.register(MaintenanceRequest)
class MaintenanceRequestAdmin(admin.ModelAdmin):
    list_display = ['issue_title', 'tenant', 'unit', 'status', 'created_at']
    list_filter = ['status']
