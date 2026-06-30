import base64
import json
import uuid
from datetime import datetime

import requests
from django.conf import settings


class MpesaService:
    def __init__(
        self,
        credentials=None,
        *,
        callback_url=None,
        base_url=None,
    ):
        creds = credentials or {}
        self.consumer_key = creds.get('consumer_key', '')
        self.consumer_secret = creds.get('consumer_secret', '')
        self.shortcode = creds.get('shortcode', '')
        self.passkey = creds.get('passkey', '')
        self.transaction_type = creds.get('transaction_type', 'CustomerPayBillOnline')
        self.callback_url = callback_url or settings.MPESA_CALLBACK_URL
        env = creds.get('mpesa_env', settings.MPESA_ENV)
        self.base_url = base_url or (
            'https://sandbox.safaricom.co.ke'
            if env == 'sandbox'
            else 'https://api.safaricom.co.ke'
        )

    @classmethod
    def from_org_config(cls, config):
        if config is None or config.channel != config.Channel.STK:
            return cls(credentials={})
        creds = config.get_stk_credentials()
        if not creds:
            return cls(credentials={})
        return cls(credentials=creds, callback_url=settings.MPESA_CALLBACK_URL)

    def get_access_token(self):
        if not self.consumer_key or not self.consumer_secret:
            return 'sandbox-mock-token'

        url = f'{self.base_url}/oauth/v1/generate?grant_type=client_credentials'
        auth = base64.b64encode(
            f'{self.consumer_key}:{self.consumer_secret}'.encode()
        ).decode()
        response = requests.get(
            url,
            headers={'Authorization': f'Basic {auth}'},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()['access_token']

    def _generate_password(self):
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        data = f'{self.shortcode}{self.passkey}{timestamp}'
        password = base64.b64encode(data.encode()).decode()
        return password, timestamp

    def stk_push(self, phone_number, amount, account_reference, transaction_desc):
        """Initiate STK Push. Falls back to simulation when org credentials are missing."""
        transaction_id = str(uuid.uuid4())
        checkout_request_id = f'ws_CO_{int(datetime.now().timestamp())}'

        if not self.consumer_key or not self.consumer_secret or not self.passkey or not self.shortcode:
            return {
                'success': True,
                'simulated': True,
                'transaction_id': transaction_id,
                'checkout_request_id': checkout_request_id,
                'merchant_request_id': str(uuid.uuid4()),
                'response_description': 'STK Push simulated (organization M-PESA credentials not configured)',
            }

        phone = self._format_phone(phone_number)
        password, timestamp = self._generate_password()
        access_token = self.get_access_token()

        url = f'{self.base_url}/mpesa/stkpush/v1/processrequest'
        payload = {
            'BusinessShortCode': self.shortcode,
            'Password': password,
            'Timestamp': timestamp,
            'TransactionType': self.transaction_type,
            'Amount': int(amount),
            'PartyA': phone,
            'PartyB': self.shortcode,
            'PhoneNumber': phone,
            'CallBackURL': self.callback_url,
            'AccountReference': account_reference,
            'TransactionDesc': transaction_desc,
        }
        response = requests.post(
            url,
            json=payload,
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json',
            },
            timeout=30,
        )
        data = response.json()
        return {
            'success': response.status_code == 200,
            'simulated': False,
            'transaction_id': transaction_id,
            'checkout_request_id': data.get('CheckoutRequestID', checkout_request_id),
            'merchant_request_id': data.get('MerchantRequestID', ''),
            'response_description': data.get('ResponseDescription', data.get('errorMessage', '')),
            'raw': data,
        }

    @staticmethod
    def _format_phone(phone):
        phone = phone.strip().replace(' ', '').replace('-', '')
        if phone.startswith('+'):
            phone = phone[1:]
        if phone.startswith('0'):
            phone = '254' + phone[1:]
        if not phone.startswith('254'):
            phone = '254' + phone
        return phone

    @staticmethod
    def parse_callback(body):
        """Parse Safaricom STK callback payload."""
        if isinstance(body, str):
            body = json.loads(body)
        stk_callback = body.get('Body', {}).get('stkCallback', {})
        result_code = stk_callback.get('ResultCode')
        checkout_request_id = stk_callback.get('CheckoutRequestID', '')
        callback_metadata = stk_callback.get('CallbackMetadata', {})
        items = callback_metadata.get('Item', []) if callback_metadata else []

        metadata = {}
        for item in items:
            metadata[item.get('Name')] = item.get('Value')

        return {
            'success': result_code == 0,
            'result_code': result_code,
            'result_desc': stk_callback.get('ResultDesc', ''),
            'checkout_request_id': checkout_request_id,
            'mpesa_receipt_number': metadata.get('MpesaReceiptNumber', ''),
            'amount': metadata.get('Amount'),
            'phone_number': metadata.get('PhoneNumber'),
            'transaction_date': metadata.get('TransactionDate'),
        }
