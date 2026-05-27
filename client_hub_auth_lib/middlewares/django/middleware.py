import os

from authlib.jose import JsonWebKey, jwt as pyJwt
from django.conf import settings
import requests

try:
    # Keep compatibility with existing config module if present
    from config import config as file_config
except ModuleNotFoundError:
    file_config = None


class ClientHubAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    @classmethod
    def _get_setting(cls, key):
        """
        Retrieve config values in priority order:
        1) Django settings
        2) config module (backward compatibility)
        3) Environment variables
        """
        if hasattr(settings, key):
            return getattr(settings, key)

        if file_config and hasattr(file_config, key):
            return getattr(file_config, key)

        env_value = os.getenv(key)
        if env_value is None:
            raise RuntimeError(f"{key} is not configured in config module or environment")

        return env_value

    @classmethod
    def _get_jwks(cls):
        """Get the JSON web key sets from the issuer"""
        issuer = cls._get_setting("JWT_ISSUER")
        response = requests.get(f"{issuer}/.well-known/jwks.json")
        response.raise_for_status()
        return response.json()

    def _get_user(self, token):
        """Get user info from the userinfo endpoint"""
        try:
            issuer = self._get_setting("JWT_ISSUER")
            userinfo_url = f"{issuer}/api/user"
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(userinfo_url, headers=headers, timeout=10)
            response.raise_for_status()
            userinfo = response.json()
            email = userinfo.get("email")
        except requests.RequestException:
            return None

        return {
            "email": email,
        }

    def __call__(self, request):
        request.auth0_authenticated = False
        request.user = None

        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return self.get_response(request)

        auth = auth_header.split()
        if len(auth) != 2 or auth[0].lower() != "bearer":
            return self.get_response(request)

        token = auth[1]

        if token:
            jwks = ClientHubAuthMiddleware._get_jwks()
            key_set = JsonWebKey.import_key_set(jwks)
            claims = pyJwt.decode(
                token,
                key_set,
                claims_options={
                    "iss": {"essential": True, "value": self._get_setting("JWT_ISSUER")},
                    "aud": {"essential": True, "value": self._get_setting("JWT_AUDIENCE")},
                    "sub": {"essential": True},
                    "exp": {"essential": True},
                },
            )
            claims.validate()

            user_id = claims.get("sub")
            
            request.user_id = user_id
            request.auth0_authenticated = True

            user_info = self._get_user(token)
            request.email = user_info.get("email") if user_info else None

        return self.get_response(request)