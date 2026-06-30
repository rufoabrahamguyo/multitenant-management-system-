import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def _frontend_base():
    return getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')


def tenant_invite_web_url(token):
    return f'{_frontend_base()}/invite/{token}'


def tenant_invite_app_url(token):
    scheme = getattr(settings, 'MOBILE_APP_SCHEME', 'propizy')
    return f'{scheme}://invite/{token}'


def staff_invite_web_url(token):
    return f'{_frontend_base()}/staff-invite/{token}'


def password_reset_web_url(token):
    return f'{_frontend_base()}/reset-password/{token}'


def _send_email(to, subject, text_message, html_message=None):
    """Send email via Django's configured backend (SMTP, console, or locmem)."""
    from_email = settings.DEFAULT_FROM_EMAIL
    backend = settings.EMAIL_BACKEND.lower()
    uses_smtp = 'smtp' in backend
    email_host = getattr(settings, 'EMAIL_HOST', '') or ''

    if uses_smtp and not email_host:
        logger.warning('EMAIL_HOST not configured; skipping email to %s', to)
        if settings.DEBUG:
            print(f'[EMAIL SIMULATION] To: {to}\nSubject: {subject}\n{text_message}')
            return {'success': True, 'simulated': True}
        return {'success': False, 'simulated': True, 'error': 'Email not configured'}

    try:
        send_mail(
            subject=subject,
            message=text_message,
            from_email=from_email,
            recipient_list=[to],
            html_message=html_message,
            fail_silently=False,
        )
        return {'success': True, 'simulated': not uses_smtp}
    except Exception as exc:
        logger.exception('Failed to send email to %s', to)
        return {'success': False, 'simulated': False, 'error': str(exc)}


def send_tenant_invite_email(invite):
    unit_label = (
        f'{invite.unit.property.name} - Unit {invite.unit.unit_number}'
        if invite.unit
        else 'your assigned unit'
    )
    org_name = invite.organization.name
    web_url = tenant_invite_web_url(invite.token)
    app_url = tenant_invite_app_url(invite.token)
    expires = invite.expires_at.strftime('%d %b %Y')

    subject = f'You\'re invited to join {org_name} on Propizy'
    text = (
        f'Hello,\n\n'
        f'You have been invited to join {org_name} as a tenant ({unit_label}).\n\n'
        f'Accept your invite and create your account:\n{web_url}\n\n'
        f'Or open directly in the Propizy mobile app:\n{app_url}\n\n'
        f'This invite expires on {expires}.\n\n'
        f'— Propizy Property Management'
    )
    html = (
        f'<p>Hello,</p>'
        f'<p>You have been invited to join <strong>{org_name}</strong> as a tenant '
        f'(<strong>{unit_label}</strong>).</p>'
        f'<p><a href="{web_url}" style="display:inline-block;padding:12px 24px;'
        f'background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;'
        f'font-weight:600;">Accept Invite</a></p>'
        f'<p style="font-size:14px;color:#64748b;">'
        f'Or open in the Propizy app: <a href="{app_url}">{app_url}</a></p>'
        f'<p style="font-size:13px;color:#94a3b8;">This invite expires on {expires}.</p>'
        f'<p>— Propizy Property Management</p>'
    )
    return _send_email(invite.email, subject, text, html)


def send_staff_invite_email(invite):
    org_name = invite.organization.name
    web_url = staff_invite_web_url(invite.token)
    expires = invite.expires_at.strftime('%d %b %Y')

    subject = f'You\'re invited to join {org_name} on Propizy'
    text = (
        f'Hello,\n\n'
        f'You have been invited to join {org_name} as a staff member on Propizy.\n\n'
        f'Create your account here:\n{web_url}\n\n'
        f'This invite expires on {expires}.\n\n'
        f'— Propizy Property Management'
    )
    html = (
        f'<p>Hello,</p>'
        f'<p>You have been invited to join <strong>{org_name}</strong> as a staff member.</p>'
        f'<p><a href="{web_url}" style="display:inline-block;padding:12px 24px;'
        f'background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;'
        f'font-weight:600;">Join as Staff</a></p>'
        f'<p style="font-size:13px;color:#94a3b8;">This invite expires on {expires}.</p>'
        f'<p>— Propizy Property Management</p>'
    )
    return _send_email(invite.email, subject, text, html)


def send_mpesa_integration_ops_email(request):
    ops_email = getattr(settings, 'MPESA_OPS_EMAIL', '').strip()
    if not ops_email:
        if settings.DEBUG:
            print(
                f'[MPESA OPS] New integration request from {request.organization.name}\n'
                f'Till/Paybill: {request.shortcode} ({request.get_channel_display()})\n'
                f'Business: {request.business_name}\n'
                f'M-PESA username: {request.mpesa_username}\n'
                f'Contact: {request.contact_phone} {request.contact_email}\n'
                f'Notes: {request.notes}'
            )
        return {'success': True, 'simulated': True}

    org_name = request.organization.name
    subject = f'[Propizy] New M-PESA integration request — {org_name}'
    text = (
        f'A new M-PESA integration request was submitted.\n\n'
        f'Organization: {org_name}\n'
        f'Payment type: {request.get_channel_display()}\n'
        f'Till/Paybill number: {request.shortcode}\n'
        f'Business name: {request.business_name}\n'
        f'M-PESA username: {request.mpesa_username}\n'
        f'Contact phone: {request.contact_phone}\n'
        f'Contact email: {request.contact_email or "—"}\n'
        f'Account number: {request.account_number or "—"}\n'
        f'Notes: {request.notes or "—"}\n\n'
        f'Review in Django admin and complete the Daraja setup.\n'
    )
    html = (
        f'<p>A new M-PESA integration request was submitted.</p>'
        f'<table style="border-collapse:collapse;font-size:14px;">'
        f'<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Organization</td>'
        f'<td><strong>{org_name}</strong></td></tr>'
        f'<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Payment type</td>'
        f'<td>{request.get_channel_display()}</td></tr>'
        f'<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Till/Paybill</td>'
        f'<td>{request.shortcode}</td></tr>'
        f'<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Business name</td>'
        f'<td>{request.business_name}</td></tr>'
        f'<tr><td style="padding:4px 12px 4px 0;color:#64748b;">M-PESA username</td>'
        f'<td>{request.mpesa_username}</td></tr>'
        f'<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Contact phone</td>'
        f'<td>{request.contact_phone}</td></tr>'
        f'<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Contact email</td>'
        f'<td>{request.contact_email or "—"}</td></tr>'
        f'<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Account number</td>'
        f'<td>{request.account_number or "—"}</td></tr>'
        f'<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Notes</td>'
        f'<td>{request.notes or "—"}</td></tr>'
        f'</table>'
        f'<p style="margin-top:16px;">Review in Django admin and complete the Daraja setup.</p>'
    )
    return _send_email(ops_email, subject, text, html)


def send_mpesa_integration_complete_email(request, owner_email):
    org_name = request.organization.name
    subject = f'M-PESA is live for {org_name}'
    text = (
        f'Hello,\n\n'
        f'Your M-PESA integration for {org_name} is now active.\n'
        f'Payment type: {request.get_channel_display()}\n'
        f'Number: {request.shortcode}\n\n'
        f'Tenants can now pay rent via M-PESA STK Push in the Propizy app.\n\n'
        f'— Propizy Property Management'
    )
    html = (
        f'<p>Hello,</p>'
        f'<p>Your M-PESA integration for <strong>{org_name}</strong> is now active.</p>'
        f'<p><strong>{request.get_channel_display()}</strong> · {request.shortcode}</p>'
        f'<p>Tenants can now pay rent via M-PESA STK Push in the Propizy app.</p>'
        f'<p>— Propizy Property Management</p>'
    )
    return _send_email(owner_email, subject, text, html)


def send_password_reset_email(reset_token):
    user = reset_token.user
    if not user.email:
        return {'success': False, 'simulated': False, 'error': 'User has no email'}

    web_url = password_reset_web_url(reset_token.token)
    expires = reset_token.expires_at.strftime('%d %b %Y %H:%M')

    subject = 'Reset your Propizy password'
    text = (
        f'Hello {user.username},\n\n'
        f'We received a request to reset your Propizy password.\n\n'
        f'Reset your password here:\n{web_url}\n\n'
        f'This link expires on {expires}.\n\n'
        f'If you did not request this, you can ignore this email.\n\n'
        f'— Propizy Property Management'
    )
    html = (
        f'<p>Hello <strong>{user.username}</strong>,</p>'
        f'<p>We received a request to reset your Propizy password.</p>'
        f'<p><a href="{web_url}" style="display:inline-block;padding:12px 24px;'
        f'background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;'
        f'font-weight:600;">Reset password</a></p>'
        f'<p style="font-size:13px;color:#94a3b8;">This link expires on {expires}.</p>'
        f'<p style="font-size:13px;color:#94a3b8;">If you did not request this, you can ignore this email.</p>'
        f'<p>— Propizy Property Management</p>'
    )
    return _send_email(user.email, subject, text, html)
