import logging
import os
from typing import Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..permissions import require_role, ROLE_LEVEL
from .. import models

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


class WorkspaceMemberCreateByEmail(BaseModel):
    email: EmailStr
    role: models.MemberRole = models.MemberRole.MEMBER


class WorkspaceMemberOut(BaseModel):
    workspace_id: UUID
    user_id: UUID
    role: models.MemberRole
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
            q = (
                db.query(models.Workspace)
                .outerjoin(
                    models.WorkspaceMember,
                    models.WorkspaceMember.workspace_id == models.Workspace.id,
                )
                .filter(
                    or_(
                        models.WorkspaceMember.user_id == member_user_id,
                        models.Workspace.created_by == member_user_id,
                    )
                )
                .order_by(models.Workspace.created_at.desc())
            )
            workspaces = q.distinct(models.Workspace.id).all()
        elif created_by:
            workspaces = (
                db.query(models.Workspace)
                .filter(models.Workspace.created_by == created_by)
                .order_by(models.Workspace.created_at.desc())
                .all()
            )
        else:
            workspaces = (
                db.query(models.Workspace)
                .order_by(models.Workspace.created_at.desc())
                .all()
            )

        return [
            {
                "id": w.id,
                "name": w.name,
                "created_by": w.created_by,
                "created_at": w.created_at.isoformat() if w.created_at else None,
            }
            for w in workspaces
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
        workspace = models.Workspace(name=payload.name, created_by=payload.created_by)
        db.add(workspace)
        db.flush()  # populate workspace.id

        # Ensure the creator is also recorded as a workspace member (OWNER)
        if payload.created_by:
            member = (
                db.query(models.WorkspaceMember)
                .filter(
                    models.WorkspaceMember.workspace_id == workspace.id,
                    models.WorkspaceMember.user_id == payload.created_by,
                )
                .one_or_none()
            )
            if member is None:
                member = models.WorkspaceMember(
                    workspace_id=workspace.id,
                    user_id=payload.created_by,
                    role=MemberRole.OWNER.value,
                )
                db.add(member)
            else:
                member.role = MemberRole.OWNER.value

        db.commit()
        db.refresh(workspace)

        return {
            "id": workspace.id,
            "name": workspace.name,
            "created_by": workspace.created_by,
            "created_at": workspace.created_at.isoformat() if workspace.created_at else None,
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
        # Start with explicit workspace members
        rows = (
            db.query(
                models.WorkspaceMember.user_id,
                models.WorkspaceMember.role,
                models.Profile.display_name,
            )
            .outerjoin(
                models.Profile,
                models.Profile.user_id == models.WorkspaceMember.user_id,
            )
            .filter(models.WorkspaceMember.workspace_id == workspace_id)
            .all()
        )

        members: dict[UUID, dict] = {}
        for user_id, role, display_name in rows:
            existing = members.get(user_id)
            if existing is None or ROLE_LEVEL.get(role, 0) > ROLE_LEVEL.get(
                existing["role"], 0
            ):
                members[user_id] = {
                    "user_id": user_id,
                    "role": role,
                    "display_name": display_name,
                }

        # Ensure workspace creator is present as OWNER
        workspace = (
            db.query(models.Workspace)
            .filter(models.Workspace.id == workspace_id)
            .one_or_none()
        )
        if workspace and workspace.created_by:
            creator_id = workspace.created_by
            existing = members.get(creator_id)
            if existing is None or ROLE_LEVEL.get("OWNER", 0) > ROLE_LEVEL.get(
                existing["role"], 0
            ):
                profile = (
                    db.query(models.Profile)
                    .filter(models.Profile.user_id == creator_id)
                    .one_or_none()
                )
                members[creator_id] = {
                    "user_id": creator_id,
                    "role": "OWNER",
                    "display_name": profile.display_name if profile else None,
                }

        return list(members.values())
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
        (
            db.query(models.WorkspaceMember)
            .filter(models.WorkspaceMember.workspace_id == workspace_id)
            .delete(synchronize_session=False)
        )
        (
            db.query(models.WorkspaceDevice)
            .filter(models.WorkspaceDevice.workspace_id == workspace_id)
            .delete(synchronize_session=False)
        )
        workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).one_or_none()
        if workspace:
            db.delete(workspace)
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
        devices = (
            db.query(models.WorkspaceDevice)
            .filter(models.WorkspaceDevice.workspace_id == workspace_id)
            .order_by(models.WorkspaceDevice.created_at.desc())
            .all()
        )

        return [
            {
                "id": str(d.id),
                "workspace_id": str(d.workspace_id),
                "device_name": d.device_name,
                "status": d.status,
                "last_seen_at": d.last_seen_at.isoformat() if d.last_seen_at else None,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in devices
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
        if payload.role in (models.MemberRole.OWNER, models.MemberRole.ADMIN):
        require_role(db, workspace_id, x_user_id, "OWNER")
    else:
        require_role(db, workspace_id, x_user_id, "ADMIN")
    try:
        user_id = _lookup_user_id_by_email(payload.email)
    except HTTPException:
        # Bubble up user-facing HTTP exceptions (404, 502, etc.)
        raise

    try:
        member = (
            db.query(models.WorkspaceMember)
            .filter(
                models.WorkspaceMember.workspace_id == workspace_id,
                models.WorkspaceMember.user_id == user_id,
            )
            .one_or_none()
        )
        if member is None:
            member = models.WorkspaceMember(
                workspace_id=workspace_id,
                user_id=user_id,
                role=payload.role.value,
            )
            db.add(member)
        else:
            member.role = payload.role.value

        db.commit()
        db.refresh(member)

        return {
            "workspace_id": member.workspace_id,
            "user_id": member.user_id,
            "role": member.role,
            "created_at": member.created_at.isoformat() if member.created_at else None,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("Failed to add workspace member")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

