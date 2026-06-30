from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from users.models import MpesaIntegrationRequest, Organization, OrganizationMember, OrganizationMpesaConfig

User = get_user_model()


class MpesaIntegrationRequestApiTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='mpesa_req_owner',
            email='owner@test.com',
            password='pass12345',
            role=User.Role.MANAGER,
        )
        self.staff = User.objects.create_user(
            username='mpesa_req_staff',
            email='staff@test.com',
            password='pass12345',
            role=User.Role.MANAGER,
        )
        self.org = Organization.objects.create(
            name='Req Org',
            slug='req-org',
            property_manager_id=self.owner.property_manager_id,
            owner=self.owner,
        )
        OrganizationMember.objects.create(
            organization=self.org, user=self.owner, role=OrganizationMember.Role.OWNER,
        )
        OrganizationMember.objects.create(
            organization=self.org, user=self.staff, role=OrganizationMember.Role.STAFF,
        )

    def test_owner_can_submit_integration_request(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.post('/api/auth/mpesa-integration-request/', {
            'channel': 'till',
            'shortcode': '123456',
            'business_name': 'Sunrise Apartments',
            'mpesa_username': 'sunrise.admin',
            'contact_phone': '0712345678',
            'contact_email': 'owner@test.com',
            'notes': 'Till from Safaricom email',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn('Request received', resp.data['message'])
        self.assertEqual(resp.data['integration_request']['status'], 'pending')
        self.assertTrue(
            MpesaIntegrationRequest.objects.filter(organization=self.org, shortcode='123456').exists()
        )

    def test_staff_cannot_submit_integration_request(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.post('/api/auth/mpesa-integration-request/', {
            'channel': 'till',
            'shortcode': '123456',
            'business_name': 'Sunrise Apartments',
            'mpesa_username': 'sunrise.admin',
            'contact_phone': '0712345678',
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_duplicate_open_request_is_rejected(self):
        MpesaIntegrationRequest.objects.create(
            organization=self.org,
            requested_by=self.owner,
            channel=MpesaIntegrationRequest.Channel.TILL,
            shortcode='123456',
            business_name='Sunrise Apartments',
            mpesa_username='sunrise.admin',
            contact_phone='0712345678',
            status=MpesaIntegrationRequest.Status.PENDING,
        )
        self.client.force_authenticate(user=self.owner)
        resp = self.client.post('/api/auth/mpesa-integration-request/', {
            'channel': 'till',
            'shortcode': '999999',
            'business_name': 'Another',
            'mpesa_username': 'other',
            'contact_phone': '0799999999',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_returns_status_and_config_summary(self):
        MpesaIntegrationRequest.objects.create(
            organization=self.org,
            requested_by=self.owner,
            channel=MpesaIntegrationRequest.Channel.PAYBILL,
            shortcode='600100',
            business_name='Sunrise Apartments',
            mpesa_username='sunrise.admin',
            contact_phone='0712345678',
            status=MpesaIntegrationRequest.Status.IN_PROGRESS,
        )
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get('/api/auth/mpesa-integration-request/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data['mpesa_config']['stk_configured'])
        self.assertEqual(resp.data['integration_request']['status'], 'in_progress')

    def test_cannot_submit_when_already_configured(self):
        config, _ = OrganizationMpesaConfig.objects.get_or_create(organization=self.org)
        config.channel = OrganizationMpesaConfig.Channel.STK
        config.shortcode = '174379'
        config.set_consumer_key('key')
        config.set_consumer_secret('secret')
        config.set_passkey('pass')
        config.save()

        self.client.force_authenticate(user=self.owner)
        resp = self.client.post('/api/auth/mpesa-integration-request/', {
            'channel': 'till',
            'shortcode': '123456',
            'business_name': 'Sunrise Apartments',
            'mpesa_username': 'sunrise.admin',
            'contact_phone': '0712345678',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
