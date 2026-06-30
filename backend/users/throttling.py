from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AuthRateThrottle(AnonRateThrottle):
    scope = 'auth'


class PhoneVerifyRateThrottle(UserRateThrottle):
    scope = 'phone_verify'


class PaymentInitiateThrottle(UserRateThrottle):
    scope = 'payment_initiate'
