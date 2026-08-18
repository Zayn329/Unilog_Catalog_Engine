from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict

router = APIRouter(prefix="/auth", tags=["auth"])

UserRole = Literal["SENIOR_AUDITOR", "PIM_ADMIN"]


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    password: str
    role: UserRole


class AuthUser(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    email: str
    role: UserRole
    display_name: str


class LoginResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str
    user: AuthUser


_seed_users = {
    "auditor@unilog.com": {
        "password": "auditor123",
        "role": "SENIOR_AUDITOR",
        "display_name": "Senior Auditor",
    },
    "admin@unilog.com": {
        "password": "admin123",
        "role": "PIM_ADMIN",
        "display_name": "PIM Admin",
    },
}


def _issue_token(email: str, role: UserRole) -> str:
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(hours=12)
    payload = f"{email}:{role}:{issued_at.isoformat()}:{expires_at.isoformat()}"
    return "demo-token-" + payload.replace(":", "-")


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(payload: LoginRequest) -> LoginResponse:
    user = _seed_users.get(payload.email.lower())
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user["password"] != payload.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user["role"] != payload.role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Selected role does not match the account role",
        )

    return LoginResponse(
        token=_issue_token(payload.email.lower(), payload.role),
        user=AuthUser(
            user_id=payload.email.lower().replace("@", "-").replace(".", "-"),
            email=payload.email.lower(),
            role=payload.role,
            display_name=user["display_name"],
        ),
    )


async def get_current_user() -> AuthUser:
    return AuthUser(
        user_id="demo-user",
        email="auditor@unilog.com",
        role="SENIOR_AUDITOR",
        display_name="Senior Auditor",
    )
