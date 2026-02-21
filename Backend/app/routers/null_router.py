from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from starlette import status
from ..models import User
from ..database import get_db


router = APIRouter(tags=['users'])


db_dependency = Annotated[Session, Depends(get_db)]

class UserRequest(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(min_length=5)


@router.get('/users', status_code=status.HTTP_200_OK)
async def getAllUsers(db: db_dependency):
    users = db.query(User).all()
    if not users:
      raise HTTPException(status_code=404, detail="No Users Available")
    return users