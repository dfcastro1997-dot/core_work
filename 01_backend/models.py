from sqlalchemy import Column, Integer, String, Float, ForeignKey
from database import Base

class School(Base):
    __tablename__ = "schools"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    subscription_type = Column(String) 
    max_operators = Column(Integer, default=50)
    icon_url = Column(String, default="") 

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String) # 'admin', 'school', 'instructor', 'operator'
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=True)

class SimulationResult(Base):
    __tablename__ = "results"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    simulator_type = Column(String) 
    score = Column(Float)
    date = Column(String)
    details = Column(String)