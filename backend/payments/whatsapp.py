import urllib.parse


def build_whatsapp_link(phone_number, message):
    """
    Generate click-to-WhatsApp link for arrears reminders.
    Phone should be in international format without + (e.g. 254712345678).
    """
    digits = ''.join(c for c in phone_number if c.isdigit())
    if digits.startswith('0'):
        digits = '254' + digits[1:]
    elif not digits.startswith('254'):
        digits = '254' + digits[-9:] if len(digits) >= 9 else digits

    encoded = urllib.parse.quote(message)
    return f'https://wa.me/{digits}?text={encoded}'


def arrears_whatsapp_message(tenant_name, total_owed, months_count, property_name):
    return (
        f'Hello {tenant_name}, this is a rent reminder from Propizy regarding {property_name}. '
        f'You have KES {total_owed:,.0f} outstanding for {months_count} month(s). '
        f'Please pay via the Propizy app or contact your property manager. Thank you.'
    )
