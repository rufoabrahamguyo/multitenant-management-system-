from rest_framework import serializers

from .models import MaintenanceRequest


class MaintenanceRequestSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.user.username', read_only=True)
    unit_number = serializers.CharField(source='unit.unit_number', read_only=True)
    property_name = serializers.CharField(source='unit.property.name', read_only=True)

    class Meta:
        model = MaintenanceRequest
        fields = [
            'id', 'tenant', 'tenant_name', 'unit', 'unit_number', 'property_name',
            'issue_title', 'issue_description', 'status', 'created_at', 'updated_at',
        ]
        read_only_fields = ['tenant', 'unit', 'created_at', 'updated_at']
