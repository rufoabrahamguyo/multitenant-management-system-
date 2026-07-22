"""Helpers for Django storage (local filesystem or Cloudinary)."""

from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage


def save_media_bytes(folder: str, filename: str, data: bytes) -> str:
    """Save binary content to the configured default storage backend."""
    path = f'{folder.strip("/")}/{filename}'
    if default_storage.exists(path):
        default_storage.delete(path)
    return default_storage.save(path, ContentFile(data))


def save_image_upload(uploaded_file, *, folder: str, public_id: str) -> str:
    """
    Persist an uploaded image to Cloudinary when configured, else local media.

    Returns the storage key / Cloudinary public_id to assign on an ImageField.
    """
    folder = folder.strip('/')
    if getattr(settings, 'USE_CLOUDINARY', False):
        import cloudinary.uploader

        # Rewind in case the file was read earlier
        if hasattr(uploaded_file, 'seek'):
            uploaded_file.seek(0)

        result = cloudinary.uploader.upload(
            uploaded_file,
            folder=folder,
            public_id=public_id,
            resource_type='image',
            overwrite=True,
            invalidate=True,
        )
        return result['public_id']

    ext = Path(getattr(uploaded_file, 'name', '') or 'image.jpg').suffix.lower() or '.jpg'
    if ext not in {'.jpg', '.jpeg', '.png', '.webp'}:
        ext = '.jpg'
    path = f'{folder}/{public_id}{ext}'
    if default_storage.exists(path):
        default_storage.delete(path)
    if hasattr(uploaded_file, 'seek'):
        uploaded_file.seek(0)
    return default_storage.save(path, uploaded_file)


def assign_image_field(instance, field_name: str, storage_name: str):
    """Point an ImageField/FileField at an already-stored Cloudinary/local path without re-uploading."""
    field = getattr(instance, field_name)
    old_name = getattr(field, 'name', None) or ''
    if old_name and old_name != storage_name:
        try:
            field.delete(save=False)
        except Exception:
            pass
    setattr(instance, field_name, storage_name)

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
