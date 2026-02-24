import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db

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


@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(
    created_by: Optional[UUID] = Query(default=None),
    db: Session = Depends(get_db),
):
    try:
        if created_by:
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

        db.commit()

        if not row:
            raise HTTPException(status_code=500, detail="Workspace insert failed")

        return {
            "id": row["id"],
            "name": row["name"],
            "created_by": row["created_by"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create workspace")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{workspace_id}/devices")
def list_devices_for_workspace(workspace_id: UUID, db: Session = Depends(get_db)):
    """
    Convenience route to list devices under a workspace.
    """
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

