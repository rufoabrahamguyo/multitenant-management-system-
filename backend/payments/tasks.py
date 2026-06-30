from celery import shared_task


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def generate_receipt_pdf_task(self, payment_id):
    from .models import Payment
    from .receipt import generate_receipt_pdf
    try:
        payment = Payment.objects.select_related(
            'tenant__user', 'lease__unit__property',
        ).get(id=payment_id)
    except Payment.DoesNotExist:
        return
    try:
        receipt_path = generate_receipt_pdf(payment)
        Payment.objects.filter(id=payment_id).update(receipt_pdf=receipt_path)
    except Exception as exc:
        raise self.retry(exc=exc)
