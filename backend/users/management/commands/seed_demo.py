"""Load presentation-ready demo data for Propizy."""

from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from maintenance.models import MaintenanceRequest
from payments.models import CashCollection, Payment, PaymentReminder, UtilityCharge
from properties.models import (
    Property,
    TenantProfile,
    Unit,
    UnitCategory,
    UnitTransferRequest,
)
from properties.services import create_lease_for_tenant, update_property_unit_count
from users.models import ActivityLog, Organization, OrganizationMember, OwnerAlert

User = get_user_model()

DEMO_DOMAIN = '@propizy.demo'
DEFAULT_PASSWORD = 'Demo2026!'
ORG_SLUG = 'demo-property-group'


def month_start(value: date) -> date:
    return value.replace(day=1)


def months_ago(n: int) -> date:
    today = date.today()
    month = today.month - n
    year = today.year
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1)


class Command(BaseCommand):
    help = 'Load demo data for presentations (owner, staff, tenants, payments, maintenance)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            default=DEFAULT_PASSWORD,
            help=f'Password for all demo accounts (default: {DEFAULT_PASSWORD})',
        )
        parser.add_argument(
            '--flush',
            action='store_true',
            help=f'Delete existing demo users ({DEMO_DOMAIN}) before seeding',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Re-seed even if demo data already exists (implies --flush)',
        )

    def handle(self, *args, **options):
        password = options['password']
        flush = options['flush'] or options['force']

        if Organization.objects.filter(slug=ORG_SLUG).exists():
            if not flush:
                self.stdout.write(
                    self.style.WARNING(
                        'Demo data already exists. Run with --flush or --force to replace it.',
                    ),
                )
                self._print_credentials(password)
                return
            User.objects.filter(email__endswith=DEMO_DOMAIN).delete()

        owner = self._create_owner(password)
        org = Organization.objects.get(slug=ORG_SLUG)
        staff = self._create_staff(org, password, username='rufina', email_prefix='rufina',
                                   first_name='Rufina', last_name='Achieng', phone='254798765432',
                                   role=OrganizationMember.Role.STAFF)
        self._create_staff(org, password, username='jillo', email_prefix='jillo',
                           first_name='Jillo', last_name='Bor', phone='254798765433',
                           role=OrganizationMember.Role.FRONT_DESK)
        self._create_staff(org, password, username='guyo', email_prefix='guyo',
                           first_name='Guyo', last_name='Duba', phone='254798765434',
                           role=OrganizationMember.Role.MAINTENANCE)

        prop_sunrise = Property.objects.create(
            manager=owner,
            name='Sunrise Apartments',
            address='Kilimani, Nairobi',
            total_units=0,
        )
        prop_greenview = Property.objects.create(
            manager=owner,
            name='Greenview Estate',
            address='Ruiru, Kiambu',
            total_units=0,
        )

        sunrise_studio = UnitCategory.objects.create(
            property_ref=prop_sunrise, name='Studio', description='Compact unit', sort_order=1,
        )
        sunrise_one_br = UnitCategory.objects.create(
            property_ref=prop_sunrise, name='1 Bedroom', description='Standard unit', sort_order=2,
        )
        greenview_premium = UnitCategory.objects.create(
            property_ref=prop_greenview, name='Premium', description='Large unit with balcony', sort_order=1,
        )
        greenview_studio = UnitCategory.objects.create(
            property_ref=prop_greenview, name='Studio', description='Affordable studio', sort_order=2,
        )

        units = {
            's_a1': Unit.objects.create(
                property=prop_sunrise, category=sunrise_studio, unit_number='A1',
                rent_amount=Decimal('12000'), status=Unit.Status.VACANT,
            ),
            's_a2': Unit.objects.create(
                property=prop_sunrise, category=sunrise_one_br, unit_number='A2',
                rent_amount=Decimal('18000'), status=Unit.Status.VACANT,
            ),
            's_b1': Unit.objects.create(
                property=prop_sunrise, category=sunrise_studio, unit_number='B1',
                rent_amount=Decimal('12500'), status=Unit.Status.VACANT,
            ),
            's_b2': Unit.objects.create(
                property=prop_sunrise, category=sunrise_one_br, unit_number='B2',
                rent_amount=Decimal('19000'), status=Unit.Status.VACANT,
            ),
            'g_p1': Unit.objects.create(
                property=prop_greenview, category=greenview_premium, unit_number='P1',
                rent_amount=Decimal('25000'), status=Unit.Status.VACANT,
            ),
            'g_p2': Unit.objects.create(
                property=prop_greenview, category=greenview_premium, unit_number='P2',
                rent_amount=Decimal('26000'), status=Unit.Status.VACANT,
            ),
            'g_s1': Unit.objects.create(
                property=prop_greenview, category=greenview_studio, unit_number='S1',
                rent_amount=Decimal('10000'), status=Unit.Status.VACANT,
            ),
            'g_s2': Unit.objects.create(
                property=prop_greenview, category=greenview_studio, unit_number='S2',
                rent_amount=Decimal('10500'), status=Unit.Status.VACANT,
            ),
        }

        update_property_unit_count(prop_sunrise)
        update_property_unit_count(prop_greenview)

        wanjiku, wanjiku_profile, wanjiku_lease = self._create_tenant(
            owner, password, 'wanjiku', 'Wanjiku', 'Njeri', '254712345001', units['s_a1'],
        )
        otieno, otieno_profile, otieno_lease = self._create_tenant(
            owner, password, 'otieno', 'James', 'Otieno', '254712345002', units['s_a2'],
        )
        kamau, kamau_profile, kamau_lease = self._create_tenant(
            owner, password, 'kamau', 'Peter', 'Kamau', '254712345003', units['g_p1'],
        )
        akinyi, akinyi_profile, akinyi_lease = self._create_tenant(
            owner, password, 'akinyi', 'Grace', 'Akinyi', '254712345004', units['g_s1'],
        )

        self._seed_payments(wanjiku_profile, wanjiku_lease, full_history=True)
        self._seed_payments(otieno_profile, otieno_lease, full_history=True, include_pending=True)
        self._seed_payments(kamau_profile, kamau_lease, full_history=False)
        self._seed_payments(akinyi_profile, akinyi_lease, full_history=True)

        UtilityCharge.objects.create(
            lease=kamau_lease,
            utility_type=UtilityCharge.UtilityType.WATER,
            month=month_start(date.today()),
            amount=Decimal('1500'),
            description='Water bill - June',
        )
        UtilityCharge.objects.create(
            lease=otieno_lease,
            utility_type=UtilityCharge.UtilityType.SERVICE,
            month=month_start(date.today()),
            amount=Decimal('2000'),
            description='Estate service charge',
        )

        PaymentReminder.objects.create(
            lease=kamau_lease,
            message='Rent for this month is overdue. Please pay via M-PESA.',
            sms_sent=True,
            whatsapp_link='https://wa.me/254712345003',
        )

        CashCollection.objects.create(
            lease=akinyi_lease,
            recorded_by=staff,
            amount=akinyi_lease.rent_amount,
            month_paid=month_start(date.today()),
            notes='Cash collected at caretaker office. Awaiting owner approval',
            status=CashCollection.Status.PENDING,
        )

        MaintenanceRequest.objects.create(
            tenant=wanjiku_profile,
            unit=units['s_a1'],
            issue_title='Leaking kitchen tap',
            issue_description='The kitchen sink has been dripping since Monday morning.',
            status=MaintenanceRequest.Status.PENDING,
        )
        MaintenanceRequest.objects.create(
            tenant=otieno_profile,
            unit=units['s_a2'],
            issue_title='Broken light switch',
            issue_description='Bedroom light switch stopped working.',
            status=MaintenanceRequest.Status.IN_PROGRESS,
        )
        MaintenanceRequest.objects.create(
            tenant=kamau_profile,
            unit=units['g_p1'],
            issue_title='Blocked drain',
            issue_description='Bathroom drain is slow; water pools after shower.',
            status=MaintenanceRequest.Status.PENDING,
        )
        MaintenanceRequest.objects.create(
            tenant=akinyi_profile,
            unit=units['g_s1'],
            issue_title='Window latch fixed',
            issue_description='Caretaker replaced the broken latch.',
            status=MaintenanceRequest.Status.RESOLVED,
        )

        UnitTransferRequest.objects.create(
            tenant=wanjiku_profile,
            current_lease=wanjiku_lease,
            desired_category=sunrise_one_br,
            preferred_unit=units['s_b2'],
            status=UnitTransferRequest.Status.PENDING,
            tenant_note='Would like a larger unit when B2 is available.',
        )
        UnitTransferRequest.objects.create(
            tenant=otieno_profile,
            current_lease=otieno_lease,
            desired_category=greenview_premium,
            status=UnitTransferRequest.Status.WAITLISTED,
            tenant_note='Waiting for a premium unit at Greenview.',
        )

        ActivityLog.objects.create(
            organization=org,
            user=staff,
            action='cash_recorded',
            detail='Recorded cash collection for Greenview unit S1',
            target=f'lease:{akinyi_lease.id}',
            severity=ActivityLog.Severity.INFO,
        )
        ActivityLog.objects.create(
            organization=org,
            user=staff,
            action='maintenance_updated',
            detail='Marked maintenance ticket as in progress for unit A2',
            target='maintenance:broken-light',
            severity=ActivityLog.Severity.INFO,
        )
        ActivityLog.objects.create(
            organization=org,
            user=owner,
            action='tenant_invite_sent',
            detail='Invited demo tenants during seed setup',
            severity=ActivityLog.Severity.INFO,
        )

        OwnerAlert.objects.create(
            organization=org,
            triggered_by=staff,
            alert_type=OwnerAlert.AlertType.CASH_PENDING,
            message='Caretaker recorded KES 10,000 cash for Grace Akinyi. Approval required.',
            resource=f'lease:{akinyi_lease.id}',
            severity=OwnerAlert.Severity.MEDIUM,
        )
        OwnerAlert.objects.create(
            organization=org,
            triggered_by=staff,
            alert_type=OwnerAlert.AlertType.BLOCKED_ACTION,
            message='Staff attempted to access owner-only tax export endpoint.',
            resource='tax-export',
            severity=OwnerAlert.Severity.LOW,
        )

        self.stdout.write(self.style.SUCCESS('Demo data loaded successfully.'))
        self._print_credentials(password)

    def _create_owner(self, password):
        user = User.objects.create_user(
            username='buke',
            email=f'buke{DEMO_DOMAIN}',
            password=password,
            role=User.Role.MANAGER,
            first_name='Buke',
            last_name='Guyole',
            phone_number='254712345678',
            phone_verified=True,
        )
        Organization.objects.create(
            name='Demo Property Group',
            slug=ORG_SLUG,
            property_manager_id=user.property_manager_id,
            owner=user,
        )
        OrganizationMember.objects.create(
            organization=Organization.objects.get(slug=ORG_SLUG),
            user=user,
            role=OrganizationMember.Role.OWNER,
        )
        return user

    def _create_staff(self, org, password, *, username, email_prefix, first_name, last_name, phone, role):
        user = User.objects.create_user(
            username=username,
            email=f'{email_prefix}{DEMO_DOMAIN}',
            password=password,
            role=User.Role.MANAGER,
            first_name=first_name,
            last_name=last_name,
            phone_number=phone,
            phone_verified=True,
        )
        OrganizationMember.objects.create(
            organization=org,
            user=user,
            role=role,
        )
        return user

    def _create_tenant(self, owner, password, username, first_name, last_name, phone, unit):
        user = User.objects.create_user(
            username=username,
            email=f'{username}{DEMO_DOMAIN}',
            password=password,
            role=User.Role.TENANT,
            manager=owner,
            first_name=first_name,
            last_name=last_name,
            phone_number=phone,
            phone_verified=True,
        )
        profile = TenantProfile.objects.create(user=user, phone_number=phone)
        lease = create_lease_for_tenant(profile, unit)
        return user, profile, lease

    def _seed_payments(self, profile, lease, *, full_history=False, include_pending=False):
        if full_history:
            for months_back in (3, 2, 1):
                paid_month = months_ago(months_back)
                self._create_completed_payment(profile, lease, paid_month)

        if include_pending:
            Payment.objects.create(
                tenant=profile,
                lease=lease,
                amount=lease.rent_amount,
                month_paid=month_start(date.today()),
                status=Payment.Status.PENDING,
                pay_phone_number=profile.phone_number,
                checkout_request_id=f'demo-checkout-{uuid4().hex[:12]}',
                payment_method=Payment.Method.MPESA,
            )
        elif not full_history:
            self._create_completed_payment(profile, lease, months_ago(1))

    def _create_completed_payment(self, profile, lease, paid_month):
        suffix = uuid4().hex[:8]
        Payment.objects.create(
            tenant=profile,
            lease=lease,
            amount=lease.rent_amount,
            month_paid=paid_month,
            status=Payment.Status.COMPLETED,
            mpesa_receipt_number=f'DEMO{suffix.upper()}',
            transaction_id=f'demo-txn-{suffix}',
            pay_phone_number=profile.phone_number,
            payment_date=timezone.now() - timedelta(days=30),
            payment_method=Payment.Method.MPESA,
            rent_applied=lease.rent_amount,
        )

    def _print_credentials(self, password):
        self.stdout.write('')
        self.stdout.write('Demo accounts (login with username):')
        self.stdout.write('  Owner (web):          buke')
        self.stdout.write('  Caretaker (web):      rufina')
        self.stdout.write('  Front Desk (web):     jillo')
        self.stdout.write('  Maintenance (web):    guyo')
        self.stdout.write('  Tenant (mobile):      wanjiku  (paid up)')
        self.stdout.write('  Tenant (mobile):      kamau     (arrears + utility)')
        self.stdout.write(f'  Password (all):       {password}')
        self.stdout.write('')
        self.stdout.write('Emails: buke@propizy.demo, rufina@propizy.demo, jillo@propizy.demo, guyo@propizy.demo, …')
        self.stdout.write('Highlights: 2 properties, 8 units, 4 tenants, role dashboards, arrears, maintenance.')
