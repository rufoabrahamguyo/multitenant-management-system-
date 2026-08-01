from django.test import SimpleTestCase

from users.phone_verification import mask_phone, normalize_phone


class PhoneNormalizationTests(SimpleTestCase):
    def test_strips_non_digits(self):
        self.assertEqual(normalize_phone('+254 700 111 222'), '254700111222')

    def test_local_zero_prefix_to_kenya(self):
        self.assertEqual(normalize_phone('0700111222'), '254700111222')

    def test_mask_keeps_last_three(self):
        self.assertEqual(mask_phone('254700111222'), '*********222')

    def test_mask_short_number(self):
        self.assertEqual(mask_phone('12'), '**')
