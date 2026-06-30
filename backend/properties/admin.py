from django.contrib import admin

from .models import Lease, Property, TenantProfile, Unit, UnitCategory, UnitTransferRequest


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ['name', 'manager', 'address', 'total_units']


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ['unit_number', 'property', 'category', 'rent_amount', 'status']


@admin.register(UnitCategory)
class UnitCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'property_ref', 'sort_order']


@admin.register(UnitTransferRequest)
class UnitTransferRequestAdmin(admin.ModelAdmin):
    list_display = ['tenant', 'desired_category', 'status', 'created_at']
    list_filter = ['status']


@admin.register(TenantProfile)
class TenantProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'phone_number', 'current_unit']


@admin.register(Lease)
class LeaseAdmin(admin.ModelAdmin):
    list_display = ['tenant', 'unit', 'start_date', 'end_date', 'rent_amount', 'is_active']
