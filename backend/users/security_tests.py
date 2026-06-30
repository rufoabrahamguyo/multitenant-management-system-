"""Tier 3: IDOR and multi-tenant isolation penetration-style tests."""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from payments.models import CashCollection
from properties.models import Lease, Property, TenantProfile, Unit
from users.models import Organization, OrganizationMember

User = get_user_model()


class SecurityPenetrationTests(TestCase):
    """Documented security test report for cross-tenant IDOR prevention."""

    def setUp(self):
        self.client = APIClient()
        self.mgr1 = User.objects.create_user(
            username='sec_mgr1', email='s1@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        self.mgr2 = User.objects.create_user(
            username='sec_mgr2', email='s2@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        self.staff1 = User.objects.create_user(
            username='sec_staff1', email='st1@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        self.org1 = Organization.objects.create(
            name='Sec Org1', slug='sec-org1',
            property_manager_id=self.mgr1.property_manager_id, owner=self.mgr1,
        )
        self.org2 = Organization.objects.create(
            name='Sec Org2', slug='sec-org2',
            property_manager_id=self.mgr2.property_manager_id, owner=self.mgr2,
        )
        OrganizationMember.objects.create(organization=self.org1, user=self.mgr1, role=OrganizationMember.Role.OWNER)
        OrganizationMember.objects.create(organization=self.org2, user=self.mgr2, role=OrganizationMember.Role.OWNER)
        OrganizationMember.objects.create(organization=self.org1, user=self.staff1, role=OrganizationMember.Role.STAFF)

        self.prop1 = Property.objects.create(manager=self.mgr1, name='SecProp1', address='A1', total_units=1)
        self.prop2 = Property.objects.create(manager=self.mgr2, name='SecProp2', address='A2', total_units=1)
        self.unit1 = Unit.objects.create(property=self.prop1, unit_number='01', rent_amount=Decimal('10000'))
        self.unit2 = Unit.objects.create(property=self.prop2, unit_number='01', rent_amount=Decimal('12000'))

        self.tenant_user1 = User.objects.create_user(
            username='sec_t1', role=User.Role.TENANT, manager=self.mgr1, password='pass12345',
        )
        self.profile1 = TenantProfile.objects.create(user=self.tenant_user1, phone_number='254700000001')
        self.lease1 = Lease.objects.create(
            tenant=self.profile1, unit=self.unit1,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=365),
            rent_amount=Decimal('10000'), is_active=True,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def test_idor_property_cross_org(self):
        self.auth(self.mgr1)
        resp = self.client.get(f'/api/properties/{self.prop2.id}/')
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_idor_tenant_dispute_pack_cross_org(self):
        self.auth(self.mgr2)
        resp = self.client.get(f'/api/tenants/{self.profile1.id}/dispute_pack/')
        self.assertIn(resp.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

    def test_idor_evidence_bundle_cross_org(self):
        self.auth(self.mgr2)
        resp = self.client.get(f'/api/tenants/{self.profile1.id}/evidence-bundle/')
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_staff_blocked_from_tax_export(self):
        self.auth(self.staff1)
        resp = self.client.get('/api/tax-export/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_blocked_from_mpesa_config_write(self):
        self.auth(self.staff1)
        resp = self.client.put('/api/auth/mpesa-config/', {'shortcode': '999999'})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_blocked_from_integrity_alerts(self):
        self.auth(self.staff1)
        resp = self.client.get('/api/payments/integrity-alerts/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_can_record_cash_collection(self):
        self.auth(self.staff1)
        resp = self.client.post('/api/cash-collections/', {
            'lease_id': self.lease1.id,
            'amount': '10000.00',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CashCollection.objects.filter(status=CashCollection.Status.PENDING).count(), 1)

    def test_owner_can_approve_cash_collection(self):
        cash = CashCollection.objects.create(
            lease=self.lease1, recorded_by=self.staff1,
            amount=Decimal('10000'), month_paid=timezone.now().date().replace(day=1),
        )
        self.auth(self.mgr1)
        resp = self.client.post(f'/api/cash-collections/{cash.id}/approve/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        cash.refresh_from_db()
        self.assertEqual(cash.status, CashCollection.Status.APPROVED)

    def test_permission_matrix_accessible_to_staff(self):
        self.auth(self.staff1)
        resp = self.client.get('/api/auth/permission-matrix/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['role'], 'STAFF')

    def test_reconciliation_summary_accessible_to_staff_readonly(self):
        self.auth(self.staff1)
        resp = self.client.get('/api/reconciliation/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_staff_blocked_from_statement_import(self):
        self.auth(self.staff1)
        resp = self.client.post('/api/reconciliation/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
