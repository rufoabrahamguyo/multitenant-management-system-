"""Unit tests for pure payment helpers (no HTTP)."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from payments.wallet import preview_payment_allocation


class PreviewPaymentAllocationTests(SimpleTestCase):
    def test_full_amount_applies_to_rent_when_unpaid(self):
        lease = SimpleNamespace(rent_amount=Decimal('10000'))
        with patch('payments.wallet.get_month_rent_covered', return_value=Decimal('0')):
            result = preview_payment_allocation(lease, rent_month=None, amount=Decimal('10000'))
        self.assertEqual(result['rent_applied'], Decimal('10000'))
        self.assertEqual(result['wallet_credit'], Decimal('0'))
        self.assertEqual(result['month_remaining_after'], Decimal('0'))

    def test_overpayment_credits_wallet(self):
        lease = SimpleNamespace(rent_amount=Decimal('10000'))
        with patch('payments.wallet.get_month_rent_covered', return_value=Decimal('0')):
            result = preview_payment_allocation(lease, rent_month=None, amount=Decimal('12500'))
        self.assertEqual(result['rent_applied'], Decimal('10000'))
        self.assertEqual(result['wallet_credit'], Decimal('2500'))

    def test_partial_cover_when_month_already_partly_paid(self):
        lease = SimpleNamespace(rent_amount=Decimal('10000'))
        with patch('payments.wallet.get_month_rent_covered', return_value=Decimal('4000')):
            result = preview_payment_allocation(lease, rent_month=None, amount=Decimal('3000'))
        self.assertEqual(result['rent_applied'], Decimal('3000'))
        self.assertEqual(result['wallet_credit'], Decimal('0'))
        self.assertEqual(result['month_remaining_after'], Decimal('3000'))
