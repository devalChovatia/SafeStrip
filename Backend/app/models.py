from .database import Base
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey



class Null(Base):
    __tablename__ = 'Null'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)