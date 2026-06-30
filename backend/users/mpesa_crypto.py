import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _fernet():
    # Prefer a dedicated encryption key so rotating SECRET_KEY does not silently
    # break all stored M-PESA credentials. Falls back to SECRET_KEY for existing
    # deployments that have not yet set MPESA_ENCRYPTION_KEY.
    key_material = getattr(settings, 'MPESA_ENCRYPTION_KEY', '').strip() or settings.SECRET_KEY
    digest = hashlib.sha256(key_material.encode()).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_secret(value):
    if not value:
        return ''
    return _fernet().encrypt(value.encode()).decode()


def decrypt_secret(value):
    if not value:
        return ''
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        return ''
