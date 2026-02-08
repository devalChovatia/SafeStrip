from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from starlette import status
from ..models import Null
from ..database import get_db


router = APIRouter(tags=['genre'])


db_dependency = Annotated[Session, Depends(get_db)]

class GenreRequest(BaseModel):
    genre_name: str = Field(min_length=4)


@router.get('/genres', status_code=status.HTTP_200_OK)
async def getAllGenres(db: db_dependency):
    genres = db.query(Null).all()
    if not genres:
      raise HTTPException(status_code=404, detail="No Genres Available")
    return genres
    return genres