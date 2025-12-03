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

# Auth config from environment
AUTH_USERNAME = os.getenv("AUTH_USERNAME", "admin")
AUTH_PASSWORD = os.getenv("AUTH_PASSWORD", "changeme123")
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-to-random-32-char-secret")
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))
BRIDGE_SECRET = os.getenv("BRIDGE_SECRET", "")

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
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_token(token: str) -> Optional[dict]:
    """Verify a JWT token and return the payload"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None


def verify_credentials(username: str, password: str) -> bool:
    """Verify username and password against env config"""
    return username == AUTH_USERNAME and password == AUTH_PASSWORD


def verify_api_key(api_key: str) -> bool:
    """Verify API key (used by hooks) - accepts JWT_SECRET or BRIDGE_SECRET"""
    return api_key == JWT_SECRET or api_key == BRIDGE_SECRET


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
