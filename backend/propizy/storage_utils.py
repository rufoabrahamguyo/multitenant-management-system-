"""Helpers for Django storage (local filesystem or Cloudinary)."""

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage


def save_media_bytes(folder: str, filename: str, data: bytes) -> str:
    """Save binary content to the configured default storage backend."""
    path = f'{folder.strip("/")}/{filename}'
    if default_storage.exists(path):
        default_storage.delete(path)
    return default_storage.save(path, ContentFile(data))


def media_url(request, file_or_path):
    """Return an absolute URL for a FileField or stored media path."""
    if not file_or_path:
        return None

    if hasattr(file_or_path, 'url'):
        url = file_or_path.url
    else:
        url = default_storage.url(str(file_or_path).lstrip('/'))

    if url.startswith('http://') or url.startswith('https://'):
        return url
    if request:
        return request.build_absolute_uri(url)
    return url
