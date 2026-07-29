from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean
from database import Base

class School(Base):
    __tablename__ = "schools"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    subscription_type = Column(String) 
    max_operators = Column(Integer, default=50)
    max_instructors = Column(Integer, default=10)
    icon_url = Column(String, default="") 
    is_active = Column(Boolean, default=True) 
    allowed_sims = Column(String, default="DENSITY,VMS-X") 

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String) 
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=True)

class SimulationResult(Base):
    __tablename__ = "results"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    simulator_type = Column(String) 
    score = Column(Float)
    date = Column(String)
    details = Column(String)
    feedback = Column(String, default="") 

# --- NUEVAS TABLAS PARA EL SISTEMA DE EVALUACIONES ---

class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"))
    instructor_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    questions = Column(String) # Guardará un JSON estructurado
    time_limit = Column(Integer) # Tiempo en minutos
    assigned_operators = Column(String) # Arreglo JSON de IDs de operadores
    date_created = Column(String)
    is_active = Column(Boolean, default=True)

class QuizResult(Base):
    __tablename__ = "quiz_results"
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    operator_id = Column(Integer, ForeignKey("users.id"))
    score = Column(Float) # Calificación sobre 100
    date = Column(String)