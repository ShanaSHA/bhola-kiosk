from django.contrib import admin
from django.urls import path
from clinic import views
urlpatterns=[path('django-admin/',admin.site.urls),path('api/auth/session',views.session),path('api/auth/login',views.sign_in),path('api/auth/logout',views.sign_out),path('api/content',views.content),path('api/upload',views.upload),path('api/media/<str:key>',views.media),path('api/health',views.health)]
