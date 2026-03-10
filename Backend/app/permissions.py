"""
Workspace role helpers for permission checks.
"""
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

ROLE_LEVEL = {"OWNER": 4, "ADMIN": 3, "MEMBER": 2, "VIEWER": 1}


def get_member_role(db: Session, workspace_id: UUID, user_id: UUID) -> Optional[str]:
    """
    Returns the user's role in the workspace, or None if not a member.
    Treats workspace.created_by as OWNER when no membership row exists.
    """
    row = db.execute(
        text(
            """
            SELECT wm.role
            FROM workspace_members wm
            WHERE wm.workspace_id = :workspace_id AND wm.user_id = :user_id
            """
        ),
        {"workspace_id": workspace_id, "user_id": user_id},
    ).mappings().first()
    if row:
        return row["role"]
    creator_row = db.execute(
        text("SELECT created_by FROM workspaces WHERE id = :workspace_id"),
        {"workspace_id": workspace_id},
    ).mappings().first()
    if creator_row and creator_row["created_by"] == user_id:
        return "OWNER"
    return None


def require_role(
    db: Session,
    workspace_id: UUID,
    user_id: Optional[UUID],
    min_role: str,
) -> str:
    """
    Ensures the user has at least min_role in the workspace.
    Returns the user's role. Raises HTTPException if forbidden.
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID required (X-User-Id header)")
    role = get_member_role(db, workspace_id, user_id)
    if not role:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
    if ROLE_LEVEL.get(role, 0) < ROLE_LEVEL.get(min_role, 0):
        raise HTTPException(status_code=403, detail=f"Requires {min_role} or higher")
    return role
