import json,tempfile
from io import BytesIO
from pathlib import Path
from PIL import Image
from django.test import TestCase,Client,override_settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import ClinicContent
class PortalTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('seed_clinic')
        cls.staff=get_user_model().objects.create_user('editor',password='test-password',is_staff=True)
        cls.viewer=get_user_model().objects.create_user('viewer',password='test-password')
    def payload(self):
        row=ClinicContent.objects.get(pk=1)
        return {'data':row.data,'version':row.version}
    def test_public_read_and_staff_write(self):
        self.assertEqual(self.client.get('/api/content').status_code,200)
        self.assertEqual(self.client.put('/api/content',self.payload(),content_type='application/json').status_code,403)
        self.client.force_login(self.viewer)
        self.assertEqual(self.client.put('/api/content',self.payload(),content_type='application/json').status_code,403)
        self.client.force_login(self.staff)
        payload=self.payload();payload['data']['welcome']['title']='Updated title'
        self.assertEqual(self.client.put('/api/content',payload,content_type='application/json').status_code,200)
        self.assertEqual(ClinicContent.objects.get(pk=1).data['welcome']['title'],'Updated title')
        self.assertEqual(self.client.put('/api/content',payload,content_type='application/json').status_code,409)
    def test_csrf_and_login_logout(self):
        c=Client(enforce_csrf_checks=True)
        self.assertEqual(c.post('/api/auth/login',{'username':'editor','password':'test-password'},content_type='application/json').status_code,403)
        token=c.get('/api/auth/session').json()['csrfToken']
        r=c.post('/api/auth/login',{'username':'editor','password':'test-password'},content_type='application/json',HTTP_X_CSRFTOKEN=token)
        self.assertEqual(r.status_code,200)
        self.assertTrue(c.get('/api/auth/session').json()['isStaff'])
        token=c.get('/api/auth/session').json()['csrfToken']
        self.assertEqual(c.put('/api/content',self.payload(),content_type='application/json').status_code,403)
        self.assertEqual(c.put('/api/content',self.payload(),content_type='application/json',HTTP_X_CSRFTOKEN=token).status_code,200)
        self.assertEqual(c.post('/api/auth/logout',HTTP_X_CSRFTOKEN=token).status_code,200)
        self.assertFalse(c.get('/api/auth/session').json()['isStaff'])
    def test_invalid_category_and_payload(self):
        self.client.force_login(self.staff)
        payload=self.payload();payload['data']['categories']=[]
        self.assertEqual(self.client.put('/api/content',payload,content_type='application/json').status_code,400)
        self.assertEqual(self.client.put('/api/content','invalid',content_type='application/json').status_code,400)
    def test_seed_preserves_edits(self):
        row=ClinicContent.objects.get(pk=1);row.data['welcome']['title']='Keep me';row.save()
        call_command('seed_clinic')
        self.assertEqual(ClinicContent.objects.get(pk=1).data['welcome']['title'],'Keep me')
    def test_image_upload(self):
        self.assertEqual(self.client.post('/api/upload').status_code,403)
        self.client.force_login(self.staff)
        self.assertEqual(self.client.post('/api/upload',{'file':SimpleUploadedFile('bad.jpg',b'not an image',content_type='image/jpeg')}).status_code,400)
        with tempfile.TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=directory):
            buffer=BytesIO();Image.new('RGB',(10,10),'red').save(buffer,format='PNG')
            r=self.client.post('/api/upload',{'file':SimpleUploadedFile('photo.png',buffer.getvalue(),content_type='image/png')})
            self.assertEqual(r.status_code,200)
            response=self.client.get(r.json()['url']);self.assertEqual(response.status_code,200);response.close()
    def test_login_throttle(self):
        for _ in range(5): self.assertEqual(self.client.post('/api/auth/login',{'username':'editor','password':'wrong'},content_type='application/json').status_code,401)
        self.assertEqual(self.client.post('/api/auth/login',{'username':'editor','password':'wrong'},content_type='application/json').status_code,429)
