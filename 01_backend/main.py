from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models, database
from pydantic import BaseModel

# Crea las tablas en Aiven si no existen
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="CORE-WORK API")

# Configurar CORS para permitir que el Frontend (HTML) hable con el Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción cambiar por la URL de tu frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Esquema Pydantic para recibir datos
class TaskCreate(BaseModel):
    title: str
    description: str = None
    is_ops: bool = False

@app.get("/")
def read_root():
    return {"message": "CORE-WORK API En línea"}

@app.get("/tasks")
def get_tasks(db: Session = Depends(database.get_db)):
    return db.query(models.Task).all()

@app.post("/tasks")
def create_task(task: TaskCreate, db: Session = Depends(database.get_db)):
    db_task = models.Task(title=task.title, description=task.description, is_ops=task.is_ops)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task