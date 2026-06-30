import hashlib
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from payments.notifications import send_sms

CODE_LENGTH = 6
CODE_TTL_MINUTES = 10


def normalize_phone(phone_number):
    digits = re.sub(r'\D', '', phone_number or '')
    if digits.startswith('0') and len(digits) == 10:
        digits = f'254{digits[1:]}'
    return digits


def mask_phone(phone_number):
    digits = normalize_phone(phone_number)
    if len(digits) <= 3:
        return '*' * len(digits)
    return '*' * (len(digits) - 3) + digits[-3:]


def generate_code():
    return f'{secrets.randbelow(10 ** CODE_LENGTH):0{CODE_LENGTH}d}'


def _hash_code(code):
    return hashlib.sha256(code.encode()).hexdigest()


def send_verification_code(user):
    from .models import PhoneVerificationCode

    if not user.phone_number:
        raise ValueError('Phone number is required.')

    code = generate_code()
    expires_at = timezone.now() + timedelta(minutes=CODE_TTL_MINUTES)
    PhoneVerificationCode.objects.update_or_create(
        user=user,
        defaults={'code': _hash_code(code), 'expires_at': expires_at},
    )

    message = f'Your Propizy verification code is {code}. Valid for {CODE_TTL_MINUTES} minutes.'
    sms_result = send_sms(user.phone_number, message)

    payload = {
        'masked_phone': mask_phone(user.phone_number),
        'expires_in_minutes': CODE_TTL_MINUTES,
        'sms_simulated': sms_result.get('simulated', True),
    }
    if settings.DEBUG and sms_result.get('simulated'):
        payload['dev_code'] = code
    return payload


def verify_code(user, code):
    from .models import PhoneVerificationCode

    try:
        record = user.phone_verification
    except PhoneVerificationCode.DoesNotExist:
        return False, 'No verification code found. Request a new code.'

    if record.expires_at < timezone.now():
        return False, 'Verification code has expired. Request a new code.'
    if record.code != _hash_code(str(code).strip()):
        return False, 'Invalid verification code.'

    user.phone_verified = True
    user.save(update_fields=['phone_verified'])
    record.delete()
    return True, None
