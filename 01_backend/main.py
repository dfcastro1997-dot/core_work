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

# 2. Parches Automáticos y Datos Iniciales de Configuración
with database.SessionLocal() as session:
    try: session.execute(text("ALTER TABLE tasks ADD COLUMN status VARCHAR DEFAULT 'todo';")); session.commit()
    except Exception: session.rollback()
    try: session.execute(text("ALTER TABLE tasks ADD COLUMN time_spent INTEGER DEFAULT 0;")); session.commit()
    except Exception: session.rollback()
    try: session.execute(text("ALTER TABLE finances ADD COLUMN entity VARCHAR;")); session.commit()
    except Exception: session.rollback()
    try: session.execute(text("ALTER TABLE finances ADD COLUMN date VARCHAR;")); session.commit()
    except Exception: session.rollback()
    
    # Insertar configuraciones iniciales si la tabla está vacía
    if session.query(models.Setting).count() == 0:
        defaults = [
            ("profiles", "Inversor Principal"), ("profiles", "Proyecto Personal"),
            ("expenses", "Ingreso"), ("expenses", "Pasivo Fijo"), ("expenses", "Gasto Hormiga"),
            ("fixed", "Arriendo"), ("fixed", "Internet"),
            ("subdivisions", "General"), ("subdivisions", "Desarrollo")
        ]
        for t, v in defaults: session.add(models.Setting(type=t, value=v))
        session.commit()

app = FastAPI(title="CORE-WORK API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ==========================================
# MOTOR TELEGRAM: BOTONES Y MENÚS PROFESIONALES
# ==========================================
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
    if TELEGRAM_TOKEN and TELEGRAM_CHAT_ID: send_telegram_message(TELEGRAM_CHAT_ID, message)

def get_setting_keyboard(setting_type: str, prefix: str, db: Session):
    settings = db.query(models.Setting).filter(models.Setting.type == setting_type).all()
    buttons, row = [], []
    for s in settings:
        row.append({"text": s.value, "callback_data": f"{prefix}{s.id}"})
        if len(row) == 2:
            buttons.append(row)
            row = []
    if row: buttons.append(row)
    return {"inline_keyboard": buttons}

def get_main_menu():
    return {
        "inline_keyboard": [
            [{"text": "📊 Dashboard", "callback_data": "menu_dashboard"}, {"text": "📋 Kanban", "callback_data": "menu_kanban"}], 
            [{"text": "📅 Agenda", "callback_data": "menu_agenda"}, {"text": "💰 Finanzas", "callback_data": "menu_finanzas"}],
            [{"text": "⚙️ Configuraciones", "callback_data": "menu_config"}],
            [{"text": "➕ Nuevo Registro", "callback_data": "menu_add"}]
        ]
    }

def get_add_menu():
    return {
        "inline_keyboard": [
            [{"text": "📋 Tarea", "callback_data": "add_task"}, {"text": "📅 Evento", "callback_data": "add_event"}],
            [{"text": "💰 Ingreso", "callback_data": "add_income"}, {"text": "💸 Gasto", "callback_data": "add_expense"}],
            [{"text": "🔙 Menú Principal", "callback_data": "menu_main"}]
        ]
    }

def get_kanban_menu(task_id, current_status):
    buttons = []
    if current_status != "todo": buttons.append({"text": "🔙 Todo", "callback_data": f"status_{task_id}_todo"})
    if current_status != "in_progress": buttons.append({"text": "⏳ Prog", "callback_data": f"status_{task_id}_in_progress"})
    if current_status != "review": buttons.append({"text": "👀 Rev", "callback_data": f"status_{task_id}_review"})
    if current_status != "done": buttons.append({"text": "✅ Fin", "callback_data": f"status_{task_id}_done"})
    return {"inline_keyboard": [buttons]}

@app.post("/webhook/telegram")
async def telegram_webhook(request: Request, db: Session = Depends(database.get_db)):
    data = await request.json()
    
    # === LECTURA DE RESPUESTAS ESCRITAS (FORCE REPLY) ===
    if "message" in data and "text" in data["message"]:
        chat_id = data["message"]["chat"]["id"]
        text_msg = data["message"]["text"].strip()

        if "reply_to_message" in data["message"]:
            reply_text = data["message"]["reply_to_message"].get("text", "")
            
            # GUARDAR TAREA -> PREGUNTAR ENTIDAD
            if "NUEVA TAREA" in reply_text:
                db_task = models.Task(title=text_msg, status="todo", description='{"company": "General", "subdivision": "General", "date": "Sin Fecha"}')
                db.add(db_task); db.commit(); db.refresh(db_task)
                kb = get_setting_keyboard("profiles", f"tsk_ent_{db_task.id}_", db)
                send_telegram_message(chat_id, f"✅ Tarea guardada.\n\n<b>1. Selecciona la Entidad/Empresa:</b>", kb)
                return {"status": "ok"}
                
            # GUARDAR FINANZAS -> PREGUNTAR CATEGORÍA
            elif "NUEVO INGRESO" in reply_text or "NUEVO GASTO" in reply_text:
                is_income = "INGRESO" in reply_text
                parts = text_msg.split(" ", 1)
                if len(parts) == 2:
                    try:
                        amount, concept = float(parts[0]), parts[1]
                        t_val = "Ingreso" if is_income else "Gasto Extra"
                        db_fin = models.Finance(concept=concept, amount=amount, type=t_val, entity="General", date=datetime.now().strftime("%Y-%m-%d"))
                        db.add(db_fin); db.commit(); db.refresh(db_fin)
                        kb = get_setting_keyboard("expenses", f"fin_cat_{db_fin.id}_", db)
                        send_telegram_message(chat_id, f"✅ Guardado: ${amount:.2f}\n\n<b>1. Selecciona la Categoría:</b>", kb)
                    except ValueError: send_telegram_message(chat_id, "⚠️ El monto debe ser un número.", get_main_menu())
                else: send_telegram_message(chat_id, "⚠️ Error de formato. Ejemplo: 1500 Venta", get_main_menu())
                return {"status": "ok"}
            
            # GUARDAR EVENTO
            elif "NUEVO EVENTO" in reply_text:
                parts = text_msg.split(" ", 2)
                if len(parts) >= 3:
                    db_evt = models.Event(name=parts[2], date=parts[0], time=parts[1], company="General", location="Telegram")
                    db.add(db_evt); db.commit()
                    send_telegram_message(chat_id, f"✅ <b>Evento agendado.</b>", get_main_menu())
                else: send_telegram_message(chat_id, "⚠️ Error. Ej: 2026-08-15 14:00 Reunión", get_main_menu())
                return {"status": "ok"}
                
            # AÑADIR CONFIGURACIONES RÁPIDAS
            elif "NUEVA ENTIDAD" in reply_text:
                db.add(models.Setting(type="profiles", value=text_msg)); db.commit()
                send_telegram_message(chat_id, f"✅ Entidad añadida: {text_msg}", get_main_menu())
                return {"status": "ok"}
            elif "NUEVA RAMA" in reply_text:
                db.add(models.Setting(type="subdivisions", value=text_msg)); db.commit()
                send_telegram_message(chat_id, f"✅ Rama añadida: {text_msg}", get_main_menu())
                return {"status": "ok"}
            elif "NUEVA CATEGORIA" in reply_text:
                db.add(models.Setting(type="expenses", value=text_msg)); db.commit()
                send_telegram_message(chat_id, f"✅ Categoría añadida: {text_msg}", get_main_menu())
                return {"status": "ok"}
            elif "NUEVO GASTO FIJO" in reply_text:
                db.add(models.Setting(type="fixed", value=text_msg)); db.commit()
                send_telegram_message(chat_id, f"✅ Gasto fijo añadido: {text_msg}", get_main_menu())
                return {"status": "ok"}

        if text_msg.startswith(("/start", "/menu")):
            send_telegram_message(chat_id, "👋 <b>CORE-WORK OS (Nube Total)</b>", get_main_menu())
            return {"status": "ok"}

    # === LECTURA DE BOTONES (CALLBACKS) ===
    if "callback_query" in data:
        callback_id = data["callback_query"]["id"]
        chat_id = data["callback_query"]["message"]["chat"]["id"]
        message_id = data["callback_query"]["message"]["message_id"]
        call_data = data["callback_query"]["data"]

        # Navegación Menús
        if call_data == "menu_main": edit_telegram_message(chat_id, message_id, "👋 <b>CORE-WORK OS</b>", get_main_menu())
        elif call_data == "menu_add": edit_telegram_message(chat_id, message_id, "➕ <b>NUEVO REGISTRO</b>", get_add_menu())
        elif call_data == "add_task": send_telegram_message(chat_id, "📝 <b>NUEVA TAREA</b>\nEscribe el título:", {"force_reply": True})
        elif call_data == "add_income": send_telegram_message(chat_id, "💰 <b>NUEVO INGRESO</b>\nEscribe Monto y Concepto (Ej: 1500 Venta):", {"force_reply": True})
        elif call_data == "add_expense": send_telegram_message(chat_id, "💸 <b>NUEVO GASTO</b>\nEscribe Monto y Concepto (Ej: 45 Internet):", {"force_reply": True})
        elif call_data == "add_event": send_telegram_message(chat_id, "📅 <b>NUEVO EVENTO</b>\nEscribe Fecha(YYYY-MM-DD), Hora y Nombre:", {"force_reply": True})

        # Dashboard Visuals
        elif call_data == "menu_dashboard":
            tasks = db.query(models.Task).filter(models.Task.completed == False).all()
            send_telegram_message(chat_id, f"📊 <b>DASHBOARD</b>\n🔹 Activas: {len(tasks)}", get_main_menu())
        elif call_data == "menu_kanban":
            tasks = db.query(models.Task).filter(models.Task.completed == False).all()
            if not tasks: send_telegram_message(chat_id, "Sin tareas.", get_main_menu())
            else:
                send_telegram_message(chat_id, "📋 <b>Tus tareas:</b>")
                for t in tasks:
                    em = "⚪️" if t.status in ["todo", None] else ("🔵" if t.status == "in_progress" else "🟠")
                    send_telegram_message(chat_id, f"{em} <b>{t.title}</b>", get_kanban_menu(t.id, t.status))
        elif call_data == "menu_finanzas":
            finances = db.query(models.Finance).all()
            inc = sum([f.amount for f in finances if "Ingreso" in f.type])
            exp = sum([f.amount for f in finances if "Ingreso" not in f.type])
            send_telegram_message(chat_id, f"💰 <b>Balance Global:</b>\n📈 Ingresos: ${inc:.2f}\n📉 Egresos: ${exp:.2f}\n⚖️ <b>Neto: ${(inc - exp):.2f}</b>", get_main_menu())
        
        # WIZARD: Actualizar Tareas (Asignar Entidad y Rama)
        elif call_data.startswith("tsk_ent_"):
            parts = call_data.split("_")
            task_id, setting_id = int(parts[2]), int(parts[3])
            setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
            task = db.query(models.Task).filter(models.Task.id == task_id).first()
            if task and setting:
                meta = json.loads(task.description) if task.description else {}
                meta["company"] = setting.value
                task.description = json.dumps(meta)
                db.commit()
                edit_telegram_message(chat_id, message_id, f"✅ Entidad: {setting.value}")
                kb = get_setting_keyboard("subdivisions", f"tsk_sub_{task.id}_", db)
                send_telegram_message(chat_id, "<b>2. Selecciona la Rama/Subdivisión:</b>", kb)
                
        elif call_data.startswith("tsk_sub_"):
            parts = call_data.split("_")
            task_id, setting_id = int(parts[2]), int(parts[3])
            setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
            task = db.query(models.Task).filter(models.Task.id == task_id).first()
            if task and setting:
                meta = json.loads(task.description) if task.description else {}
                meta["subdivision"] = setting.value
                task.description = json.dumps(meta)
                db.commit()
                edit_telegram_message(chat_id, message_id, f"✅ Rama asignada: {setting.value}\n🎉 ¡Tarea configurada!", get_main_menu())

        # WIZARD: Actualizar Finanzas (Asignar Categoria y Entidad)
        elif call_data.startswith("fin_cat_"):
            parts = call_data.split("_")
            fin_id, setting_id = int(parts[2]), int(parts[3])
            setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
            fin = db.query(models.Finance).filter(models.Finance.id == fin_id).first()
            if fin and setting:
                fin.type = setting.value
                db.commit()
                edit_telegram_message(chat_id, message_id, f"✅ Categoría: {setting.value}")
                kb = get_setting_keyboard("profiles", f"fin_ent_{fin.id}_", db)
                send_telegram_message(chat_id, "<b>2. Selecciona la Entidad:</b>", kb)
                
        elif call_data.startswith("fin_ent_"):
            parts = call_data.split("_")
            fin_id, setting_id = int(parts[2]), int(parts[3])
            setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
            fin = db.query(models.Finance).filter(models.Finance.id == fin_id).first()
            if fin and setting:
                fin.entity = setting.value
                db.commit()
                edit_telegram_message(chat_id, message_id, f"✅ Entidad asignada: {setting.value}\n🎉 ¡Registro completado!", get_main_menu())

        # GESTIÓN DE CONFIGURACIONES DESDE TELEGRAM
        elif call_data == "menu_config":
            kb = {
                "inline_keyboard": [
                    [{"text": "🏭 Entidades", "callback_data": "conf_list_profiles"}, {"text": "🌿 Ramas", "callback_data": "conf_list_subdivisions"}],
                    [{"text": "💳 Cat. Finanzas", "callback_data": "conf_list_expenses"}, {"text": "📌 Gastos Fijos", "callback_data": "conf_list_fixed"}],
                    [{"text": "🔙 Volver", "callback_data": "menu_main"}]
                ]
            }
            edit_telegram_message(chat_id, message_id, "⚙️ <b>CONFIGURACIONES EN LA NUBE</b>\nSelecciona qué deseas gestionar:", kb)
            
        elif call_data.startswith("conf_list_"):
            setting_type = call_data.replace("conf_list_", "")
            settings = db.query(models.Setting).filter(models.Setting.type == setting_type).all()
            kb = {"inline_keyboard": []}
            for s in settings: kb["inline_keyboard"].append([{"text": f"❌ Borrar: {s.value}", "callback_data": f"conf_del_{s.id}"}])
            kb["inline_keyboard"].append([{"text": "➕ Añadir Nuevo", "callback_data": f"conf_add_{setting_type}"}])
            kb["inline_keyboard"].append([{"text": "🔙 Volver a Config", "callback_data": "menu_config"}])
            title_map = {"profiles": "Entidades", "subdivisions": "Ramas", "expenses": "Cat. Financieras", "fixed": "Gastos Fijos"}
            edit_telegram_message(chat_id, message_id, f"📝 <b>Gestionando {title_map.get(setting_type)}</b>", kb)

        elif call_data.startswith("conf_del_"):
            setting_id = int(call_data.replace("conf_del_", ""))
            db.query(models.Setting).filter(models.Setting.id == setting_id).delete(); db.commit()
            send_telegram_message(chat_id, "🗑 Opcion Eliminada.")
            
        elif call_data.startswith("conf_add_"):
            setting_type = call_data.replace("conf_add_", "")
            prompt_map = {"profiles": "🏭 NUEVA ENTIDAD", "subdivisions": "🌿 NUEVA RAMA", "expenses": "💳 NUEVA CATEGORIA", "fixed": "📌 NUEVO GASTO FIJO"}
            send_telegram_message(chat_id, f"{prompt_map.get(setting_type)}\nEscribe el nombre a continuación:", {"force_reply": True})

        # Mover tareas Kanban
        elif call_data.startswith("status_"):
            parts = call_data.split("_")
            task_id, new_status = int(parts[1]), "_".join(parts[2:])
            db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
            if db_task:
                db_task.status = new_status
                if new_status == "done": db_task.completed = True
                db.commit()
                em = "✅" if new_status == "done" else ("🔵" if new_status == "in_progress" else ("🟠" if new_status == "review" else "⚪️"))
                edit_telegram_message(chat_id, message_id, f"{em} <b>{db_task.title}</b>", None if new_status == "done" else get_kanban_menu(task_id, new_status))
        
        requests.post(f"{TELEGRAM_API_URL}/answerCallbackQuery", json={"callback_query_id": callback_id})
    return {"status": "ok"}

@app.get("/setup-telegram")
def setup_telegram(request: Request):
    if not TELEGRAM_TOKEN: return {"error": "Falta el TELEGRAM_BOT_TOKEN"}
    base_url = str(request.base_url).rstrip("/")
    requests.get(f"{TELEGRAM_API_URL}/setWebhook?url={base_url}/webhook/telegram")
    return {"message": "Webhook configurado"}

def send_daily_summary():
    db = database.SessionLocal()
    tasks = db.query(models.Task).filter(models.Task.completed == False).all()
    today_str = datetime.now().strftime("%Y-%m-%d")
    upcoming_limit = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
    td, up, ov = [], [], []
    for t in tasks:
        meta = {}
        try: meta = json.loads(t.description) if t.description else {}
        except: pass
        d = meta.get("date", "")
        if not d or d == "Sin Fecha": continue
        if d < today_str: ov.append((t, meta))
        elif d == today_str: td.append((t, meta))
        elif today_str < d <= upcoming_limit: up.append((t, meta))
    db.close()
    if not td and not up and not ov: return 
    msg = "📊 <b>RESUMEN DIARIO CORE-WORK</b>\n\n"
    if ov:
        msg += "🚨 <b>VENCIDAS:</b>\n"
        for t, m in ov: msg += f"• {t.title}\n"
    if td:
        msg += "\n📅 <b>HOY:</b>\n"
        for t, m in td: msg += f"• {t.title}\n"
    if up:
        msg += "\n🔜 <b>PRÓXIMOS 3 DÍAS:</b>\n"
        for t, m in up: msg += f"• {t.title} - {m.get('date')}\n"
    send_telegram_alert(msg)

@app.on_event("startup")
def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(send_daily_summary, CronTrigger(hour=7, minute=0))
    scheduler.start()


# === ESQUEMAS Y RUTAS REST===
class TaskCreate(BaseModel): title: str; description: str = None; is_ops: bool = False
class TaskUpdate(BaseModel): title: str = None; description: str = None; is_ops: bool = None; completed: bool = None; status: str = None; time_spent: int = None
class EventCreate(BaseModel): name: str; date: str; time: str; company: str; location: str = None
class FinanceCreate(BaseModel): concept: str; type: str; amount: float; entity: str = None; date: str = None
class PocketCreate(BaseModel): name: str; bank: str; account: str; target: float; current: float
class PocketUpdate(BaseModel): current: float
class ContactCreate(BaseModel): name: str; type: str; lastContact: str
class ContactUpdate(BaseModel): lastContact: str
class SettingCreate(BaseModel): type: str; value: str

@app.get("/settings")
def get_settings(db: Session = Depends(database.get_db)): return db.query(models.Setting).all()
@app.post("/settings")
def create_setting(setting: SettingCreate, db: Session = Depends(database.get_db)):
    db_obj = models.Setting(type=setting.type, value=setting.value); db.add(db_obj); db.commit(); db.refresh(db_obj)
    return db_obj
@app.delete("/settings/{item_id}")
def delete_setting(item_id: int, db: Session = Depends(database.get_db)):
    db.query(models.Setting).filter(models.Setting.id == item_id).delete(); db.commit()
    return {"msg": "ok"}

@app.get("/tasks")
def get_tasks(db: Session = Depends(database.get_db)): return db.query(models.Task).order_by(models.Task.id.desc()).all()
@app.post("/tasks")
def create_task(task: TaskCreate, db: Session = Depends(database.get_db)):
    db_task = models.Task(title=task.title, description=task.description, is_ops=task.is_ops, status="todo"); db.add(db_task); db.commit(); db.refresh(db_task)
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
    db.query(models.Task).filter(models.Task.id == item_id).delete(); db.commit()
    return {"msg": "ok"}

@app.get("/events")
def get_events(db: Session = Depends(database.get_db)): return db.query(models.Event).all()
@app.post("/events")
def create_event(evt: EventCreate, db: Session = Depends(database.get_db)):
    db_obj = models.Event(**evt.dict()); db.add(db_obj); db.commit()
    return db_obj
@app.delete("/events/{item_id}")
def delete_event(item_id: int, db: Session = Depends(database.get_db)):
    db.query(models.Event).filter(models.Event.id == item_id).delete(); db.commit()
    return {"msg": "ok"}

@app.get("/finances")
def get_finances(db: Session = Depends(database.get_db)): return db.query(models.Finance).all()
@app.post("/finances")
def create_finance(fin: FinanceCreate, db: Session = Depends(database.get_db)):
    db_obj = models.Finance(**fin.dict()); db.add(db_obj); db.commit()
    return db_obj
@app.delete("/finances/{item_id}")
def delete_finance(item_id: int, db: Session = Depends(database.get_db)):
    db.query(models.Finance).filter(models.Finance.id == item_id).delete(); db.commit()
    return {"msg": "ok"}

@app.get("/pockets")
def get_pockets(db: Session = Depends(database.get_db)): return db.query(models.Pocket).all()
@app.post("/pockets")
def create_pocket(pkt: PocketCreate, db: Session = Depends(database.get_db)):
    db_obj = models.Pocket(**pkt.dict()); db.add(db_obj); db.commit()
    return db_obj
@app.put("/pockets/{item_id}")
def update_pocket(item_id: int, pkt: PocketUpdate, db: Session = Depends(database.get_db)):
    db_obj = db.query(models.Pocket).filter(models.Pocket.id == item_id).first()
    db_obj.current = pkt.current; db.commit()
    return db_obj
@app.delete("/pockets/{item_id}")
def delete_pocket(item_id: int, db: Session = Depends(database.get_db)):
    db.query(models.Pocket).filter(models.Pocket.id == item_id).delete(); db.commit()
    return {"msg": "ok"}

@app.get("/contacts")
def get_contacts(db: Session = Depends(database.get_db)): return db.query(models.Contact).all()
@app.post("/contacts")
def create_contact(cnt: ContactCreate, db: Session = Depends(database.get_db)):
    db_obj = models.Contact(**cnt.dict()); db.add(db_obj); db.commit()
    return db_obj
@app.put("/contacts/{item_id}")
def update_contact(item_id: int, cnt: ContactUpdate, db: Session = Depends(database.get_db)):
    db_obj = db.query(models.Contact).filter(models.Contact.id == item_id).first()
    db_obj.lastContact = cnt.lastContact; db.commit()
    return db_obj
@app.delete("/contacts/{item_id}")
def delete_contact(item_id: int, db: Session = Depends(database.get_db)):
    db.query(models.Contact).filter(models.Contact.id == item_id).delete(); db.commit()
    return {"msg": "ok"}

@app.post("/test-telegram")
def test_telegram():
    send_daily_summary()
    return {"message": "ok"}