import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def send_sms(phone_number, message):
    """
    Send SMS via Africa's Talking when configured, otherwise simulate.
    Set AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME in .env for live SMS.
    """
    api_key = getattr(settings, 'AFRICASTALKING_API_KEY', '')
    username = getattr(settings, 'AFRICASTALKING_USERNAME', '')

    if api_key and username:
        try:
            import requests
            response = requests.post(
                'https://api.africastalking.com/version1/messaging',
                headers={'apiKey': api_key, 'Accept': 'application/json'},
                data={'username': username, 'to': phone_number, 'message': message},
                timeout=10,
            )
            if response.status_code == 201:
                return {'success': True, 'simulated': False, 'provider': 'africastalking'}
            logger.warning(
                'Africa\'s Talking SMS failed (%s): %s',
                response.status_code,
                response.text[:500],
            )
            return {
                'success': False,
                'simulated': True,
                'provider': 'simulation',
                'error': f'SMS provider error ({response.status_code})',
            }
        except Exception as exc:
            logger.warning('Africa\'s Talking SMS error: %s', exc)
            return {
                'success': False,
                'simulated': True,
                'provider': 'simulation',
                'error': str(exc),
            }

    if settings.DEBUG:
        print(f'[SMS SIMULATION] To: {phone_number} | {message}')
    return {'success': True, 'simulated': True, 'provider': 'simulation'}
