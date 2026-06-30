from django import forms
from django.contrib import admin, messages

from .models import MpesaIntegrationRequest, OrganizationMpesaConfig
from .mpesa_integration import complete_mpesa_integration


class MpesaIntegrationRequestAdminForm(forms.ModelForm):
    consumer_key = forms.CharField(
        required=False,
        widget=forms.PasswordInput(render_value=True),
        help_text='Daraja Consumer Key (required when marking as Completed)',
    )
    consumer_secret = forms.CharField(
        required=False,
        widget=forms.PasswordInput(render_value=True),
        help_text='Daraja Consumer Secret (required when marking as Completed)',
    )
    passkey = forms.CharField(
        required=False,
        widget=forms.PasswordInput(render_value=True),
        help_text='Online passkey (required when marking as Completed)',
    )
    mpesa_env = forms.ChoiceField(
        choices=OrganizationMpesaConfig.MpesaEnv.choices,
        initial=OrganizationMpesaConfig.MpesaEnv.PRODUCTION,
        required=False,
        help_text='Daraja environment to use for this organization',
    )

    class Meta:
        model = MpesaIntegrationRequest
        fields = '__all__'


@admin.register(MpesaIntegrationRequest)
class MpesaIntegrationRequestAdmin(admin.ModelAdmin):
    form = MpesaIntegrationRequestAdminForm
    list_display = [
        'organization', 'channel', 'shortcode', 'business_name', 'status', 'created_at',
    ]
    list_filter = ['status', 'channel', 'created_at']
    search_fields = ['organization__name', 'shortcode', 'business_name', 'mpesa_username']
    readonly_fields = ['requested_by', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at']
    fieldsets = (
        ('Organization request', {
            'fields': (
                'organization', 'requested_by', 'status', 'channel', 'shortcode',
                'business_name', 'mpesa_username', 'contact_phone', 'contact_email',
                'account_number', 'notes',
            ),
        }),
        ('Propizy team — complete integration', {
            'fields': ('consumer_key', 'consumer_secret', 'passkey', 'mpesa_env', 'admin_notes'),
            'description': (
                'Enter Daraja credentials and set status to Completed to activate STK Push '
                'for this organization.'
            ),
        }),
        ('Review', {
            'fields': ('reviewed_by', 'reviewed_at', 'created_at', 'updated_at'),
        }),
    )

    def save_model(self, request, obj, form, change):
        was_completed = False
        if change and obj.pk:
            was_completed = MpesaIntegrationRequest.objects.filter(
                pk=obj.pk, status=MpesaIntegrationRequest.Status.COMPLETED,
            ).exists()

        completing_now = (
            obj.status == MpesaIntegrationRequest.Status.COMPLETED and not was_completed
        )

        if completing_now:
            consumer_key = form.cleaned_data.get('consumer_key', '').strip()
            consumer_secret = form.cleaned_data.get('consumer_secret', '').strip()
            passkey = form.cleaned_data.get('passkey', '').strip()
            mpesa_env = form.cleaned_data.get('mpesa_env') or OrganizationMpesaConfig.MpesaEnv.PRODUCTION

            if not all([consumer_key, consumer_secret, passkey]):
                messages.error(
                    request,
                    'Consumer key, consumer secret, and passkey are required to complete integration.',
                )
                obj.status = MpesaIntegrationRequest.Status.IN_PROGRESS
                super().save_model(request, obj, form, change)
                return

            super().save_model(request, obj, form, change)
            complete_mpesa_integration(
                obj,
                consumer_key=consumer_key,
                consumer_secret=consumer_secret,
                passkey=passkey,
                reviewed_by=request.user,
                mpesa_env=mpesa_env,
            )
            messages.success(request, f'M-PESA integration completed for {obj.organization.name}.')
            return

        if obj.status == MpesaIntegrationRequest.Status.IN_PROGRESS and not obj.reviewed_by_id:
            obj.reviewed_by = request.user

        super().save_model(request, obj, form, change)
