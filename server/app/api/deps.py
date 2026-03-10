"""
FastAPI security dependencies for Supabase JWT validation.
Protects all backend endpoints from unauthorized access.
"""
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from supabase import create_client, Client
from app.core.config import settings


def get_supabase_client() -> Client:
    """Get an authenticated Supabase client for backend use."""
    sb = create_client(
        os.getenv("SUPABASE_URL", settings.SUPABASE_URL),
        os.getenv("SUPABASE_KEY", settings.SUPABASE_KEY),
    )
    try:
        sb.auth.sign_in_with_password({
            "email": os.getenv("SERVICE_EMAIL", ""),
            "password": os.getenv("SERVICE_PASSWORD", ""),
        })
    except Exception:
        pass
    return sb

# This scheme expects an "Authorization: Bearer <token>" header
security = HTTPBearer()


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """
    Decode and verify the Supabase JWT sent by the React frontend.
    Returns the user ID (sub claim) if valid.
    Raises 401 if missing, expired, or tampered with.
    """
    token = credentials.credentials

    # Use the dedicated JWT secret if configured, else fall back to the anon key
    jwt_secret = settings.SUPABASE_JWT_SECRET or settings.SUPABASE_KEY
    if not jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server JWT secret is not configured.",
        )

    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str = payload.get("sub", "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing user identifier (sub).",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_id
