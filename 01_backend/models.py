from sqlalchemy import Column, Integer, String, Float, Boolean
from database import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    is_ops = Column(Boolean, default=False) # Para saber si es tarea técnica
    completed = Column(Boolean, default=False)

class Finance(Base):
    __tablename__ = "finances"

    id = Column(Integer, primary_key=True, index=True)
    concept = Column(String)
    amount = Column(Float)
    type = Column(String) # 'Ingreso' o 'Egreso'