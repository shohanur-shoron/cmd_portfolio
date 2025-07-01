# in portfolio/models.py

from django.db import models

class Commands(models.Model):
    # Define choices for the new field
    RESPONSE_TYPES = [
        ('html', 'HTML'),
        ('text', 'Plain Text'),
    ]

    name = models.CharField(max_length=100, unique=True) # Make name unique
    serial = models.IntegerField(default=1)
    response = models.TextField()
    forwhat = models.CharField(max_length=255, null=True, blank=True)
    response_type = models.CharField(
        max_length=4,
        choices=RESPONSE_TYPES,
        default='text'  # Default to plain text for new commands
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.name} - {self.response_type}'

    class Meta:
        verbose_name_plural = "Commands"