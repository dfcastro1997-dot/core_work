import os
import json
import requests
from datetime import datetime, timedelta
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

import database
import models

# 1. Crear tablas en PostgreSQL
models.Base.metadata.create_all(bind=database.engine)

# 2. Parche Automático
with database.SessionLocal() as session:
    try:
        session.execute(text("ALTER TABLE tasks ADD COLUMN status VARCHAR DEFAULT 'todo';"))
        session.commit()
    except Exception:
        session.rollback()
    try:
        session.execute(text("ALTER TABLE tasks ADD COLUMN time_spent INTEGER DEFAULT 0;"))
        session.commit()
    except Exception:
        session.rollback()

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
        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "HTML" # Usamos HTML para formatear el mensaje bonito
        }
        try:
            requests.post(url, json=payload)
        except Exception as e:
            print("Error enviando Telegram:", e)

# === RUTINA DIARIA (07:00 AM) ===
def send_daily_summary():
    db = database.SessionLocal()
    tasks = db.query(models.Task).filter(models.Task.completed == False).all()
    
    today_str = datetime.now().strftime("%Y-%m-%d")
    upcoming_limit = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
    
    today_tasks = []
    upcoming_tasks = []
    overdue_tasks = []

    for t in tasks:
        meta = {}
        if t.description:
            try:
                meta = json.loads(t.description)
            except:
                pass
        
        due_date = meta.get("date", "")
        if not due_date or due_date == "Sin Fecha":
            continue
            
        if due_date < today_str:
            overdue_tasks.append((t, meta))
        elif due_date == today_str:
            today_tasks.append((t, meta))
        elif today_str < due_date <= upcoming_limit:
            upcoming_tasks.append((t, meta))
            
    db.close()

    if not today_tasks and not upcoming_tasks and not overdue_tasks:
        return # Si no hay nada, no enviamos mensaje

    msg = "📊 <b>RESUMEN DIARIO CORE-WORK</b>\n\n"
    
    if overdue_tasks:
        msg += "🚨 <b>TAREAS VENCIDAS:</b>\n"
        for t, meta in overdue_tasks:
            msg += f"• {t.title} <i>({meta.get('company', 'General')})</i>\n"
        msg += "\n"
        
    if today_tasks:
        msg += "📅 <b>PARA HOY:</b>\n"
        for t, meta in today_tasks:
            msg += f"• {t.title} <i>({meta.get('company', 'General')})</i>\n"
        msg += "\n"
        
    if upcoming_tasks:
        msg += "🔜 <b>PRÓXIMOS 3 DÍAS:</b>\n"
        for t, meta in upcoming_tasks:
            msg += f"• {t.title} - {meta.get('date')} <i>({meta.get('company', 'General')})</i>\n"

    send_telegram_alert(msg)

@app.on_event("startup")
def start_scheduler():
    scheduler = BackgroundScheduler()
    # Ejecutar todos los días a las 07:00 AM (Hora del servidor Render)
    scheduler.add_job(send_daily_summary, CronTrigger(hour=7, minute=0))
    scheduler.start()


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
    
    send_telegram_alert(f"🚀 <b>Nueva Tarea Asignada</b>\n👉 {task.title}")
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
            send_telegram_alert(f"✅ <b>Tarea Completada</b>\n👉 {db_task.title}")
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

@app.post("/test-telegram")
def test_telegram():
    """Endpoint para forzar el envío del resumen diario"""
    send_daily_summary()
    return {"message": "Resumen enviado"}