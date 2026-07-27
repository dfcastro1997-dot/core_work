from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

import database
import models

# Crear tablas en PostgreSQL de Aiven si no existen
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="CORE-WORK API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Esquemas Pydantic
class TaskCreate(BaseModel):
    title: str
    description: str = None
    is_ops: bool = False


class TaskUpdate(BaseModel):
    title: str = None
    description: str = None
    is_ops: bool = None
    completed: bool = None


@app.get("/")
def read_root():
    return {"message": "CORE-WORK API En línea"}


# Obtenes todas las tareas
@app.get("/tasks")
def get_tasks(db: Session = Depends(database.get_db)):
    return db.query(models.Task).order_by(models.Task.id.desc()).all()


# Crear tarea
@app.post("/tasks")
def create_task(task: TaskCreate, db: Session = Depends(database.get_db)):
    db_task = models.Task(
        title=task.title, description=task.description, is_ops=task.is_ops
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


# Editar / Actualizar tarea (completar o modificar texto/ops)
@app.put("/tasks/{task_id}")
def update_task(
    task_id: int, task: TaskUpdate, db: Session = Depends(database.get_db)
):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if task.title is not None:
        db_task.title = task.title
    if task.description is not None:
        db_task.description = task.description
    if task.is_ops is not None:
        db_task.is_ops = task.is_ops
    if task.completed is not None:
        db_task.completed = task.completed

    db.commit()
    db.refresh(db_task)
    return db_task


# Eliminar tarea
@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(database.get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    db.delete(db_task)
    db.commit()
    return {"message": "Tarea eliminada con éxito"}