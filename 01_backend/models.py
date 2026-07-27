from sqlalchemy import Column, Integer, String, Float, Boolean
from database import Base

class Setting(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, index=True) # profiles, subdivisions, expenses, fixed
    value = Column(String)

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    is_ops = Column(Boolean, default=False)
    completed = Column(Boolean, default=False)
    status = Column(String, default="todo") 
    time_spent = Column(Integer, default=0) 

class Finance(Base):
    __tablename__ = "finances"
    id = Column(Integer, primary_key=True, index=True)
    concept = Column(String)
    amount = Column(Float)
    type = Column(String) 
    entity = Column(String, nullable=True)
    date = Column(String, nullable=True)

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    date = Column(String)
    time = Column(String)
    company = Column(String)
    location = Column(String, nullable=True)

class Pocket(Base):
    __tablename__ = "pockets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    bank = Column(String)
    account = Column(String)
    target = Column(Float)
    current = Column(Float)

class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    type = Column(String)
    lastContact = Column(String)