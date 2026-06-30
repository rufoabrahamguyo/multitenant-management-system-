from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from properties.models import Lease, Property, TenantProfile, Unit
from users.models import Organization, OrganizationMember, OrganizationMpesaConfig

User = get_user_model()


class OrganizationMpesaConfigTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='mpesa_owner', email='owner@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        self.other_owner = User.objects.create_user(
            username='mpesa_other', email='other@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        self.org = Organization.objects.create(
            name='Mpesa Org', slug='mpesa-org',
            property_manager_id=self.owner.property_manager_id, owner=self.owner,
        )
        self.other_org = Organization.objects.create(
            name='Other Org', slug='other-org',
            property_manager_id=self.other_owner.property_manager_id, owner=self.other_owner,
        )
        OrganizationMember.objects.create(
            organization=self.org, user=self.owner, role=OrganizationMember.Role.OWNER,
        )
        OrganizationMember.objects.create(
            organization=self.other_org, user=self.other_owner, role=OrganizationMember.Role.OWNER,
        )

    def test_owner_can_save_encrypted_credentials_without_exposing_secrets(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.put('/api/auth/mpesa-config/', {
            'channel': 'stk',
            'shortcode': '174379',
            'mpesa_env': 'sandbox',
            'consumer_key': 'org-key-123',
            'consumer_secret': 'org-secret-456',
            'passkey': 'org-passkey-789',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['stk_configured'])
        self.assertTrue(resp.data['consumer_key_set'])
        self.assertNotIn('org-secret-456', str(resp.data))
        self.assertNotIn('consumer_secret', [k for k, v in resp.data.items() if v == 'org-secret-456'])

        config = OrganizationMpesaConfig.objects.get(organization=self.org)
        creds = config.get_stk_credentials()
        self.assertEqual(creds['consumer_key'], 'org-key-123')
        self.assertEqual(creds['consumer_secret'], 'org-secret-456')
        self.assertEqual(creds['passkey'], 'org-passkey-789')

    def test_blank_secret_fields_do_not_clear_existing_credentials(self):
        config, _ = OrganizationMpesaConfig.objects.get_or_create(organization=self.org)
        config.set_consumer_key('keep-me')
        config.set_consumer_secret('keep-secret')
        config.set_passkey('keep-pass')
        config.shortcode = '174379'
        config.save()

        self.client.force_authenticate(user=self.owner)
        resp = self.client.put('/api/auth/mpesa-config/', {
            'shortcode': '600000',
            'consumer_key': '',
            'consumer_secret': '',
            'passkey': '',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        config.refresh_from_db()
        self.assertEqual(config.get_stk_credentials()['consumer_key'], 'keep-me')
        self.assertEqual(config.shortcode, '600000')


class InitiatePaymentOrgMpesaTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='pay_owner', email='pay@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        self.org = Organization.objects.create(
            name='Pay Org', slug='pay-org',
            property_manager_id=self.owner.property_manager_id, owner=self.owner,
        )
        OrganizationMember.objects.create(
            organization=self.org, user=self.owner, role=OrganizationMember.Role.OWNER,
        )
        self.property = Property.objects.create(
            manager=self.owner, name='Pay Prop', address='Nairobi', total_units=1,
        )
        self.unit = Unit.objects.create(
            property=self.property, unit_number='A1', rent_amount=Decimal('15000'),
        )
        self.tenant_user = User.objects.create_user(
            username='pay_tenant', role=User.Role.TENANT, manager=self.owner, password='pass12345',
        )
        self.tenant = TenantProfile.objects.create(user=self.tenant_user, phone_number='254712345678')
        self.lease = Lease.objects.create(
            tenant=self.tenant, unit=self.unit,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=365),
            rent_amount=Decimal('15000'), is_active=True,
        )

    @patch('payments.views.MpesaService.from_org_config')
    def test_initiate_payment_uses_org_mpesa_service(self, mock_from_org):
        config, _ = OrganizationMpesaConfig.objects.get_or_create(organization=self.org)
        config.channel = OrganizationMpesaConfig.Channel.STK
        config.shortcode = '174379'
        config.set_consumer_key('key')
        config.set_consumer_secret('secret')
        config.set_passkey('pass')
        config.save()

        mock_service = mock_from_org.return_value
        mock_service.stk_push.return_value = {
            'success': True,
            'simulated': False,
            'checkout_request_id': 'ws_CO_test',
            'transaction_id': 'tx-1',
        }

        self.client.force_authenticate(user=self.tenant_user)
        resp = self.client.post('/api/payments/initiate/', {
            'lease_id': self.lease.id,
            'amount': '15000.00',
            'phone_number': '254712345678',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        mock_from_org.assert_called_once()
        passed_config = mock_from_org.call_args[0][0]
        self.assertEqual(passed_config.organization_id, self.org.id)
        mock_service.stk_push.assert_called_once()
        self.assertEqual(mock_service.stk_push.call_args.kwargs['account_reference'], f'RENT-{self.lease.id}')

    def test_initiate_payment_rejects_manual_paybill_channel(self):
        config, _ = OrganizationMpesaConfig.objects.get_or_create(organization=self.org)
        config.channel = OrganizationMpesaConfig.Channel.PAYBILL
        config.save()

        self.client.force_authenticate(user=self.tenant_user)
        resp = self.client.post('/api/payments/initiate/', {
            'lease_id': self.lease.id,
            'amount': '15000.00',
            'phone_number': '254712345678',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('payments.views.MpesaService.from_org_config')
    def test_initiate_payment_simulates_when_org_not_configured(self, mock_from_org):
        mock_service = mock_from_org.return_value
        mock_service.stk_push.return_value = {
            'success': True,
            'simulated': True,
            'checkout_request_id': 'ws_CO_sim',
            'transaction_id': 'tx-sim',
        }

        self.client.force_authenticate(user=self.tenant_user)
        resp = self.client.post('/api/payments/initiate/', {
            'lease_id': self.lease.id,
            'amount': '15000.00',
            'phone_number': '254712345678',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data['simulated'])
