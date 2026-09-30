from django.contrib import admin
from .models import ClinicContent
@admin.register(ClinicContent)
class ContentAdmin(admin.ModelAdmin):
    list_display=('id','version','updated_at','updated_by')
    readonly_fields=('id','data','version','updated_at','updated_by')
    def has_add_permission(self,request): return False
    def has_delete_permission(self,request,obj=None): return False
