from .models import ActivityLog
from .utils import get_organization


def log_activity(user, action, detail='', target=''):
    org = get_organization(user)
    if not org:
        return
    ActivityLog.objects.create(
        organization=org,
        user=user,
        action=action,
        detail=detail[:500],
        target=target[:255],
    )
