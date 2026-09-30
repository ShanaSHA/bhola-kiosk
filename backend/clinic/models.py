from django.db import models
from django.conf import settings
class ClinicContent(models.Model):
    id=models.PositiveSmallIntegerField(primary_key=True,default=1,editable=False)
    data=models.JSONField(default=dict)
    version=models.PositiveIntegerField(default=1)
    updated_at=models.DateTimeField(auto_now=True)
    updated_by=models.ForeignKey(settings.AUTH_USER_MODEL,null=True,blank=True,on_delete=models.SET_NULL)
    def __str__(self): return f'Clinic content (version {self.version})'
class LoginAttempt(models.Model):
    username=models.CharField(max_length=150,primary_key=True)
    failures=models.PositiveIntegerField(default=0)
    window_start=models.DateTimeField()
