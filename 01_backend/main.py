import os
import requests
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

import database
import models

# Crear tablas en PostgreSQL
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="CORE-WORK API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === INTEGRACIÓN TELEGRAM ===
TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def send_telegram_alert(message: str):
    if TELEGRAM_TOKEN and TELEGRAM_CHAT_ID:
        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
        try:
            requests.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": f"🚀 [CORE-WORK OPS]\n{message}"})
        except Exception as e:
            print("Error enviando Telegram:", e)


# === ESQUEMAS PYDANTIC ===
class TaskCreate(BaseModel):
    title: str
    description: str = None
    is_ops: bool = False

class TaskUpdate(BaseModel):
    title: str = None
    description: str = None
    is_ops: bool = None
    completed: bool = None
    status: str = None
    time_spent: int = None


@app.get("/")
def read_root():
    return {"message": "CORE-WORK API En línea"}

@app.get("/tasks")
def get_tasks(db: Session = Depends(database.get_db)):
    return db.query(models.Task).order_by(models.Task.id.desc()).all()

@app.post("/tasks")
def create_task(task: TaskCreate, db: Session = Depends(database.get_db)):
    db_task = models.Task(
        title=task.title, description=task.description, is_ops=task.is_ops, status="todo"
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Enviar alerta de Telegram al crear tarea
    send_telegram_alert(f"Nueva Tarea Asignada:\n👉 {task.title}")
    
    return db_task

@app.put("/tasks/{task_id}")
def update_task(task_id: int, task: TaskUpdate, db: Session = Depends(database.get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if task.title is not None: db_task.title = task.title
    if task.description is not None: db_task.description = task.description
    if task.is_ops is not None: db_task.is_ops = task.is_ops
    if task.completed is not None: db_task.completed = task.completed
    if task.status is not None: 
        db_task.status = task.status
        if task.status == "done":
            send_telegram_alert(f"✅ Tarea Completada:\n👉 {db_task.title}")
    if task.time_spent is not None: db_task.time_spent = task.time_spent

    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(database.get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    db.delete(db_task)
    db.commit()
    return {"message": "Tarea eliminada"}