# Portable test runner only. Application settings always use PostgreSQL.
from .settings import *
DATABASES={'default':{'ENGINE':'django.db.backends.sqlite3','NAME':':memory:'}}
PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher']
ALLOWED_HOSTS=['testserver','localhost','127.0.0.1']
