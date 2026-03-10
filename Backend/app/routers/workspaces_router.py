import logging
import os
from enum import Enum
from typing import Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..permissions import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    created_by: Optional[UUID] = None


class WorkspaceOut(BaseModel):
    id: UUID
    name: str
    created_by: Optional[UUID] = None
    created_at: Optional[str] = None


class MemberRole(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    VIEWER = "VIEWER"


class WorkspaceMemberCreateByEmail(BaseModel):
    email: EmailStr
    role: MemberRole = MemberRole.MEMBER


class WorkspaceMemberOut(BaseModel):
    workspace_id: UUID
    user_id: UUID
    role: MemberRole
    created_at: Optional[str] = None


@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(
    created_by: Optional[UUID] = Query(default=None),
    member_user_id: Optional[UUID] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Lists workspaces.

    - If `member_user_id` is provided, returns all workspaces where the user is a
      member (via `workspace_members`) OR they are the creator. This keeps
      existing workspaces visible even if no membership row exists for the
      creator.
    - Else if `created_by` is provided, filters directly on that column.
    - Else returns all workspaces.
    """
    try:
        if member_user_id:
            rows = db.execute(
                text(
                    """
                    SELECT DISTINCT w.id, w.name, w.created_by, w.created_at
                    FROM workspaces w
                    LEFT JOIN workspace_members wm
                      ON wm.workspace_id = w.id
                    WHERE wm.user_id = :member_user_id
                       OR w.created_by = :member_user_id
                    ORDER BY w.created_at DESC
                    """
                ),
                {"member_user_id": member_user_id},
            ).mappings().all()
        elif created_by:
            rows = db.execute(
                text(
                    """
                    SELECT id, name, created_by, created_at
                    FROM workspaces
                    WHERE created_by = :created_by
                    ORDER BY created_at DESC
                    """
                ),
                {"created_by": created_by},
            ).mappings().all()
        else:
            rows = db.execute(
                text(
                    """
                    SELECT id, name, created_by, created_at
                    FROM workspaces
                    ORDER BY created_at DESC
                    """
                )
            ).mappings().all()

        return [
            {
                "id": r["id"],
                "name": r["name"],
                "created_by": r["created_by"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]
    except Exception as e:
        logger.exception("Failed to list workspaces")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", status_code=201, response_model=WorkspaceOut)
def create_workspace(payload: WorkspaceCreate, db: Session = Depends(get_db)):
    """
    Creates a workspace. `created_at` defaults to now() in the DB.
    """
    try:
        row = db.execute(
            text(
                """
                INSERT INTO workspaces (name, created_by)
                VALUES (:name, :created_by)
                RETURNING id, name, created_by, created_at
                """
            ),
            {"name": payload.name, "created_by": payload.created_by},
        ).mappings().first()

        if not row:
            raise HTTPException(status_code=500, detail="Workspace insert failed")

        # Ensure the creator is also recorded as a workspace member (OWNER)
        if payload.created_by:
            db.execute(
                text(
                    """
                    INSERT INTO workspace_members (workspace_id, user_id, role)
                    VALUES (:workspace_id, :user_id, :role)
                    ON CONFLICT (workspace_id, user_id)
                    DO UPDATE SET role = EXCLUDED.role
                    """
                ),
                {
                    "workspace_id": row["id"],
                    "user_id": payload.created_by,
                    "role": MemberRole.OWNER.value,
                },
            )

        db.commit()

        return {
            "id": row["id"],
            "name": row["name"],
            "created_by": row["created_by"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logger.exception("Failed to create workspace")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


class WorkspaceMemberWithProfile(BaseModel):
    user_id: UUID
    role: str
    display_name: Optional[str] = None


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberWithProfile])
def list_workspace_members(
    workspace_id: UUID,
    x_user_id: Optional[UUID] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """
    List workspace members with their display names (from profiles).
    Requires workspace membership (any role).
    """
    require_role(db, workspace_id, x_user_id, "VIEWER")
    try:
        # Always include workspace creator as OWNER (even if legacy data is missing
        # an explicit workspace_members row for them).
        rows = db.execute(
            text(
                """
                SELECT DISTINCT ON (t.user_id)
                    t.user_id,
                    t.role,
                    t.display_name
                FROM (
                    SELECT wm.user_id, wm.role, p.display_name
                    FROM workspace_members wm
                    LEFT JOIN profiles p ON p.user_id = wm.user_id
                    WHERE wm.workspace_id = :workspace_id

                    UNION ALL

                    SELECT w.created_by AS user_id, 'OWNER' AS role, p.display_name
                    FROM workspaces w
                    LEFT JOIN profiles p ON p.user_id = w.created_by
                    WHERE w.id = :workspace_id AND w.created_by IS NOT NULL
                ) t
                ORDER BY
                    t.user_id,
                    CASE t.role
                        WHEN 'OWNER' THEN 4
                        WHEN 'ADMIN' THEN 3
                        WHEN 'MEMBER' THEN 2
                        WHEN 'VIEWER' THEN 1
                        ELSE 0
                    END DESC
                """
            ),
            {"workspace_id": workspace_id},
        ).mappings().all()

        return [
            {
                "user_id": r["user_id"],
                "role": r["role"],
                "display_name": r.get("display_name"),
            }
            for r in rows
        ]
    except Exception as e:
        logger.exception("Failed to list workspace members")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{workspace_id}", status_code=204)
def delete_workspace(
    workspace_id: UUID,
    x_user_id: Optional[UUID] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """Delete a workspace. Requires OWNER only."""
    require_role(db, workspace_id, x_user_id, "OWNER")
    try:
        db.execute(
            text("DELETE FROM workspace_members WHERE workspace_id = :workspace_id"),
            {"workspace_id": workspace_id},
        )
        db.execute(
            text("DELETE FROM devices WHERE workspace_id = :workspace_id"),
            {"workspace_id": workspace_id},
        )
        db.execute(
            text("DELETE FROM workspaces WHERE id = :workspace_id"),
            {"workspace_id": workspace_id},
        )
        db.commit()
    except Exception as e:
        logger.exception("Failed to delete workspace")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{workspace_id}/devices")
def list_devices_for_workspace(
    workspace_id: UUID,
    x_user_id: Optional[UUID] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """
    Convenience route to list devices under a workspace.
    Requires workspace membership (any role).
    """
    require_role(db, workspace_id, x_user_id, "VIEWER")
    try:
        rows = db.execute(
            text(
                """
                SELECT id, workspace_id, device_name, status, last_seen_at, created_at
                FROM devices
                WHERE workspace_id = :workspace_id
                ORDER BY created_at DESC
                """
            ),
            {"workspace_id": workspace_id},
        ).mappings().all()

        return [
            {
                "id": str(r["id"]),
                "workspace_id": str(r["workspace_id"]),
                "device_name": r["device_name"],
                "status": r.get("status"),
                "last_seen_at": r["last_seen_at"].isoformat() if r.get("last_seen_at") else None,
                "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
            }
            for r in rows
        ]
    except Exception as e:
        logger.exception("Failed to list devices for workspace")
        raise HTTPException(status_code=500, detail=str(e))


def _get_supabase_admin_client() -> tuple[str, str]:
    """
    Returns (base_url, service_role_key) for Supabase admin API.
    """
    base_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_role_key:
        raise RuntimeError("Supabase admin env vars are not configured")
    # Normalize URL without trailing slash
    base_url = base_url.rstrip("/")
    return base_url, service_role_key


def _lookup_user_id_by_email(email: str) -> UUID:
    """
    Uses Supabase Admin API to resolve a user's auth UUID from their email.
    """
    base_url, service_role_key = _get_supabase_admin_client()
    url = f"{base_url}/auth/v1/admin/users"
    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, params={"email": email}, headers=headers)
    except httpx.RequestError as exc:
        logger.exception("Failed to contact Supabase admin API")
        raise HTTPException(
            status_code=502,
            detail=f"Error contacting Supabase admin API: {exc}",
        )

    if resp.status_code != 200:
        logger.error(
            "Supabase admin API returned %s: %s", resp.status_code, resp.text
        )
        raise HTTPException(
            status_code=502,
            detail="Failed to lookup user by email in Supabase",
        )

    data = resp.json()
    users = data.get("users") if isinstance(data, dict) else data
    if not users:
        raise HTTPException(status_code=404, detail="User with that email not found")

    # Be defensive: some Supabase deployments may ignore the email filter
    # and return multiple users. Explicitly pick the one whose email matches.
    user = None
    for candidate in users:
        candidate_email = candidate.get("email")
        if candidate_email and candidate_email.lower() == email.lower():
            user = candidate
            break

    if user is None:
        logger.error("No Supabase user matched email=%s in response: %s", email, users)
        raise HTTPException(status_code=404, detail="User with that email not found")
    user_id = user.get("id")
    if not user_id:
        logger.error("Supabase user record missing 'id': %s", user)
        raise HTTPException(
            status_code=502,
            detail="Supabase user record is missing id",
        )

    try:
        return UUID(user_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Invalid Supabase user id: %s", user_id)
        raise HTTPException(
            status_code=502,
            detail=f"Supabase returned invalid user id: {exc}",
        )


@router.post(
    "/{workspace_id}/members/by-email",
    status_code=201,
    response_model=WorkspaceMemberOut,
)
def add_member_to_workspace_by_email(
    workspace_id: UUID,
    payload: WorkspaceMemberCreateByEmail,
    x_user_id: Optional[UUID] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """
    Adds (or updates) a workspace member by resolving their email to a Supabase
    auth user id and inserting into the `workspace_members` table.
    Requires OWNER or ADMIN. Only OWNER can assign OWNER or ADMIN roles.
    """
    if payload.role in (MemberRole.OWNER, MemberRole.ADMIN):
        require_role(db, workspace_id, x_user_id, "OWNER")
    else:
        require_role(db, workspace_id, x_user_id, "ADMIN")
    try:
        user_id = _lookup_user_id_by_email(payload.email)
    except HTTPException:
        # Bubble up user-facing HTTP exceptions (404, 502, etc.)
        raise

    try:
        row = db.execute(
            text(
                """
                INSERT INTO workspace_members (workspace_id, user_id, role)
                VALUES (:workspace_id, :user_id, :role)
                ON CONFLICT (workspace_id, user_id)
                DO UPDATE SET role = EXCLUDED.role
                RETURNING workspace_id, user_id, role, created_at
                """
            ),
            {
                "workspace_id": workspace_id,
                "user_id": user_id,
                "role": payload.role.value,
            },
        ).mappings().first()

        db.commit()

        if not row:
            raise HTTPException(
                status_code=500, detail="Failed to upsert workspace member"
            )

        return {
            "workspace_id": row["workspace_id"],
            "user_id": row["user_id"],
            "role": row["role"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("Failed to add workspace member")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

