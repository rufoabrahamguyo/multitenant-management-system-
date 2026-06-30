from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from properties.models import Lease, Property, TenantProfile, Unit
from payments.models import Payment
from users.models import Organization, OrganizationMember, TenantInvite

User = get_user_model()


class PropizyTestBase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager1 = User.objects.create_user(
            username='mgr1', email='m1@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        self.manager2 = User.objects.create_user(
            username='mgr2', email='m2@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        self.org1 = Organization.objects.create(
            name='Org One', slug='org-one',
            property_manager_id=self.manager1.property_manager_id, owner=self.manager1,
        )
        OrganizationMember.objects.create(
            organization=self.org1, user=self.manager1, role=OrganizationMember.Role.OWNER,
        )
        self.org2 = Organization.objects.create(
            name='Org Two', slug='org-two',
            property_manager_id=self.manager2.property_manager_id, owner=self.manager2,
        )
        OrganizationMember.objects.create(
            organization=self.org2, user=self.manager2, role=OrganizationMember.Role.OWNER,
        )
        self.prop1 = Property.objects.create(
            manager=self.manager1, name='Prop1', address='Addr1', total_units=2,
        )
        self.prop2 = Property.objects.create(
            manager=self.manager2, name='Prop2', address='Addr2', total_units=2,
        )
        self.unit1 = Unit.objects.create(
            property=self.prop1, unit_number='01', rent_amount=Decimal('10000'), status=Unit.Status.VACANT,
        )
        self.unit2 = Unit.objects.create(
            property=self.prop2, unit_number='01', rent_amount=Decimal('12000'), status=Unit.Status.VACANT,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


class IsolationTests(PropizyTestBase):
    def test_manager_cannot_see_other_org_properties(self):
        self.auth(self.manager1)
        resp = self.client.get('/api/properties/')
        ids = [p['id'] for p in resp.data['results']]
        self.assertIn(self.prop1.id, ids)
        self.assertNotIn(self.prop2.id, ids)

    def test_manager_cannot_retrieve_other_org_property(self):
        self.auth(self.manager1)
        resp = self.client.get(f'/api/properties/{self.prop2.id}/')
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_units_filtered_by_property_param(self):
        self.auth(self.manager1)
        resp = self.client.get(f'/api/units/?property={self.prop1.id}')
        self.assertEqual(len(resp.data['results']), 1)
        self.assertEqual(resp.data['results'][0]['id'], self.unit1.id)


class InviteFlowTests(PropizyTestBase):
    def test_staff_invite_and_register(self):
        self.auth(self.manager1)
        resp = self.client.post('/api/auth/staff-invites/', {'email': 'newstaff@test.com'})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        token = resp.data['token']
        self.assertIn('/staff-invite/', resp.data['invite_url'])

        preview = self.client.get(f'/api/auth/staff-invite/{token}/')
        self.assertEqual(preview.status_code, status.HTTP_200_OK)
        self.assertTrue(preview.data['is_valid'])

        self.client.force_authenticate(user=None)
        reg = self.client.post('/api/auth/register-staff/', {
            'invite_token': token,
            'username': 'newstaff',
            'password': 'pass12345',
        })
        self.assertEqual(reg.status_code, status.HTTP_201_CREATED)
        self.assertEqual(reg.data['user']['org_role'], 'STAFF')
        self.assertTrue(reg.data['user']['phone_verified'])

        member = OrganizationMember.objects.get(user__username='newstaff')
        self.assertEqual(member.organization, self.org1)
        self.assertEqual(member.role, OrganizationMember.Role.STAFF)

    def test_owner_can_remove_staff(self):
        staff = User.objects.create_user(
            username='removestaff', email='rs@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        member = OrganizationMember.objects.create(
            organization=self.org1, user=staff, role=OrganizationMember.Role.STAFF,
        )
        self.auth(self.manager1)
        resp = self.client.delete(f'/api/auth/team/{member.id}/')
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(OrganizationMember.objects.filter(id=member.id).exists())
        staff.refresh_from_db()
        self.assertFalse(staff.is_active)

    def test_staff_cannot_remove_team_member(self):
        staff = User.objects.create_user(
            username='staff2', email='s2@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        member = OrganizationMember.objects.create(
            organization=self.org1, user=staff, role=OrganizationMember.Role.STAFF,
        )
        self.auth(staff)
        resp = self.client.delete(f'/api/auth/team/{member.id}/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_invite_and_register(self):
        self.auth(self.manager1)
        resp = self.client.post('/api/auth/tenant-invites/', {
            'email': 'newtenant@test.com',
            'phone_number': '254700000099',
            'unit_id': self.unit1.id,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        token = resp.data['token']
        self.assertIn('/invite/', resp.data['invite_url'])

        preview = self.client.get(f'/api/auth/invite/{token}/')
        self.assertEqual(preview.status_code, status.HTTP_200_OK)
        self.assertTrue(preview.data['is_valid'])

        self.client.force_authenticate(user=None)
        reg = self.client.post('/api/auth/register-tenant/', {
            'invite_token': token,
            'username': 'newtenant',
            'password': 'pass12345',
        })
        self.assertEqual(reg.status_code, status.HTTP_201_CREATED)
        self.assertEqual(reg.data['role'], 'TENANT')

        lease = Lease.objects.filter(tenant__user__username='newtenant', is_active=True)
        self.assertTrue(lease.exists())
        self.unit1.refresh_from_db()
        self.assertEqual(self.unit1.status, Unit.Status.OCCUPIED)

    def test_expired_invite_rejected(self):
        invite = TenantInvite.objects.create(
            email='exp@test.com', phone_number='254700000001',
            organization=self.org1, unit=self.unit1,
            invited_by=self.manager1,
            expires_at=timezone.now() - timedelta(days=1),
        )
        resp = self.client.post('/api/auth/register-tenant/', {
            'invite_token': str(invite.token),
            'username': 'expuser',
            'password': 'pass12345',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class PaymentTests(PropizyTestBase):
    def setUp(self):
        super().setUp()
        self.tenant_user = User.objects.create_user(
            username='tenant1', email='t1@test.com', password='pass12345',
            role=User.Role.TENANT, manager=self.manager1,
        )
        self.profile = TenantProfile.objects.create(
            user=self.tenant_user, phone_number='254712345001', current_unit=self.unit1,
        )
        self.unit1.status = Unit.Status.OCCUPIED
        self.unit1.save()
        self.lease = Lease.objects.create(
            tenant=self.profile, unit=self.unit1,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=365),
            rent_amount=Decimal('10000'), is_active=True,
        )

    def test_payment_simulation(self):
        self.auth(self.tenant_user)
        resp = self.client.post('/api/payments/initiate/', {
            'amount': '10000.00',
            'phone_number': '254712345001',
            'lease_id': self.lease.id,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['status'], 'completed')

    def test_partial_payment_accepted(self):
        self.auth(self.tenant_user)
        resp = self.client.post('/api/payments/initiate/', {
            'amount': '5000.00',
            'phone_number': '254712345001',
            'lease_id': self.lease.id,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(resp.data['rent_applied']), Decimal('5000.00'))

    def test_second_payment_credits_wallet_when_month_paid(self):
        self.auth(self.tenant_user)
        payload = {
            'amount': '10000.00',
            'phone_number': '254712345001',
            'lease_id': self.lease.id,
        }
        first = self.client.post('/api/payments/initiate/', payload)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post('/api/payments/initiate/', payload)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(second.data['wallet_credit']), Decimal('10000.00'))

        from payments.models import TenantWallet, WalletTransaction
        wallet = TenantWallet.objects.get(tenant=self.profile)
        self.assertEqual(wallet.balance, Decimal('0.00'))
        self.assertEqual(
            WalletTransaction.objects.filter(
                wallet=wallet, transaction_type=WalletTransaction.Type.DEBIT,
            ).count(),
            1,
        )


class DashboardTests(PropizyTestBase):
    def test_dashboard_returns_stats(self):
        self.auth(self.manager1)
        resp = self.client.get('/api/auth/dashboard/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('properties', resp.data)
        self.assertIn('occupancy_rate', resp.data)
        self.assertIn('active_leases', resp.data)
        self.assertIn('monthly_trend', resp.data)
        self.assertEqual(resp.data['properties'], 1)


from .security_tests import SecurityPenetrationTests  # noqa: E402, F401
