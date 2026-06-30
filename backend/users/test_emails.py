from django.core import mail
from django.test import TestCase, override_settings

from users.emails import (
    send_staff_invite_email,
    send_tenant_invite_email,
    staff_invite_web_url,
    tenant_invite_app_url,
    tenant_invite_web_url,
)
from users.models import Organization, OrganizationMember, TenantInvite
from users.tests import PropizyTestBase


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='Propizy <test@propizy.app>',
    FRONTEND_URL='http://localhost:5173',
    MOBILE_APP_SCHEME='propizy',
)
class InviteEmailTests(PropizyTestBase):
    def test_tenant_invite_urls(self):
        from datetime import timedelta
        from django.utils import timezone

        invite = TenantInvite.objects.create(
            email='tenant@example.com',
            phone_number='254700000099',
            organization=self.org1,
            unit=self.unit1,
            invited_by=self.manager1,
            expires_at=timezone.now() + timedelta(days=7),
        )

        self.assertIn('/invite/', tenant_invite_web_url(invite.token))
        self.assertTrue(tenant_invite_app_url(invite.token).startswith('propizy://invite/'))

    def test_send_tenant_invite_email(self):
        from django.utils import timezone
        from datetime import timedelta

        invite = TenantInvite.objects.create(
            email='tenant@example.com',
            phone_number='254700000099',
            organization=self.org1,
            unit=self.unit1,
            invited_by=self.manager1,
            expires_at=timezone.now() + timedelta(days=7),
        )
        result = send_tenant_invite_email(invite)
        self.assertTrue(result['success'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['tenant@example.com'])
        self.assertIn('Org One', mail.outbox[0].subject)
        self.assertIn('/invite/', mail.outbox[0].body)

    def test_tenant_invite_api_sends_email(self):
        self.auth(self.manager1)
        resp = self.client.post('/api/auth/tenant-invites/', {
            'email': 'newtenant@test.com',
            'phone_number': '254700000099',
            'unit_id': self.unit1.id,
        })
        self.assertEqual(resp.status_code, 201)
        self.assertIn('/invite/', resp.data['invite_url'])
        self.assertTrue(resp.data['app_invite_url'].startswith('propizy://'))
        self.assertTrue(resp.data['email_sent'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['newtenant@test.com'])

    def test_staff_invite_api_sends_email(self):
        self.auth(self.manager1)
        resp = self.client.post('/api/auth/staff-invites/', {'email': 'newstaff@test.com'})
        self.assertEqual(resp.status_code, 201)
        self.assertIn('/staff-invite/', resp.data['invite_url'])
        self.assertTrue(resp.data['email_sent'])
        self.assertEqual(len(mail.outbox), 1)

    def test_staff_invite_web_url(self):
        from users.models import StaffInvite
        from django.utils import timezone
        from datetime import timedelta

        invite = StaffInvite.objects.create(
            email='staff@example.com',
            organization=self.org1,
            invited_by=self.manager1,
            expires_at=timezone.now() + timedelta(days=7),
        )
        self.assertEqual(
            staff_invite_web_url(invite.token),
            f'http://localhost:5173/staff-invite/{invite.token}',
        )
        result = send_staff_invite_email(invite)
        self.assertTrue(result['success'])
