import os
import json
import requests
import tempfile
from datetime import datetime, timedelta
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fpdf import FPDF

import database
import models

# 1. Crear tablas en PostgreSQL
models.Base.metadata.create_all(bind=database.engine)

# 2. Parches Automáticos y Datos Iniciales de Configuración
with database.SessionLocal() as session:
    try: session.execute(text("ALTER TABLE finances ADD COLUMN entity VARCHAR;")); session.commit()
    except Exception: session.rollback()
    try: session.execute(text("ALTER TABLE finances ADD COLUMN date VARCHAR;")); session.commit()
    except Exception: session.rollback()
    
    # Insertar configuraciones iniciales
    if session.query(models.Setting).count() == 0:
        defaults = [
            ("entities", "Cliente Principal"), ("entities", "Proyecto Externo"),
            ("categories", "Ingreso Operativo"), ("categories", "Pasivo Fijo"), ("categories", "Gasto Variable"),
            ("fixed", "Arriendo Oficina"), ("fixed", "Suscripciones SaaS")
        ]
        for t, v in defaults: session.add(models.Setting(type=t, value=v))
        session.commit()

app = FastAPI(title="CORE-FINANCE API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ==========================================
# GENERADOR PDF MODERNO Y ELEGANTE
# ==========================================
class FinancialPDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 18)
        self.set_text_color(15, 23, 42) # Slate-900
        self.cell(0, 10, 'CORE-FINANCE', 0, 1, 'L')
        self.set_font('Arial', '', 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, 'Extracto Financiero Profesional', 0, 1, 'L')
        self.set_draw_color(200, 200, 200)
        self.line(10, 28, 200, 28)
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'Pagina {self.page_no()}', 0, 0, 'C')

def create_pdf_extract(finances, period_label):
    pdf = FinancialPDF()
    pdf.add_page()
    
    # Resumen
    pdf.set_font("Arial", 'B', 12)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 10, f"Periodo: {period_label}", 0, 1)
    
    # Tabla Cabecera
    pdf.set_fill_color(241, 245, 249) # Slate-100
    pdf.set_font("Arial", 'B', 10)
    pdf.cell(30, 10, "Fecha", border=1, fill=True)
    pdf.cell(65, 10, "Concepto", border=1, fill=True)
    pdf.cell(50, 10, "Categoria", border=1, fill=True)
    pdf.cell(45, 10, "Monto ($)", border=1, fill=True, align='R')
    pdf.ln()
    
    # Tabla Cuerpo
    pdf.set_font("Arial", size=9)
    total_inc = 0.0
    total_exp = 0.0
    
    for f in finances:
        pdf.set_text_color(15, 23, 42)
        pdf.cell(30, 8, str(f.date), border=1)
        pdf.cell(65, 8, str(f.concept)[:35], border=1)
        pdf.cell(50, 8, str(f.type)[:25], border=1)
        
        amt_str = f"${f.amount:,.2f}"
        if "Ingreso" in f.type:
            pdf.set_text_color(16, 185, 129) # Emerald-500
            total_inc += f.amount
        else:
            pdf.set_text_color(225, 29, 72) # Rose-600
            total_exp += f.amount
            
        pdf.cell(45, 8, amt_str, border=1, align='R')
        pdf.ln()
    
    # Totales
    pdf.ln(10)
    pdf.set_font("Arial", 'B', 12)
    pdf.set_text_color(15, 23, 42)
    
    neto = total_inc - total_exp
    pdf.cell(100, 8, f"Total Ingresos: ${total_inc:,.2f}", 0, 1)
    pdf.cell(100, 8, f"Total Egresos: ${total_exp:,.2f}", 0, 1)
    
    pdf.set_font("Arial", 'B', 14)
    pdf.set_text_color(16, 185, 129) if neto >= 0 else pdf.set_text_color(225, 29, 72)
    pdf.cell(100, 12, f"BALANCE NETO: ${neto:,.2f}", 0, 1)
    
    # Guardar Temporalmente
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    pdf.output(temp_file.name)
    return temp_file.name


# ==========================================
# MOTOR TELEGRAM: FINANZAS PROFESIONALES
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

def send_telegram_document(chat_id, doc_path, caption=""):
    url = f"{TELEGRAM_API_URL}/sendDocument"
    with open(doc_path, "rb") as doc:
        files = {"document": doc}
        data = {"chat_id": chat_id, "caption": caption, "parse_mode": "HTML"}
        requests.post(url, data=data, files=files)

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
            [{"text": "💰 + Ingreso Rápido", "callback_data": "add_income"}, {"text": "💸 - Gasto Rápido", "callback_data": "add_expense"}],
            [{"text": "📊 Resumen General", "callback_data": "menu_dashboard"}, {"text": "🏦 Mis Cuentas", "callback_data": "menu_pockets"}],
            [{"text": "📄 Generar Extracto PDF", "callback_data": "menu_pdf"}],
            [{"text": "⚙️ Configuraciones", "callback_data": "menu_config"}]
        ]
    }

def get_pdf_menu():
    return {
        "inline_keyboard": [
            [{"text": "📅 Hoy", "callback_data": "pdf_day"}, {"text": "📆 Esta Semana", "callback_data": "pdf_week"}],
            [{"text": "🗓 Este Mes", "callback_data": "pdf_month"}, {"text": "🌍 Este Año", "callback_data": "pdf_year"}],
            [{"text": "🔙 Menú Principal", "callback_data": "menu_main"}]
        ]
    }

@app.post("/webhook/telegram")
async def telegram_webhook(request: Request, db: Session = Depends(database.get_db)):
    data = await request.json()
    
    if "message" in data and "text" in data["message"]:
        chat_id = data["message"]["chat"]["id"]
        text_msg = data["message"]["text"].strip()

        if "reply_to_message" in data["message"]:
            reply_text = data["message"]["reply_to_message"].get("text", "")
            
            # GUARDAR FINANZAS
            if "NUEVO INGRESO" in reply_text or "NUEVO GASTO" in reply_text:
                is_income = "INGRESO" in reply_text
                parts = text_msg.split(" ", 1)
                if len(parts) == 2:
                    try:
                        amount, concept = float(parts[0]), parts[1]
                        t_val = "Ingreso Operativo" if is_income else "Gasto Variable"
                        db_fin = models.Finance(concept=concept, amount=amount, type=t_val, entity="General", date=datetime.now().strftime("%Y-%m-%d"))
                        db.add(db_fin); db.commit(); db.refresh(db_fin)
                        kb = get_setting_keyboard("categories", f"fin_cat_{db_fin.id}_", db)
                        send_telegram_message(chat_id, f"✅ Registro Exitoso: <b>${amount:,.2f}</b>\n\n<b>1. Selecciona la Categoría Financiera:</b>", kb)
                    except ValueError: send_telegram_message(chat_id, "⚠️ El monto debe ser numérico.", get_main_menu())
                else: send_telegram_message(chat_id, "⚠️ Formato incorrecto. Ejemplo: 1500 Consultoría", get_main_menu())
                return {"status": "ok"}
                
            # CONFIGURACIONES
            elif "NUEVA ENTIDAD" in reply_text:
                db.add(models.Setting(type="entities", value=text_msg)); db.commit()
                send_telegram_message(chat_id, f"✅ Entidad/Cliente añadido: {text_msg}", get_main_menu())
                return {"status": "ok"}
            elif "NUEVA CATEGORIA" in reply_text:
                db.add(models.Setting(type="categories", value=text_msg)); db.commit()
                send_telegram_message(chat_id, f"✅ Categoría financiera añadida: {text_msg}", get_main_menu())
                return {"status": "ok"}
            elif "NUEVO GASTO FIJO" in reply_text:
                db.add(models.Setting(type="fixed", value=text_msg)); db.commit()
                send_telegram_message(chat_id, f"✅ Gasto fijo añadido: {text_msg}", get_main_menu())
                return {"status": "ok"}

        if text_msg.startswith(("/start", "/menu")):
            send_telegram_message(chat_id, "💼 <b>CORE-FINANCE OS</b>\nCentro de Control Financiero", get_main_menu())
            return {"status": "ok"}

    if "callback_query" in data:
        callback_id = data["callback_query"]["id"]
        chat_id = data["callback_query"]["message"]["chat"]["id"]
        message_id = data["callback_query"]["message"]["message_id"]
        call_data = data["callback_query"]["data"]

        if call_data == "menu_main": edit_telegram_message(chat_id, message_id, "💼 <b>CORE-FINANCE OS</b>", get_main_menu())
        elif call_data == "add_income": send_telegram_message(chat_id, "💰 <b>NUEVO INGRESO</b>\nDigita Monto y Concepto (Ej: 1500 Venta Local):", {"force_reply": True})
        elif call_data == "add_expense": send_telegram_message(chat_id, "💸 <b>NUEVO GASTO</b>\nDigita Monto y Concepto (Ej: 45 Internet):", {"force_reply": True})

        # RESUMEN GENERAL
        elif call_data == "menu_dashboard":
            finances = db.query(models.Finance).all()
            inc = sum([f.amount for f in finances if "Ingreso" in f.type])
            exp = sum([f.amount for f in finances if "Ingreso" not in f.type])
            msg = f"📊 <b>ESTADO PATRIMONIAL GLOBAL:</b>\n\n📈 Ingresos: ${inc:,.2f}\n📉 Egresos: ${exp:,.2f}\n⚖️ <b>Flujo de Caja: ${(inc - exp):,.2f}</b>"
            send_telegram_message(chat_id, msg, get_main_menu())
            
        # CUENTAS / BOLSILLOS
        elif call_data == "menu_pockets":
            pockets = db.query(models.Pocket).all()
            if not pockets: 
                send_telegram_message(chat_id, "⚠️ No tienes cuentas bancarias ni bolsillos registrados.", get_main_menu())
            else:
                msg = "🏦 <b>ESTADO DE CUENTAS (BOLSILLOS):</b>\n\n"
                total_liq = 0
                for p in pockets:
                    prog = min(int((p.current / p.target) * 100) if p.target > 0 else 0, 100)
                    msg += f"🔹 <b>{p.name}</b> ({p.bank})\n💰 Saldo: ${p.current:,.2f} <i>(Meta: {prog}%)</i>\n\n"
                    total_liq += p.current
                msg += f"💵 <b>Líquidez Total: ${total_liq:,.2f}</b>"
                send_telegram_message(chat_id, msg, get_main_menu())

        # MENÚ GENERAR PDF
        elif call_data == "menu_pdf":
            edit_telegram_message(chat_id, message_id, "📄 <b>GENERAR EXTRACTO PDF</b>\nSelecciona el periodo del reporte:", get_pdf_menu())
            
        elif call_data.startswith("pdf_"):
            period = call_data.replace("pdf_", "")
            today = datetime.now()
            
            if period == "day": 
                start_date = today.strftime("%Y-%m-%d")
                label = f"Diario ({start_date})"
            elif period == "week": 
                start_date = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")
                label = f"Semanal (Desde {start_date})"
            elif period == "month": 
                start_date = today.replace(day=1).strftime("%Y-%m-%d")
                label = f"Mensual (Desde {start_date})"
            elif period == "year": 
                start_date = today.replace(month=1, day=1).strftime("%Y-%m-%d")
                label = f"Anual (Desde {start_date})"
                
            finances = db.query(models.Finance).filter(models.Finance.date >= start_date).order_by(models.Finance.date.desc()).all()
            
            if not finances:
                send_telegram_message(chat_id, f"⚠️ No hay transacciones en el periodo: {label}", get_main_menu())
            else:
                send_telegram_message(chat_id, "⏳ Generando tu reporte elegante. Por favor espera...")
                pdf_path = create_pdf_extract(finances, label)
                send_telegram_document(chat_id, pdf_path, caption=f"📄 <b>Extracto {label} generado.</b>")
                os.remove(pdf_path) # Limpiar archivo temporal
                send_telegram_message(chat_id, "¿Deseas hacer algo más?", get_main_menu())

        
        # WIZARD: Actualizar Finanzas
        elif call_data.startswith("fin_cat_"):
            parts = call_data.split("_")
            fin_id, setting_id = int(parts[2]), int(parts[3])
            setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
            fin = db.query(models.Finance).filter(models.Finance.id == fin_id).first()
            if fin and setting:
                fin.type = setting.value
                db.commit()
                edit_telegram_message(chat_id, message_id, f"✅ Categoría: {setting.value}")
                kb = get_setting_keyboard("entities", f"fin_ent_{fin.id}_", db)
                send_telegram_message(chat_id, "<b>2. Selecciona la Entidad/Cliente:</b>", kb)
                
        elif call_data.startswith("fin_ent_"):
            parts = call_data.split("_")
            fin_id, setting_id = int(parts[2]), int(parts[3])
            setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
            fin = db.query(models.Finance).filter(models.Finance.id == fin_id).first()
            if fin and setting:
                fin.entity = setting.value
                db.commit()
                edit_telegram_message(chat_id, message_id, f"✅ Entidad asignada: {setting.value}\n🎉 ¡Transacción lista y en la nube!", get_main_menu())

        # CONFIGURACIONES
        elif call_data == "menu_config":
            kb = {
                "inline_keyboard": [
                    [{"text": "🏢 Entidades/Clientes", "callback_data": "conf_list_entities"}],
                    [{"text": "💳 Cat. Financieras", "callback_data": "conf_list_categories"}, {"text": "📌 Gastos Fijos", "callback_data": "conf_list_fixed"}],
                    [{"text": "🔙 Volver", "callback_data": "menu_main"}]
                ]
            }
            edit_telegram_message(chat_id, message_id, "⚙️ <b>CONFIGURACIONES FINANCIERAS</b>", kb)
            
        elif call_data.startswith("conf_list_"):
            setting_type = call_data.replace("conf_list_", "")
            settings = db.query(models.Setting).filter(models.Setting.type == setting_type).all()
            kb = {"inline_keyboard": []}
            for s in settings: kb["inline_keyboard"].append([{"text": f"❌ Borrar: {s.value}", "callback_data": f"conf_del_{s.id}"}])
            kb["inline_keyboard"].append([{"text": "➕ Añadir Nuevo", "callback_data": f"conf_add_{setting_type}"}])
            kb["inline_keyboard"].append([{"text": "🔙 Volver", "callback_data": "menu_config"}])
            edit_telegram_message(chat_id, message_id, f"📝 <b>Gestionando Registros</b>", kb)

        elif call_data.startswith("conf_del_"):
            setting_id = int(call_data.replace("conf_del_", ""))
            db.query(models.Setting).filter(models.Setting.id == setting_id).delete(); db.commit()
            send_telegram_message(chat_id, "🗑 Registro Eliminado.")
            
        elif call_data.startswith("conf_add_"):
            setting_type = call_data.replace("conf_add_", "")
            prompt_map = {"entities": "🏢 NUEVA ENTIDAD / CLIENTE", "categories": "💳 NUEVA CATEGORIA", "fixed": "📌 NUEVO GASTO FIJO"}
            send_telegram_message(chat_id, f"{prompt_map.get(setting_type)}\nEscribe el nombre:", {"force_reply": True})
        
        requests.post(f"{TELEGRAM_API_URL}/answerCallbackQuery", json={"callback_query_id": callback_id})
    return {"status": "ok"}

@app.get("/setup-telegram")
def setup_telegram(request: Request):
    if not TELEGRAM_TOKEN: return {"error": "Falta el TELEGRAM_BOT_TOKEN"}
    base_url = str(request.base_url).rstrip("/")
    requests.get(f"{TELEGRAM_API_URL}/setWebhook?url={base_url}/webhook/telegram")
    return {"message": "Webhook configurado"}

def send_daily_finance_summary():
    db = database.SessionLocal()
    today_str = datetime.now().strftime("%Y-%m-%d")
    finances = db.query(models.Finance).filter(models.Finance.date == today_str).all()
    db.close()
    
    if not finances: return 
    
    inc = sum([f.amount for f in finances if "Ingreso" in f.type])
    exp = sum([f.amount for f in finances if "Ingreso" not in f.type])
    
    msg = f"📊 <b>CORTE FINANCIERO DIARIO ({today_str})</b>\n\n"
    msg += f"📈 <b>Ingresos Hoy:</b> ${inc:,.2f}\n"
    msg += f"📉 <b>Egresos Hoy:</b> ${exp:,.2f}\n"
    msg += f"⚖️ <b>Flujo Diario:</b> ${(inc - exp):,.2f}\n"
    
    send_telegram_alert(msg)

@app.on_event("startup")
def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(send_daily_finance_summary, CronTrigger(hour=19, minute=0)) 
    scheduler.start()


# === ESQUEMAS Y RUTAS REST===
class FinanceCreate(BaseModel): concept: str; type: str; amount: float; entity: str = None; date: str = None
class PocketCreate(BaseModel): name: str; bank: str; account: str; target: float; current: float
class PocketUpdate(BaseModel): current: float
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

@app.post("/test-telegram")
def test_telegram():
    send_daily_finance_summary()
    return {"message": "ok"}