import json, uuid, warnings
from io import BytesIO
from datetime import timedelta
from pathlib import Path
from PIL import Image, UnidentifiedImageError
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.http import JsonResponse, FileResponse, Http404
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.http import require_http_methods, require_GET, require_POST
from django.views.decorators.cache import never_cache
from .models import ClinicContent, LoginAttempt
from .validation import validate_content

def csrf_failure(request, reason=''): return JsonResponse({'error':'Your session could not be verified. Reload and try again.'},status=403)
def staff(request): return request.user.is_authenticated and request.user.is_active and request.user.is_staff
def denied(): return JsonResponse({'error':'Staff sign-in required.'},status=403)
def parse(request):
    if len(request.body)>500000: raise ValueError('Request is too large.')
    value=json.loads(request.body)
    if not isinstance(value,dict): raise ValueError('Expected a JSON object.')
    return value
@require_GET
@never_cache
def session(request): return JsonResponse({'isStaff':bool(staff(request)),'csrfToken':get_token(request)})
@require_POST
@never_cache
def sign_in(request):
    try:
        payload=parse(request);username=payload.get('username','');password=payload.get('password','')
        if not isinstance(username,str) or not isinstance(password,str) or not 0<len(username)<=150 or len(password)>1000: raise ValueError('Invalid credentials.')
    except (ValueError,TypeError): return JsonResponse({'error':'Invalid sign-in request.'},status=400)
    with transaction.atomic():
        attempt,_=LoginAttempt.objects.get_or_create(username=username,defaults={'window_start':timezone.now()})
        attempt=LoginAttempt.objects.select_for_update().get(pk=username)
        if timezone.now()-attempt.window_start>timedelta(minutes=15): attempt.failures=0;attempt.window_start=timezone.now()
        if attempt.failures>=5: return JsonResponse({'error':'Too many attempts. Please try again in 15 minutes.'},status=429)
        user=authenticate(request,username=username,password=password)
        if not user or not user.is_staff or not user.is_active:
            attempt.failures+=1;attempt.save()
            return JsonResponse({'error':'Invalid username or password.'},status=401)
        attempt.delete()
    login(request,user)
    return JsonResponse({'ok':True,'csrfToken':get_token(request)})
@require_POST
@never_cache
def sign_out(request):
    logout(request)
    return JsonResponse({'ok':True})
@require_http_methods(['GET','PUT'])
@never_cache
def content(request):
    if request.method=='GET':
        row=ClinicContent.objects.filter(pk=1).first()
        if not row: return JsonResponse({'error':'Clinic content has not been initialized. Run seed_clinic.'},status=503)
        return JsonResponse({'data':row.data,'version':row.version})
    if not staff(request): return denied()
    try:
        payload=parse(request);data=validate_content(payload.get('data'));version=payload.get('version')
        if type(version) is not int or version<1: raise ValueError('Invalid content version.')
    except (ValueError,TypeError) as exc: return JsonResponse({'error':str(exc)},status=400)
    with transaction.atomic():
        row=ClinicContent.objects.select_for_update().filter(pk=1).first()
        if not row or row.version!=version: return JsonResponse({'error':'Content has changed. Reload before saving.'},status=409)
        row.data=data;row.version+=1;row.updated_by=request.user;row.save()
    return JsonResponse({'version':row.version})
@require_POST
@never_cache
def upload(request):
    if not staff(request): return denied()
    f=request.FILES.get('file')
    if not f: return JsonResponse({'error':'Choose an image or video file.'},status=400)
    content_type=(f.content_type or '').lower()
    if content_type in ('video/mp4','video/webm') or Path(f.name).suffix.lower() in ('.mp4','.webm'):
        if f.size>50*1024*1024: return JsonResponse({'error':'Video must be 50 MB or smaller.'},status=400)
        ext='.webm' if Path(f.name).suffix.lower()=='.webm' or content_type=='video/webm' else '.mp4'
        key=default_storage.save(str(uuid.uuid4())+ext,f)
        return JsonResponse({'url':'/api/media/'+key})
    if f.size>5*1024*1024: return JsonResponse({'error':'Choose a JPG, PNG or WebP image under 5 MB.'},status=400)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error',Image.DecompressionBombWarning)
            image=Image.open(f)
            if image.format not in ['JPEG','PNG','WEBP'] or image.width*image.height>25000000: raise ValueError()
            image.load();output=BytesIO();image.convert('RGB').save(output,format='JPEG',quality=90)
    except (UnidentifiedImageError,OSError,ValueError,Image.DecompressionBombError,Image.DecompressionBombWarning): return JsonResponse({'error':'The file is not a supported image.'},status=400)
    key=default_storage.save(str(uuid.uuid4())+'.jpg',ContentFile(output.getvalue()))
    return JsonResponse({'url':'/api/media/'+key})
@require_GET
def media(request,key):
    suffix=Path(key).suffix.lower()
    if suffix not in ('.jpg','.mp4','.webm'): raise Http404
    try: uuid.UUID(Path(key).stem)
    except ValueError: raise Http404
    if not default_storage.exists(key): raise Http404
    content_types={'.jpg':'image/jpeg','.mp4':'video/mp4','.webm':'video/webm'}
    response=FileResponse(default_storage.open(key,'rb'),content_type=content_types[suffix])
    response['Cache-Control']='public,max-age=86400'
    return response
@require_GET
def health(request):
    from django.db import connection
    with connection.cursor() as cursor: cursor.execute('SELECT 1')
    return JsonResponse({'status':'ok'})
