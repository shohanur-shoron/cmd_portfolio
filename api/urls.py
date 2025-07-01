from django.urls import path
from . import views

urlpatterns = [
    path('terminal/', views.terminal_api, name='terminal_api'),
    path('chat/', views.chat_api, name='chat_api'),
]