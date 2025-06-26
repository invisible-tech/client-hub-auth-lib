from authlib.jose import JsonWebKey, jwt as pyJwt
import requests
from config import config


class ClientHubAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    @classmethod
    def _get_jwks(cls):
        """Get the JSON web key sets from the issuer"""
        response = requests.get(f"{config.JWT_ISSUER}/.well-known/jwks.json")
        response.raise_for_status()
        return response.json()

    def _get_user(self, token):
        """Get user info from the userinfo endpoint"""
        try:
            userinfo_url = f"{config.JWT_ISSUER}/api/user"
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
            return None

        auth = auth_header.split()
        if len(auth) != 2 or auth[0].lower() != "bearer":
            return None

        token = auth[1]

        if token:
            jwks = ClientHubAuthMiddleware._get_jwks()
            current_jwk = JsonWebKey.import_key_set(jwks).find_by_kid(config.JWT_CURRENT_KID).as_dict(is_private=False)
            key = JsonWebKey.import_key(current_jwk)
            claims = pyJwt.decode(
                token,
                key,
                claims_options={
                    "iss": {"essential": True, "value": config.JWT_ISSUER},
                    "aud": {"essential": True, "value": config.JWT_AUDIENCE},
                    "sub": {"essential": True},
                    "exp": {"essential": True},
                },
            )
            claims.validate()

            user_id = claims.get("sub")
            
            request.user_id = user_id
            request.auth0_authenticated = True

            user_info = self._get_user(token)
            request.email = user_info.get("email")

        return self.get_response(request)