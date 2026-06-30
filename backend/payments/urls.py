from django.urls import path

from .views import InitiatePaymentView, MpesaCallbackView, PaymentStatusView, WalletView

urlpatterns = [
    path('initiate/', InitiatePaymentView.as_view(), name='payment-initiate'),
    path('wallet/', WalletView.as_view(), name='payment-wallet'),
    path('mpesa-callback/', MpesaCallbackView.as_view(), name='mpesa-callback'),
    path('payment-status/<int:pk>/', PaymentStatusView.as_view(), name='payment-status'),
]
