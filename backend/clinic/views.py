
import json
import uuid
import warnings

from io import BytesIO
from datetime import timedelta
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from django.contrib.auth import authenticate, login, logout
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.http import JsonResponse, FileResponse, Http404
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.http import (
    require_http_methods,
    require_GET,
    require_POST
)
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import ClinicContent, LoginAttempt
from .validation import validate_content


# =====================================================
# CSRF FAILURE
# =====================================================

def csrf_failure(request, reason=''):
    print("CSRF FAILURE:", reason)

    return JsonResponse(
        {'error': 'Your session could not be verified. Reload and try again.'},
        status=403
    )


# =====================================================
# STAFF AUTHENTICATION
# =====================================================

def staff(request):
    return (
        request.user.is_authenticated
        and request.user.is_active
        and request.user.is_staff
    )


def denied():
    return JsonResponse(
        {'error': 'Staff sign-in required.'},
        status=403
    )


# =====================================================
# JSON PARSER
# =====================================================

def parse(request):
    if len(request.body) > 500000:
        raise ValueError('Request is too large.')

    value = json.loads(request.body)

    if not isinstance(value, dict):
        raise ValueError('Expected a JSON object.')

    return value


# =====================================================
# SESSION
# =====================================================

@require_GET
@never_cache
@ensure_csrf_cookie
def session(request):
    return JsonResponse({
        'isStaff': bool(staff(request)),
        'csrfToken': get_token(request),
    })


# =====================================================
# SIGN IN
# =====================================================

@require_POST
@never_cache
def sign_in(request):
    try:
        payload = parse(request)

        username = payload.get('username', '')
        password = payload.get('password', '')

        if (
            not isinstance(username, str)
            or not isinstance(password, str)
            or not 0 < len(username) <= 150
            or len(password) > 1000
        ):
            raise ValueError('Invalid credentials.')

    except (ValueError, TypeError):
        return JsonResponse(
            {'error': 'Invalid sign-in request.'},
            status=400
        )

    with transaction.atomic():
        attempt, _ = LoginAttempt.objects.get_or_create(
            username=username,
            defaults={'window_start': timezone.now()}
        )

        attempt = LoginAttempt.objects.select_for_update().get(
            pk=username
        )

        if timezone.now() - attempt.window_start > timedelta(minutes=15):
            attempt.failures = 0
            attempt.window_start = timezone.now()

        if attempt.failures >= 5:
            return JsonResponse(
                {'error': 'Too many attempts. Please try again in 15 minutes.'},
                status=429
            )

        user = authenticate(
            request,
            username=username,
            password=password
        )

        if not user or not user.is_staff or not user.is_active:
            attempt.failures += 1
            attempt.save()

            return JsonResponse(
                {'error': 'Invalid username or password.'},
                status=401
            )

        attempt.delete()

    login(request, user)

    return JsonResponse({
        'ok': True,
        'csrfToken': get_token(request)
    })


# =====================================================
# SIGN OUT
# =====================================================

@require_POST
@never_cache
def sign_out(request):
    logout(request)
    return JsonResponse({'ok': True})


# =====================================================
# CLINIC CONTENT
# =====================================================

@require_http_methods(['GET', 'PUT'])
@never_cache
def content(request):

    if request.method == 'GET':
        row = ClinicContent.objects.filter(pk=1).first()

        if not row:
            return JsonResponse(
                {'error': 'Clinic content has not been initialized. Run seed_clinic.'},
                status=503
            )

        return JsonResponse({
            'data': row.data,
            'version': row.version
        })

    if not staff(request):
        return denied()

    try:
        payload = parse(request)

        data = validate_content(payload.get('data'))
        version = payload.get('version')

        if type(version) is not int or version < 1:
            raise ValueError('Invalid content version.')

    except (ValueError, TypeError) as exc:
        return JsonResponse({'error': str(exc)}, status=400)

    with transaction.atomic():
        row = ClinicContent.objects.select_for_update().filter(
            pk=1
        ).first()

        if not row or row.version != version:
            return JsonResponse(
                {'error': 'Content has changed. Reload before saving.'},
                status=409
            )

        row.data = data
        row.version += 1
        row.updated_by = request.user
        row.save()

    return JsonResponse({'version': row.version})


# =====================================================
# IMAGE AND VIDEO UPLOAD
# =====================================================

@require_POST
@never_cache
def upload(request):

    if not staff(request):
        return denied()

    f = request.FILES.get('file')

    if not f:
        return JsonResponse(
            {'error': 'Choose an image or video file.'},
            status=400
        )

    content_type = (f.content_type or '').lower()
    suffix = Path(f.name).suffix.lower()

    # -----------------------------------------------
    # VIDEO UPLOAD
    # -----------------------------------------------

    if (
        content_type in ('video/mp4', 'video/webm')
        or suffix in ('.mp4', '.webm')
    ):

        if f.size > 50 * 1024 * 1024:
            return JsonResponse(
                {'error': 'Video must be 50 MB or smaller.'},
                status=400
            )

        ext = (
            '.webm'
            if suffix == '.webm' or content_type == 'video/webm'
            else '.mp4'
        )

        key = default_storage.save(
            str(uuid.uuid4()) + ext,
            f
        )

        return JsonResponse({
            'url': '/api/media/' + key
        })

    # -----------------------------------------------
    # IMAGE SIZE VALIDATION
    # -----------------------------------------------

    MAX_IMAGE_SIZE = 5 * 1024 * 1024
    MAX_IMAGE_PIXELS = 25000000

    print("========== IMAGE UPLOAD DEBUG ==========")
    print("FILE:", f.name)
    print("SIZE MB:", round(f.size / (1024 * 1024), 2))
    print("CONTENT TYPE:", f.content_type)
    print("========================================")

    if f.size > MAX_IMAGE_SIZE:
        return JsonResponse(
            {'error': 'Image must be 5 MB or smaller.'},
            status=400
        )

    # -----------------------------------------------
    # IMAGE FORMAT VALIDATION AND CONVERSION
    # -----------------------------------------------

    try:
        with warnings.catch_warnings():
            warnings.simplefilter(
                'error',
                Image.DecompressionBombWarning
            )

            image = Image.open(f)

            print("DETECTED FORMAT:", image.format)
            print("IMAGE DIMENSIONS:", image.size)

            # Accept JPEG, PNG, WEBP and MPO
            if image.format not in (
                'JPEG',
                'PNG',
                'WEBP',
                'MPO'
            ):
                raise ValueError(
                    f'Unsupported image format: {image.format}'
                )

            width, height = image.size

            if width * height > MAX_IMAGE_PIXELS:
                raise ValueError(
                    'Image dimensions exceed the 25-million-pixel limit.'
                )

            # Convert the first image/frame to standard JPEG
            image.seek(0)
            image.load()

            output = BytesIO()

            image.convert('RGB').save(
                output,
                format='JPEG',
                quality=90,
                optimize=True
            )

            output.seek(0)

    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning
    ) as e:

        print("IMAGE PROCESSING ERROR:", repr(e))

        return JsonResponse(
            {'error': 'Image processing failed: ' + str(e)},
            status=400
        )

    # -----------------------------------------------
    # SAVE CONVERTED JPEG
    # -----------------------------------------------

    key = default_storage.save(
        str(uuid.uuid4()) + '.jpg',
        ContentFile(output.getvalue())
    )

    print("IMAGE UPLOAD SUCCESS:", key)

    return JsonResponse({
        'url': '/api/media/' + key
    })


# =====================================================
# MEDIA DISPLAY
# =====================================================

@require_GET
def media(request, key):

    suffix = Path(key).suffix.lower()

    if suffix not in ('.jpg', '.mp4', '.webm'):
        raise Http404

    try:
        uuid.UUID(Path(key).stem)
    except ValueError:
        raise Http404

    if not default_storage.exists(key):
        raise Http404

    content_types = {
        '.jpg': 'image/jpeg',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm'
    }

    response = FileResponse(
        default_storage.open(key, 'rb'),
        content_type=content_types[suffix]
    )

    response['Cache-Control'] = 'public,max-age=86400'

    return response


# =====================================================
# HEALTH CHECK
# =====================================================

@require_GET
def health(request):

    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')

    return JsonResponse({
        'status': 'ok'
    })
