from sqlalchemy import Column, Integer, String, Float
from database import Base

class Setting(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, index=True) # categories
    value = Column(String)

class Finance(Base):
    __tablename__ = "finances"
    id = Column(Integer, primary_key=True, index=True)
    concept = Column(String)
    amount = Column(Float)
    type = Column(String) 
    date = Column(String, nullable=True)