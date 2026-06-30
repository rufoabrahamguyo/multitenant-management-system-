from users.models import Organization, OrganizationMpesaConfig


def get_organization_for_lease(lease):
    pm_id = lease.unit.property.manager.property_manager_id
    return Organization.objects.filter(property_manager_id=pm_id).first()


def get_mpesa_config_for_lease(lease):
    org = get_organization_for_lease(lease)
    if not org:
        return None
    config, _ = OrganizationMpesaConfig.objects.get_or_create(organization=org)
    return config
