import os
import json
import requests
from datetime import datetime, timedelta
from fastapi import Depends, FastAPI, HTTPException, Request
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
    try: session.execute(text("ALTER TABLE tasks ADD COLUMN status VARCHAR DEFAULT 'todo';")); session.commit()
    except Exception: session.rollback()
    try: session.execute(text("ALTER TABLE tasks ADD COLUMN time_spent INTEGER DEFAULT 0;")); session.commit()
    except Exception: session.rollback()
    try: session.execute(text("ALTER TABLE finances ADD COLUMN entity VARCHAR;")); session.commit()
    except Exception: session.rollback()
    try: session.execute(text("ALTER TABLE finances ADD COLUMN date VARCHAR;")); session.commit()
    except Exception: session.rollback()

app = FastAPI(title="CORE-WORK API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === INTEGRACIÓN TELEGRAM BOT INTERACTIVO ===
TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"

def send_telegram_message(chat_id, text, reply_markup=None):
    url = f"{TELEGRAM_API_URL}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup: payload["reply_markup"] = reply_markup
    requests.post(url, json=payload)

def edit_telegram_message(chat_id, message_id, text, reply_markup=None):
    url = f"{TELEGRAM_API_URL}/editMessageText"
    payload = {"chat_id": chat_id, "message_id": message_id, "text": text, "parse_mode": "HTML"}
    if reply_markup: payload["reply_markup"] = reply_markup
    requests.post(url, json=payload)

def send_telegram_alert(message: str):
    if TELEGRAM_TOKEN and TELEGRAM_CHAT_ID:
        send_telegram_message(TELEGRAM_CHAT_ID, message)

# --- MENÚS DE TELEGRAM ---
def get_main_menu():
    return {
        "inline_keyboard": [
            [{"text": "📊 Ver Dashboard", "callback_data": "menu_dashboard"}],
            [{"text": "📋 Tareas Kanban", "callback_data": "menu_kanban"}],
            [{"text": "📅 Ver Agenda", "callback_data": "menu_agenda"}, {"text": "💰 Balance Financiero", "callback_data": "menu_finanzas"}]
        ]
    }

def get_kanban_menu(task_id, current_status):
    buttons = []
    if current_status != "todo": buttons.append({"text": "🔙 Todo", "callback_data": f"status_{task_id}_todo"})
    if current_status != "in_progress": buttons.append({"text": "⏳ Progreso", "callback_data": f"status_{task_id}_in_progress"})
    if current_status != "review": buttons.append({"text": "👀 Revisión", "callback_data": f"status_{task_id}_review"})
    if current_status != "done": buttons.append({"text": "✅ Hecho", "callback_data": f"status_{task_id}_done"})
    return {"inline_keyboard": [buttons]}


@app.post("/webhook/telegram")
async def telegram_webhook(request: Request, db: Session = Depends(database.get_db)):
    data = await request.json()

    if "message" in data and "text" in data["message"]:
        chat_id = data["message"]["chat"]["id"]
        text = data["message"]["text"]

        if text.startswith("/start") or text.startswith("/menu"):
            welcome_msg = "👋 <b>Bienvenido a CORE-WORK OS (Nube Total)</b>\nSelecciona el módulo que deseas consultar o gestionar:"
            send_telegram_message(chat_id, welcome_msg, get_main_menu())
            return {"status": "ok"}

    if "callback_query" in data:
        callback_id = data["callback_query"]["id"]
        chat_id = data["callback_query"]["message"]["chat"]["id"]
        message_id = data["callback_query"]["message"]["message_id"]
        call_data = data["callback_query"]["data"]

        if call_data == "menu_dashboard":
            tasks = db.query(models.Task).filter(models.Task.completed == False).all()
            todo = len([t for t in tasks if t.status == 'todo' or not t.status])
            prog = len([t for t in tasks if t.status == 'in_progress'])
            rev = len([t for t in tasks if t.status == 'review'])
            
            msg = f"📊 <b>MÉTRICAS DASHBOARD</b>\n\n"
            msg += f"🔹 <b>Total Activas:</b> {len(tasks)}\n"
            msg += f"⚪️ <b>Por Hacer:</b> {todo}\n"
            msg += f"🔵 <b>En Progreso:</b> {prog}\n"
            msg += f"🟠 <b>En Revisión:</b> {rev}\n"
            send_telegram_message(chat_id, msg, get_main_menu())

        elif call_data == "menu_kanban":
            tasks = db.query(models.Task).filter(models.Task.completed == False).all()
            if not tasks:
                send_telegram_message(chat_id, "No tienes tareas pendientes.", get_main_menu())
            else:
                send_telegram_message(chat_id, "📋 <b>Tus tareas actuales:</b>")
                for t in tasks:
                    st_em = "⚪️"
                    if t.status == "in_progress": st_em = "🔵"
                    if t.status == "review": st_em = "🟠"
                    send_telegram_message(chat_id, f"{st_em} <b>{t.title}</b>", get_kanban_menu(t.id, t.status))

        elif call_data == "menu_agenda":
            events = db.query(models.Event).order_by(models.Event.date.asc()).limit(5).all()
            if not events:
                send_telegram_message(chat_id, "Tu agenda está libre de eventos.", get_main_menu())
            else:
                msg = "📅 <b>Próximos Eventos:</b>\n\n"
                for e in events:
                    msg += f"• <b>{e.date} {e.time}</b>: {e.name} <i>({e.company})</i>\n"
                send_telegram_message(chat_id, msg, get_main_menu())

        elif call_data == "menu_finanzas":
            finances = db.query(models.Finance).all()
            inc = sum([f.amount for f in finances if "Ingreso" in f.type])
            exp = sum([f.amount for f in finances if "Ingreso" not in f.type])
            msg = f"💰 <b>Balance Financiero Global:</b>\n\n"
            msg += f"📈 Ingresos Totales: ${inc:.2f}\n"
            msg += f"📉 Egresos Totales: ${exp:.2f}\n"
            msg += f"⚖️ <b>Neto: ${(inc - exp):.2f}</b>\n"
            send_telegram_message(chat_id, msg, get_main_menu())

        elif call_data.startswith("status_"):
            parts = call_data.split("_")
            task_id = int(parts[1])
            new_status = "_".join(parts[2:])
            
            db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
            if db_task:
                db_task.status = new_status
                if new_status == "done": db_task.completed = True
                db.commit()
                
                st_em = "⚪️"
                if new_status == "in_progress": st_em = "🔵"
                if new_status == "review": st_em = "🟠"
                if new_status == "done": st_em = "✅"
                
                new_markup = None if new_status == "done" else get_kanban_menu(task_id, new_status)
                edit_telegram_message(chat_id, message_id, f"{st_em} <b>{db_task.title}</b>", new_markup)

        requests.post(f"{TELEGRAM_API_URL}/answerCallbackQuery", json={"callback_query_id": callback_id})
    return {"status": "ok"}

@app.get("/setup-telegram")
def setup_telegram(request: Request):
    if not TELEGRAM_TOKEN: return {"error": "Falta el TELEGRAM_BOT_TOKEN"}
    base_url = str(request.base_url).rstrip("/")
    webhook_url = f"{base_url}/webhook/telegram"
    response = requests.get(f"{TELEGRAM_API_URL}/setWebhook?url={webhook_url}")
    return {"message": "Webhook configurado", "telegram_response": response.json()}


# === RUTINA DIARIA (07:00 AM) ===
def send_daily_summary():
    db = database.SessionLocal()
    tasks = db.query(models.Task).filter(models.Task.completed == False).all()
    today_str = datetime.now().strftime("%Y-%m-%d")
    upcoming_limit = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
    
    today_tasks, upcoming_tasks, overdue_tasks = [], [], []

    for t in tasks:
        meta = {}
        if t.description:
            try: meta = json.loads(t.description)
            except: pass
        due_date = meta.get("date", "")
        if not due_date or due_date == "Sin Fecha": continue
            
        if due_date < today_str: overdue_tasks.append((t, meta))
        elif due_date == today_str: today_tasks.append((t, meta))
        elif today_str < due_date <= upcoming_limit: upcoming_tasks.append((t, meta))
            
    db.close()

    if not today_tasks and not upcoming_tasks and not overdue_tasks: return 

    msg = "📊 <b>RESUMEN DIARIO CORE-WORK</b>\n\n"
    if overdue_tasks:
        msg += "🚨 <b>TAREAS VENCIDAS:</b>\n"
        for t, meta in overdue_tasks: msg += f"• {t.title}\n"
        msg += "\n"
    if today_tasks:
        msg += "📅 <b>PARA HOY:</b>\n"
        for t, meta in today_tasks: msg += f"• {t.title}\n"
        msg += "\n"
    if upcoming_tasks:
        msg += "🔜 <b>PRÓXIMOS 3 DÍAS:</b>\n"
        for t, meta in upcoming_tasks: msg += f"• {t.title} - {meta.get('date')}\n"

    send_telegram_alert(msg)

@app.on_event("startup")
def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(send_daily_summary, CronTrigger(hour=7, minute=0))
    scheduler.start()


# === ESQUEMAS Y RUTAS REST (MIGRACIÓN TOTAL) ===
class TaskCreate(BaseModel): title: str; description: str = None; is_ops: bool = False
class TaskUpdate(BaseModel): title: str = None; description: str = None; is_ops: bool = None; completed: bool = None; status: str = None; time_spent: int = None
class EventCreate(BaseModel): name: str; date: str; time: str; company: str; location: str = None
class FinanceCreate(BaseModel): concept: str; type: str; amount: float; entity: str = None; date: str = None
class PocketCreate(BaseModel): name: str; bank: str; account: str; target: float; current: float
class PocketUpdate(BaseModel): current: float
class ContactCreate(BaseModel): name: str; type: str; lastContact: str
class ContactUpdate(BaseModel): lastContact: str

# TAREAS
@app.get("/tasks")
def get_tasks(db: Session = Depends(database.get_db)): return db.query(models.Task).order_by(models.Task.id.desc()).all()
@app.post("/tasks")
def create_task(task: TaskCreate, db: Session = Depends(database.get_db)):
    db_task = models.Task(title=task.title, description=task.description, is_ops=task.is_ops, status="todo")
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    send_telegram_alert(f"🚀 <b>Nueva Tarea</b>\n👉 {task.title}")
    return db_task
@app.put("/tasks/{item_id}")
def update_task(item_id: int, task: TaskUpdate, db: Session = Depends(database.get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == item_id).first()
    if task.title is not None: db_task.title = task.title
    if task.description is not None: db_task.description = task.description
    if task.completed is not None: db_task.completed = task.completed
    if task.status is not None: db_task.status = task.status
    if task.time_spent is not None: db_task.time_spent = task.time_spent
    db.commit()
    return db_task
@app.delete("/tasks/{item_id}")
def delete_task(item_id: int, db: Session = Depends(database.get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == item_id).first()
    db.delete(db_task)
    db.commit()
    return {"msg": "ok"}

# EVENTOS
@app.get("/events")
def get_events(db: Session = Depends(database.get_db)): return db.query(models.Event).all()
@app.post("/events")
def create_event(evt: EventCreate, db: Session = Depends(database.get_db)):
    db_obj = models.Event(**evt.dict())
    db.add(db_obj)
    db.commit()
    return db_obj
@app.delete("/events/{item_id}")
def delete_event(item_id: int, db: Session = Depends(database.get_db)):
    db.query(models.Event).filter(models.Event.id == item_id).delete()
    db.commit()
    return {"msg": "ok"}

# FINANZAS
@app.get("/finances")
def get_finances(db: Session = Depends(database.get_db)): return db.query(models.Finance).all()
@app.post("/finances")
def create_finance(fin: FinanceCreate, db: Session = Depends(database.get_db)):
    db_obj = models.Finance(**fin.dict())
    db.add(db_obj)
    db.commit()
    return db_obj
@app.delete("/finances/{item_id}")
def delete_finance(item_id: int, db: Session = Depends(database.get_db)):
    db.query(models.Finance).filter(models.Finance.id == item_id).delete()
    db.commit()
    return {"msg": "ok"}

# BOLSILLOS
@app.get("/pockets")
def get_pockets(db: Session = Depends(database.get_db)): return db.query(models.Pocket).all()
@app.post("/pockets")
def create_pocket(pkt: PocketCreate, db: Session = Depends(database.get_db)):
    db_obj = models.Pocket(**pkt.dict())
    db.add(db_obj)
    db.commit()
    return db_obj
@app.put("/pockets/{item_id}")
def update_pocket(item_id: int, pkt: PocketUpdate, db: Session = Depends(database.get_db)):
    db_obj = db.query(models.Pocket).filter(models.Pocket.id == item_id).first()
    db_obj.current = pkt.current
    db.commit()
    return db_obj
@app.delete("/pockets/{item_id}")
def delete_pocket(item_id: int, db: Session = Depends(database.get_db)):
    db.query(models.Pocket).filter(models.Pocket.id == item_id).delete()
    db.commit()
    return {"msg": "ok"}

# CONTACTOS (CRM)
@app.get("/contacts")
def get_contacts(db: Session = Depends(database.get_db)): return db.query(models.Contact).all()
@app.post("/contacts")
def create_contact(cnt: ContactCreate, db: Session = Depends(database.get_db)):
    db_obj = models.Contact(**cnt.dict())
    db.add(db_obj)
    db.commit()
    return db_obj
@app.put("/contacts/{item_id}")
def update_contact(item_id: int, cnt: ContactUpdate, db: Session = Depends(database.get_db)):
    db_obj = db.query(models.Contact).filter(models.Contact.id == item_id).first()
    db_obj.lastContact = cnt.lastContact
    db.commit()
    return db_obj
@app.delete("/contacts/{item_id}")
def delete_contact(item_id: int, db: Session = Depends(database.get_db)):
    db.query(models.Contact).filter(models.Contact.id == item_id).delete()
    db.commit()
    return {"msg": "ok"}

@app.post("/test-telegram")
def test_telegram():
    send_daily_summary()
    return {"message": "Resumen enviado"}