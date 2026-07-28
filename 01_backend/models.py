from sqlalchemy import Column, Integer, String, Float
from database import Base

class Setting(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, index=True) # entities, categories, fixed
    value = Column(String)

class Finance(Base):
    __tablename__ = "finances"
    id = Column(Integer, primary_key=True, index=True)
    concept = Column(String)
    amount = Column(Float)
    type = Column(String) 
    entity = Column(String, nullable=True)
    date = Column(String, nullable=True)

class Pocket(Base):
    __tablename__ = "pockets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    bank = Column(String)
    account = Column(String)
    target = Column(Float)
    current = Column(Float)