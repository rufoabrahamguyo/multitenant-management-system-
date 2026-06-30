from celery import shared_task


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_tenant_invite_email_task(self, invite_id):
    from .emails import send_tenant_invite_email
    from .models import TenantInvite
    try:
        invite = TenantInvite.objects.select_related(
            'unit__property', 'organization',
        ).get(id=invite_id)
    except TenantInvite.DoesNotExist:
        return
    result = send_tenant_invite_email(invite)
    if not result.get('success') and not result.get('simulated'):
        raise self.retry(exc=Exception(result.get('error', 'Email send failed')))


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_staff_invite_email_task(self, invite_id):
    from .emails import send_staff_invite_email
    from .models import StaffInvite
    try:
        invite = StaffInvite.objects.select_related('organization').get(id=invite_id)
    except StaffInvite.DoesNotExist:
        return
    result = send_staff_invite_email(invite)
    if not result.get('success') and not result.get('simulated'):
        raise self.retry(exc=Exception(result.get('error', 'Email send failed')))


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_password_reset_email_task(self, reset_token_id):
    from .emails import send_password_reset_email
    from .models import PasswordResetToken
    try:
        reset_token = PasswordResetToken.objects.select_related('user').get(id=reset_token_id)
    except PasswordResetToken.DoesNotExist:
        return
    result = send_password_reset_email(reset_token)
    if not result.get('success') and not result.get('simulated'):
        raise self.retry(exc=Exception(result.get('error', 'Email send failed')))


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_mpesa_ops_email_task(self, request_id):
    from .emails import send_mpesa_integration_ops_email
    from .models import MpesaIntegrationRequest
    try:
        req = MpesaIntegrationRequest.objects.select_related('organization').get(id=request_id)
    except MpesaIntegrationRequest.DoesNotExist:
        return
    result = send_mpesa_integration_ops_email(req)
    if not result.get('success') and not result.get('simulated'):
        raise self.retry(exc=Exception(result.get('error', 'Email send failed')))


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_mpesa_complete_email_task(self, request_id, owner_email):
    from .emails import send_mpesa_integration_complete_email
    from .models import MpesaIntegrationRequest
    try:
        req = MpesaIntegrationRequest.objects.get(id=request_id)
    except MpesaIntegrationRequest.DoesNotExist:
        return
    result = send_mpesa_integration_complete_email(req, owner_email)
    if not result.get('success') and not result.get('simulated'):
        raise self.retry(exc=Exception(result.get('error', 'Email send failed')))
