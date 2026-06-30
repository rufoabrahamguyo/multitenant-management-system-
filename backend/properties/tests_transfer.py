from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from properties.models import Lease, Property, TenantProfile, Unit, UnitCategory, UnitTransferRequest

User = get_user_model()


class TransferFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = User.objects.create_user(
            username='xfer_mgr', password='pass12345', role=User.Role.MANAGER,
        )
        from users.models import Organization, OrganizationMember
        self.org = Organization.objects.create(
            name='Xfer Org', slug='xfer-org',
            property_manager_id=self.manager.property_manager_id, owner=self.manager,
        )
        OrganizationMember.objects.create(
            organization=self.org, user=self.manager, role=OrganizationMember.Role.OWNER,
        )
        self.prop = Property.objects.create(
            manager=self.manager, name='Test Prop', address='Addr', total_units=3,
        )
        self.studio = UnitCategory.objects.create(
            property_ref=self.prop, name='Studio', description='Compact unit', sort_order=1,
        )
        self.premium = UnitCategory.objects.create(
            property_ref=self.prop, name='Premium', description='Large unit', sort_order=2,
        )
        self.unit_studio = Unit.objects.create(
            property=self.prop, category=self.studio, unit_number='S01',
            rent_amount=Decimal('10000'), status=Unit.Status.OCCUPIED,
        )
        self.unit_premium_vacant = Unit.objects.create(
            property=self.prop, category=self.premium, unit_number='P01',
            rent_amount=Decimal('20000'), status=Unit.Status.VACANT,
        )
        self.tenant_user = User.objects.create_user(
            username='xfer_tenant', password='pass12345', role=User.Role.TENANT, manager=self.manager,
        )
        self.profile = TenantProfile.objects.create(
            user=self.tenant_user, phone_number='254700000111', current_unit=self.unit_studio,
        )
        self.lease = Lease.objects.create(
            tenant=self.profile, unit=self.unit_studio,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=365),
            rent_amount=Decimal('10000'), is_active=True,
        )

    def test_tenant_views_availability(self):
        self.client.force_authenticate(user=self.tenant_user)
        resp = self.client.get('/api/unit-availability/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(len(resp.data) >= 2)

    def test_tenant_submits_transfer_request(self):
        self.client.force_authenticate(user=self.tenant_user)
        resp = self.client.post('/api/transfer-requests/', {
            'desired_category_id': self.premium.id,
            'preferred_unit_id': self.unit_premium_vacant.id,
            'tenant_note': 'Need more space',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['status'], 'pending')

    def test_owner_approves_transfer(self):
        transfer = UnitTransferRequest.objects.create(
            tenant=self.profile, current_lease=self.lease,
            desired_category=self.premium, preferred_unit=self.unit_premium_vacant,
            status=UnitTransferRequest.Status.PENDING,
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            f'/api/transfer-requests/{transfer.id}/approve/',
            {'unit_id': self.unit_premium_vacant.id},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, UnitTransferRequest.Status.COMPLETED)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.current_unit_id, self.unit_premium_vacant.id)

    def test_auto_waitlist_when_no_vacancy(self):
        self.unit_premium_vacant.status = Unit.Status.OCCUPIED
        self.unit_premium_vacant.save()
        self.client.force_authenticate(user=self.tenant_user)
        resp = self.client.post('/api/transfer-requests/', {
            'desired_category_id': self.premium.id,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['status'], 'waitlisted')
        self.assertEqual(resp.data['waitlist_position'], 1)

    def test_manager_creates_category(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post('/api/unit-categories/', {
            'property_ref': self.prop.id,
            'name': '1 Bedroom',
            'description': 'Standard',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
