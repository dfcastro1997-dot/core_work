import os
import tempfile
from datetime import datetime
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fpdf import FPDF

import database
import models

# Inicializar Base de Datos
models.Base.metadata.create_all(bind=database.engine)

# Crear Usuarios de Prueba (Seed)
with database.SessionLocal() as session:
    if session.query(models.User).count() == 0:
        school_test = models.School(name="Academia Central Guardias", subscription_type="Mensual", max_operators=100)
        session.add(school_test)
        session.commit()
        session.refresh(school_test)

        admin = models.User(username="admin", password="123", role="admin")
        academia = models.User(username="academia", password="123", role="school", school_id=school_test.id)
        operador = models.User(username="operador", password="123", role="operator", school_id=school_test.id)
        
        session.add_all([admin, academia, operador])
        session.commit()

app = FastAPI(title="SECURITY CLOUD API")

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# --- Esquemas Pydantic ---
class LoginData(BaseModel): 
    role: str
    username: str
    password: str
    
class SchoolCreate(BaseModel): 
    name: str
    subscription_type: str
    username: str
    password: str
    max_operators: int
    icon_url: str = ""

# Nuevo esquema para actualizar la escuela sin tocar la contraseña/usuario
class SchoolUpdate(BaseModel):
    name: str
    subscription_type: str
    max_operators: int
    icon_url: str = ""

class UserCreate(BaseModel): username: str; password: str; role: str; school_id: int = None
class UserUpdate(BaseModel): username: str; password: str; school_id: int
class ResultCreate(BaseModel): user_id: int; simulator_type: str; score: float; details: str

# --- Endpoints ---
@app.post("/login")
def login(data: LoginData, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter_by(username=data.username, password=data.password, role=data.role).first()
    if not user: raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    return {"id": user.id, "role": user.role, "school_id": user.school_id, "username": user.username}

@app.get("/schools")
def get_schools(db: Session = Depends(database.get_db)):
    return db.query(models.School).all()

@app.post("/schools")
def create_school(s: SchoolCreate, db: Session = Depends(database.get_db)):
    if db.query(models.User).filter_by(username=s.username).first():
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    # 1. Crear Escuela
    db_s = models.School(name=s.name, subscription_type=s.subscription_type, max_operators=s.max_operators, icon_url=s.icon_url)
    db.add(db_s)
    db.commit()
    db.refresh(db_s)
    
    # 2. Crear Usuario de Acceso para la Escuela
    db_u = models.User(username=s.username, password=s.password, role="school", school_id=db_s.id)
    db.add(db_u)
    db.commit()
    
    return db_s

# NUEVO: Editar Escuela
@app.put("/schools/{school_id}")
def update_school(school_id: int, s: SchoolUpdate, db: Session = Depends(database.get_db)):
    db_s = db.query(models.School).filter_by(id=school_id).first()
    if not db_s: raise HTTPException(status_code=404, detail="Escuela no encontrada")
    
    db_s.name = s.name
    db_s.subscription_type = s.subscription_type
    db_s.max_operators = s.max_operators
    db_s.icon_url = s.icon_url
    
    db.commit()
    return db_s

# NUEVO: Borrar Escuela
@app.delete("/schools/{school_id}")
def delete_school(school_id: int, db: Session = Depends(database.get_db)):
    db_s = db.query(models.School).filter_by(id=school_id).first()
    if not db_s: raise HTTPException(status_code=404, detail="Escuela no encontrada")
    
    # Buscar y borrar todos los usuarios y resultados asociados a esta escuela para no dejar basura
    users = db.query(models.User).filter_by(school_id=school_id).all()
    for u in users:
        db.query(models.SimulationResult).filter_by(user_id=u.id).delete()
        db.delete(u)
        
    db.delete(db_s)
    db.commit()
    return {"msg": "Escuela borrada exitosamente"}

@app.get("/users")
def get_users(db: Session = Depends(database.get_db)):
    return db.query(models.User).all()

@app.post("/users")
def create_user(u: UserCreate, db: Session = Depends(database.get_db)):
    if db.query(models.User).filter_by(username=u.username).first():
        raise HTTPException(status_code=400, detail="El usuario ya existe")
        
    if u.role == "operator" and u.school_id:
        school = db.query(models.School).filter_by(id=u.school_id).first()
        current_ops = db.query(models.User).filter_by(school_id=u.school_id, role="operator").count()
        if school and current_ops >= school.max_operators:
            raise HTTPException(status_code=400, detail=f"Límite de operadores ({school.max_operators}) alcanzado para esta escuela.")

    db_u = models.User(**u.dict())
    db.add(db_u)
    db.commit()
    db.refresh(db_u)
    return db_u

@app.put("/users/{user_id}")
def update_user(user_id: int, u: UserUpdate, db: Session = Depends(database.get_db)):
    db_u = db.query(models.User).filter_by(id=user_id).first()
    if not db_u: raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    exist = db.query(models.User).filter_by(username=u.username).first()
    if exist and exist.id != user_id: raise HTTPException(status_code=400, detail="Username ya en uso")
    
    db_u.username = u.username
    if u.password: db_u.password = u.password
    db_u.school_id = u.school_id
    db.commit()
    return db_u

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(database.get_db)):
    db_u = db.query(models.User).filter_by(id=user_id).first()
    if not db_u: raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.query(models.SimulationResult).filter_by(user_id=user_id).delete()
    db.delete(db_u)
    db.commit()
    return {"msg": "Usuario borrado"}

@app.get("/results/{user_id}")
def get_results(user_id: int, db: Session = Depends(database.get_db)):
    return db.query(models.SimulationResult).filter_by(user_id=user_id).order_by(models.SimulationResult.id.desc()).all()

@app.post("/results")
def save_result(r: ResultCreate, db: Session = Depends(database.get_db)):
    db_r = models.SimulationResult(**r.dict(), date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    db.add(db_r)
    db.commit()
    return db_r

class CertPDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 22)
        self.set_text_color(0, 0, 0)
        self.cell(0, 10, 'SECURITY ', 0, 0, 'C')
        w = self.get_string_width('SECURITY ')
        self.set_x(self.get_x() - (self.w / 2) + (w / 2) - 2)
        self.set_text_color(220, 38, 38)
        self.cell(0, 10, 'CLOUD', 0, 1, 'C')
        self.set_font('Arial', '', 12)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, 'Certificado de Competencia Operativa en Entorno Virtual', 0, 1, 'C')
        self.set_draw_color(220, 38, 38)
        self.set_line_width(0.8)
        self.line(20, 32, 190, 32)
        self.ln(15)
    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, 'Documento generado automaticamente por Security Cloud Platform.', 0, 0, 'C')

@app.get("/generate_pdf/{result_id}")
def generate_pdf(result_id: int, db: Session = Depends(database.get_db)):
    res = db.query(models.SimulationResult).filter_by(id=result_id).first()
    if not res: raise HTTPException(404, "Resultado no encontrado")
    user = db.query(models.User).filter_by(id=res.user_id).first()
    
    pdf = CertPDF()
    pdf.add_page()
    pdf.set_font("Arial", 'B', 14)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 10, f"OPERADOR EVALUADO: {user.username.upper()}", 0, 1)
    pdf.set_font("Arial", '', 12)
    pdf.cell(0, 8, f"Plataforma de Simulacion: {res.simulator_type}", 0, 1)
    pdf.cell(0, 8, f"Fecha de Certificacion: {res.date}", 0, 1)
    pdf.ln(5)
    pdf.set_font("Arial", 'B', 16)
    if res.score >= 80: pdf.set_text_color(0, 128, 0)
    else: pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 10, f"EFECTIVIDAD TACTICA (SCORE): {res.score}%", 0, 1)
    pdf.ln(5)
    pdf.set_font("Arial", 'B', 12)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 10, "Auditoria Forense (Log del Sistema):", 0, 1)
    pdf.set_font("Arial", '', 11)
    pdf.set_fill_color(245, 245, 245)
    pdf.multi_cell(0, 8, f"{res.details}", fill=True, border=1)
    
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    pdf.output(temp_file.name)
    return FileResponse(temp_file.name, media_type='application/pdf', filename=f"Certificado_{user.username}.pdf")

# (Ruta de reseteo para desarrollo temporal si la necesitas)
@app.get("/reset-db")
def reset_database():
    models.Base.metadata.drop_all(bind=database.engine)
    models.Base.metadata.create_all(bind=database.engine)
    return {"msg": "Base de datos reseteada con éxito."}