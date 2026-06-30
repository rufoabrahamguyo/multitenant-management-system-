from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from maintenance.views import MaintenanceViewSet
from payments.advanced_views import (
    CashCollectionViewSet,
    EvidenceBundleView,
    ReconciliationView,
    TaxExportView,
    UtilityChargeViewSet,
)
from payments.views import PaymentViewSet
from properties.transfer_views import (
    UnitAvailabilityView,
    UnitCategoryViewSet,
    UnitTransferRequestViewSet,
)
from properties.views import LeaseViewSet, PropertyViewSet, TenantLeaseViewSet, TenantViewSet, UnitViewSet

router = DefaultRouter()
router.register(r'properties', PropertyViewSet, basename='property')
router.register(r'unit-categories', UnitCategoryViewSet, basename='unit-category')
router.register(r'transfer-requests', UnitTransferRequestViewSet, basename='transfer-request')
router.register(r'units', UnitViewSet, basename='unit')
router.register(r'tenants', TenantViewSet, basename='tenant')
router.register(r'leases', LeaseViewSet, basename='lease')
router.register(r'my-lease', TenantLeaseViewSet, basename='my-lease')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'cash-collections', CashCollectionViewSet, basename='cash-collection')
router.register(r'utilities', UtilityChargeViewSet, basename='utility')
router.register(r'maintenance', MaintenanceViewSet, basename='maintenance')

def health(_request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path(f'{settings.ADMIN_URL}/', admin.site.urls),
    path('api/health/', health, name='health'),
    path('api/auth/', include('users.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/reconciliation/', ReconciliationView.as_view(), name='reconciliation'),
    path('api/tax-export/', TaxExportView.as_view(), name='tax-export'),
    path('api/tenants/<int:tenant_id>/evidence-bundle/', EvidenceBundleView.as_view(), name='evidence-bundle'),
    path('api/unit-availability/', UnitAvailabilityView.as_view(), name='unit-availability'),
    path('api/', include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
