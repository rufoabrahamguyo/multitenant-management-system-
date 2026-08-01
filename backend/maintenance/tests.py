from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from maintenance.models import MaintenanceRequest
from properties.models import Property, TenantProfile, Unit
from users.models import Organization, OrganizationMember

User = get_user_model()


class MaintenanceAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = User.objects.create_user(
            username='mgr', email='m@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        self.org = Organization.objects.create(
            name='Org', slug='org', property_manager_id=self.manager.property_manager_id, owner=self.manager,
        )
        OrganizationMember.objects.create(
            organization=self.org, user=self.manager, role=OrganizationMember.Role.OWNER,
        )
        self.prop = Property.objects.create(manager=self.manager, name='P', address='A', total_units=1)
        self.unit = Unit.objects.create(property=self.prop, unit_number='01', rent_amount=Decimal('10000'))
        self.tenant_user = User.objects.create_user(
            username='t', email='t@test.com', password='pass12345', role=User.Role.TENANT, manager=self.manager,
        )
        self.tenant = TenantProfile.objects.create(
            user=self.tenant_user, phone_number='254700000001', current_unit=self.unit,
        )

        self.other_manager = User.objects.create_user(
            username='mgr2', email='m2@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        other_org = Organization.objects.create(
            name='Org2', slug='org2',
            property_manager_id=self.other_manager.property_manager_id, owner=self.other_manager,
        )
        OrganizationMember.objects.create(
            organization=other_org, user=self.other_manager, role=OrganizationMember.Role.OWNER,
        )
        other_prop = Property.objects.create(
            manager=self.other_manager, name='P2', address='B', total_units=1,
        )
        other_unit = Unit.objects.create(
            property=other_prop, unit_number='01', rent_amount=Decimal('12000'),
        )
        other_tenant_user = User.objects.create_user(
            username='t2', email='t2@test.com', password='pass12345',
            role=User.Role.TENANT, manager=self.other_manager,
        )
        other_tenant = TenantProfile.objects.create(
            user=other_tenant_user, phone_number='254700000002', current_unit=other_unit,
        )

        self.own_request = MaintenanceRequest.objects.create(
            tenant=self.tenant,
            unit=self.unit,
            issue_title='Leaky tap',
            issue_description='Kitchen sink',
        )
        self.other_request = MaintenanceRequest.objects.create(
            tenant=other_tenant,
            unit=other_unit,
            issue_title='Broken lock',
            issue_description='Front door',
        )

    def test_anonymous_maintenance_returns_401(self):
        resp = self.client.get('/api/maintenance/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_manager_only_sees_own_org_requests(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get('/api/maintenance/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = [row['id'] for row in resp.data['results']]
        self.assertIn(self.own_request.id, ids)
        self.assertNotIn(self.other_request.id, ids)

    def test_manager_cannot_retrieve_other_org_request(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f'/api/maintenance/{self.other_request.id}/')
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_tenant_only_sees_own_requests(self):
        self.client.force_authenticate(user=self.tenant_user)
        resp = self.client.get('/api/maintenance/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = [row['id'] for row in resp.data['results']]
        self.assertEqual(ids, [self.own_request.id])
