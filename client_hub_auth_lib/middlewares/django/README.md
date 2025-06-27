## ClientHubAuthMiddleware

The Django middleware that handles JWT token validation and user authentication.

## Usage

#### 1. Add Middleware to Settings

```python
# settings.py
MIDDLEWARE = [
    # ... other middleware
    'client_hub_auth_lib.middlewares.django.middleware.ClientHubAuthMiddleware',
]
```

#### 2. Configure Authentication Settings

If your app is configured with Doppler, add the secrets to Doppler.

Otherwise, add the secrets to your environment variables. Example below:

```python
# config.py or settings.py
class Config:
    JWT_ISSUER = "https://identity.inv.tech"
    JWT_AUDIENCE = "*.inv.tech"
```

#### 3. Access User Information in Views

the request object will have the following attributes:

- `request.auth0_authenticated` (bool): Whether the user is authenticated in Auth0
- `request.user_id` (str): The user's external ID from Client Hub
- `request.email` (str): The user's email address
