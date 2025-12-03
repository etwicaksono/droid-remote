"""
JWT Authentication module for the bridge server
"""
import os
import jwt
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)


# Lazy loading of auth config (to ensure .env is loaded first)
def get_auth_username() -> str:
    return os.getenv("AUTH_USERNAME", "admin")

def get_auth_password() -> str:
    return os.getenv("AUTH_PASSWORD", "changeme123")

def get_jwt_secret() -> str:
    return os.getenv("JWT_SECRET", "change-this-to-random-32-char-secret")

def get_jwt_expiry_hours() -> int:
    return int(os.getenv("JWT_EXPIRY_HOURS", "24"))

def get_bridge_secret() -> str:
    return os.getenv("BRIDGE_SECRET", "")


# Log auth config on startup (mask password)
def log_auth_config():
    username = get_auth_username()
    password = get_auth_password()
    jwt_secret = get_jwt_secret()
    jwt_expiry = get_jwt_expiry_hours()
    bridge_secret = get_bridge_secret()
    
    logger.info(f"Auth config loaded:")
    logger.info(f"  AUTH_USERNAME: {username}")
    logger.info(f"  AUTH_PASSWORD: {'*' * len(password)} ({len(password)} chars)")
    logger.info(f"  JWT_SECRET: {jwt_secret[:8]}... ({len(jwt_secret)} chars)")
    logger.info(f"  JWT_EXPIRY_HOURS: {jwt_expiry}")
    logger.info(f"  BRIDGE_SECRET: {bridge_secret[:8] if bridge_secret else 'not set'}...")

# Security scheme
security = HTTPBearer(auto_error=False)

# Public routes that don't require auth
PUBLIC_ROUTES = [
    "/health",
    "/auth/login",
    "/docs",
    "/openapi.json",
]


def create_token(username: str) -> str:
    """Create a JWT token for the given username"""
    payload = {
        "sub": username,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=get_jwt_expiry_hours()),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm="HS256")


def verify_token(token: str) -> Optional[dict]:
    """Verify a JWT token and return the payload"""
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None


def verify_credentials(username: str, password: str) -> bool:
    """Verify username and password against env config"""
    return username == get_auth_username() and password == get_auth_password()


def verify_api_key(api_key: str) -> bool:
    """Verify API key (used by hooks) - accepts JWT_SECRET or BRIDGE_SECRET"""
    return api_key == get_jwt_secret() or api_key == get_bridge_secret()


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[str]:
    """
    Dependency to get current authenticated user.
    Returns username if authenticated, None otherwise.
    """
    # Check if route is public
    path = request.url.path
    if any(path.startswith(route) for route in PUBLIC_ROUTES):
        return None
    
    # Check for API key header (used by hooks)
    api_key = request.headers.get("X-API-Key")
    if api_key and verify_api_key(api_key):
        return "api_key_user"
    
    # Check for Bearer token
    if credentials:
        payload = verify_token(credentials.credentials)
        if payload:
            return payload.get("sub")
    
    # Check for token in query params (for WebSocket)
    token = request.query_params.get("token")
    if token:
        payload = verify_token(token)
        if payload:
            return payload.get("sub")
    
    return None


async def require_auth(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> str:
    """
    Dependency that requires authentication.
    Raises 401 if not authenticated.
    """
    user = await get_current_user(request, credentials)
    if user is None:
        # Check if it's a public route
        path = request.url.path
        if any(path.startswith(route) for route in PUBLIC_ROUTES):
            return "anonymous"
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
