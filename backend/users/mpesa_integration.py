from django.utils import timezone

from users.activity import log_activity
from users.models import MpesaIntegrationRequest, OrganizationMpesaConfig, OwnerAlert


def get_latest_open_request(organization):
    return (
        MpesaIntegrationRequest.objects.filter(
            organization=organization,
            status__in=[
                MpesaIntegrationRequest.Status.PENDING,
                MpesaIntegrationRequest.Status.IN_PROGRESS,
            ],
        )
        .order_by('-created_at')
        .first()
    )


def complete_mpesa_integration(request, *, consumer_key, consumer_secret, passkey, reviewed_by, mpesa_env='production'):
    """Apply Daraja credentials to the org config and close the integration request."""
    config, _ = OrganizationMpesaConfig.objects.get_or_create(organization=request.organization)
    config.channel = OrganizationMpesaConfig.Channel.STK
    config.shortcode = request.shortcode.strip()
    config.account_number = (request.account_number or '').strip()
    config.mpesa_env = mpesa_env
    config.set_consumer_key(consumer_key)
    config.set_consumer_secret(consumer_secret)
    config.set_passkey(passkey)
    config.save()

    request.status = MpesaIntegrationRequest.Status.COMPLETED
    request.reviewed_by = reviewed_by
    request.reviewed_at = timezone.now()
    request.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])

    OwnerAlert.objects.create(
        organization=request.organization,
        alert_type=OwnerAlert.AlertType.INTEGRITY,
        message=(
            f'M-PESA integration is live for {request.get_channel_display()} '
            f'{request.shortcode}. Tenants can now pay via STK Push.'
        ),
        resource=f'mpesa_request:{request.id}',
        severity=OwnerAlert.Severity.LOW,
    )

    owner = request.organization.owner
    if owner and owner.email:
        from users.tasks import send_mpesa_complete_email_task
        send_mpesa_complete_email_task.delay(request.id, owner.email)

    log_activity(
        reviewed_by,
        'mpesa_integration_completed',
        request.shortcode,
        f'org:{request.organization_id}',
    )
    return config


def notify_ops_team(request):
    from users.tasks import send_mpesa_ops_email_task
    send_mpesa_ops_email_task.delay(request.id)
    return {'queued': True}
