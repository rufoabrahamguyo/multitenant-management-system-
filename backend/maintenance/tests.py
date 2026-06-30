from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from properties.models import Property, TenantProfile, Unit
from users.models import Organization, OrganizationMember

User = get_user_model()


class MaintenanceAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        manager = User.objects.create_user(
            username='mgr', email='m@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        org = Organization.objects.create(
            name='Org', slug='org', property_manager_id=manager.property_manager_id, owner=manager,
        )
        OrganizationMember.objects.create(organization=org, user=manager, role=OrganizationMember.Role.OWNER)
        prop = Property.objects.create(manager=manager, name='P', address='A', total_units=1)
        unit = Unit.objects.create(property=prop, unit_number='01', rent_amount=Decimal('10000'))
        tenant_user = User.objects.create_user(
            username='t', email='t@test.com', password='pass12345', role=User.Role.TENANT, manager=manager,
        )
        TenantProfile.objects.create(user=tenant_user, phone_number='254700', current_unit=unit)

    def test_anonymous_maintenance_returns_401(self):
        resp = self.client.get('/api/maintenance/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
