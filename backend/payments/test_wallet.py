"""Wallet feature tests."""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from payments.models import Payment, TenantWallet, WalletTransaction
from payments.wallet import get_month_rent_covered, is_month_fully_paid
from properties.models import Lease, Property, TenantProfile, Unit
from users.models import Organization, OrganizationMember

User = get_user_model()


class WalletTestBase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = User.objects.create_user(
            username='wallet_mgr', email='wm@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        self.org = Organization.objects.create(
            name='Wallet Org', slug='wallet-org',
            property_manager_id=self.manager.property_manager_id, owner=self.manager,
        )
        OrganizationMember.objects.create(
            organization=self.org, user=self.manager, role=OrganizationMember.Role.OWNER,
        )
        self.property = Property.objects.create(
            manager=self.manager, name='Wallet Prop', address='Addr', total_units=1,
        )
        self.unit = Unit.objects.create(
            property=self.property, unit_number='01', rent_amount=Decimal('10000'), status=Unit.Status.OCCUPIED,
        )
        self.tenant_user = User.objects.create_user(
            username='wallet_tenant', email='wt@test.com', password='pass12345',
            role=User.Role.TENANT, manager=self.manager,
        )
        self.profile = TenantProfile.objects.create(
            user=self.tenant_user, phone_number='254712345001', current_unit=self.unit,
        )
        self.lease = Lease.objects.create(
            tenant=self.profile, unit=self.unit,
            start_date=timezone.now().date().replace(day=1),
            end_date=timezone.now().date() + timedelta(days=365),
            rent_amount=Decimal('10000'), is_active=True,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def pay(self, amount='10000.00'):
        return self.client.post('/api/payments/initiate/', {
            'amount': amount,
            'phone_number': '254712345001',
            'lease_id': self.lease.id,
        })


class WalletPaymentTests(WalletTestBase):
    def test_partial_payment_then_wallet_top_up(self):
        self.auth(self.tenant_user)
        first = self.pay('5000.00')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(first.data['rent_applied']), Decimal('5000.00'))
        self.assertEqual(Decimal(first.data['wallet_credit']), Decimal('0'))

        payment = Payment.objects.get(id=first.data['payment_id'])
        self.assertEqual(payment.rent_applied, Decimal('5000.00'))
        self.assertFalse(is_month_fully_paid(self.lease, payment.month_paid))

        second = self.pay('8000.00')
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(second.data['rent_applied']), Decimal('5000.00'))
        self.assertEqual(Decimal(second.data['wallet_credit']), Decimal('3000.00'))

        wallet = TenantWallet.objects.get(tenant=self.profile)
        self.assertEqual(wallet.balance, Decimal('3000.00'))

    def test_second_full_payment_after_month_paid_goes_to_wallet(self):
        self.auth(self.tenant_user)
        first = self.pay('10000.00')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        month = Payment.objects.get(id=first.data['payment_id']).month_paid
        self.assertTrue(is_month_fully_paid(self.lease, month))

        second = self.pay('10000.00')
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(second.data['wallet_credit']), Decimal('10000.00'))
        self.assertEqual(Decimal(second.data['rent_applied']), Decimal('0'))

        wallet = TenantWallet.objects.get(tenant=self.profile)
        self.assertEqual(wallet.balance, Decimal('0.00'))
        self.assertEqual(
            WalletTransaction.objects.filter(
                wallet=wallet, transaction_type=WalletTransaction.Type.DEBIT,
            ).count(),
            1,
        )

    def test_wallet_auto_applies_to_next_month(self):
        self.auth(self.tenant_user)
        self.pay('10000.00')
        second = self.pay('10000.00')
        self.assertEqual(Decimal(second.data['wallet_credit']), Decimal('10000.00'))

        wallet = TenantWallet.objects.get(tenant=self.profile)
        self.assertEqual(wallet.balance, Decimal('0.00'))
        debits = WalletTransaction.objects.filter(
            wallet=wallet, transaction_type=WalletTransaction.Type.DEBIT,
        )
        self.assertEqual(debits.count(), 1)
        self.assertTrue(is_month_fully_paid(self.lease, debits.first().rent_month))

    def test_wallet_api_returns_balance_and_transactions(self):
        self.auth(self.tenant_user)
        self.pay('15000.00')

        resp = self.client.get('/api/payments/wallet/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('wallet', resp.data)
        self.assertIn('transactions', resp.data)
        self.assertTrue(len(resp.data['transactions']) >= 1)
