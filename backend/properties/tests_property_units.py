from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from properties.models import Property, Unit
from users.models import Organization, OrganizationMember

User = get_user_model()


class PropertyUnitSyncTests(APITestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            username='mgr', email='mgr@test.com', password='pass12345', role=User.Role.MANAGER,
        )
        org = Organization.objects.create(
            name='Test Org', slug='test-org', property_manager_id=self.manager.property_manager_id, owner=self.manager,
        )
        OrganizationMember.objects.create(
            organization=org, user=self.manager, role=OrganizationMember.Role.OWNER,
        )
        self.client.force_authenticate(user=self.manager)

    def test_create_property_auto_creates_units(self):
        resp = self.client.post('/api/properties/', {
            'name': 'Sunrise Apts',
            'address': 'Nairobi',
            'total_units': 3,
        })
        self.assertEqual(resp.status_code, 201)
        prop = Property.objects.get(name='Sunrise Apts')
        self.assertEqual(prop.units.count(), 3)
        self.assertEqual(list(prop.units.order_by('unit_number').values_list('unit_number', flat=True)), ['1', '2', '3'])
        self.assertEqual(resp.data['units_count'], 3)

    def test_delete_vacant_unit_updates_count(self):
        prop = Property.objects.create(
            manager=self.manager, name='Block B', address='Mombasa', total_units=2,
        )
        unit = Unit.objects.create(
            property=prop, unit_number='1', rent_amount=Decimal('5000'), status=Unit.Status.VACANT,
        )
        Unit.objects.create(
            property=prop, unit_number='2', rent_amount=Decimal('5000'), status=Unit.Status.VACANT,
        )
        resp = self.client.delete(f'/api/units/{unit.id}/')
        self.assertEqual(resp.status_code, 204)
        prop.refresh_from_db()
        self.assertEqual(prop.total_units, 1)

    def test_update_property_name_and_add_units(self):
        resp = self.client.post('/api/properties/', {
            'name': 'Grow Apts', 'address': 'Nairobi', 'total_units': 2,
        })
        prop_id = resp.data['id']
        resp = self.client.patch(f'/api/properties/{prop_id}/', {
            'name': 'Grow Apartments',
            'total_units': 4,
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['name'], 'Grow Apartments')
        self.assertEqual(resp.data['units_count'], 4)

    def test_cannot_reduce_units_below_existing(self):
        resp = self.client.post('/api/properties/', {
            'name': 'Shrink Test', 'address': 'Nairobi', 'total_units': 3,
        })
        prop_id = resp.data['id']
        resp = self.client.patch(f'/api/properties/{prop_id}/', {'total_units': 1})
        self.assertEqual(resp.status_code, 400)

    def test_units_list_sorted_numerically(self):
        prop = Property.objects.create(
            manager=self.manager, name='Sort Test', address='Nairobi', total_units=4,
        )
        for n in (10, 2, 1, 20):
            Unit.objects.create(
                property=prop, unit_number=str(n), rent_amount=Decimal('1000'), status=Unit.Status.VACANT,
            )
        resp = self.client.get(f'/api/units/?property={prop.id}')
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get('results', resp.data)
        self.assertEqual([u['unit_number'] for u in results], ['1', '2', '10', '20'])
