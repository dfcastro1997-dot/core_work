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

# Crear Super Admin por defecto si no existe
with database.SessionLocal() as session:
    if session.query(models.User).filter_by(username="admin").count() == 0:
        admin = models.User(username="admin", password="123", role="admin")
        session.add(admin)
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
class LoginData(BaseModel): username: str; password: str
class SchoolCreate(BaseModel): name: str; subscription_type: str
class UserCreate(BaseModel): username: str; password: str; role: str; school_id: int = None
class ResultCreate(BaseModel): user_id: int; simulator_type: str; score: float; details: str

# --- Endpoints ---
@app.post("/login")
def login(data: LoginData, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter_by(username=data.username, password=data.password).first()
    if not user: raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    return {"id": user.id, "role": user.role, "school_id": user.school_id, "username": user.username}

@app.get("/schools")
def get_schools(db: Session = Depends(database.get_db)):
    return db.query(models.School).all()

@app.post("/schools")
def create_school(s: SchoolCreate, db: Session = Depends(database.get_db)):
    db_s = models.School(**s.dict())
    db.add(db_s)
    db.commit()
    db.refresh(db_s)
    return db_s

@app.get("/users")
def get_users(db: Session = Depends(database.get_db)):
    return db.query(models.User).all()

@app.post("/users")
def create_user(u: UserCreate, db: Session = Depends(database.get_db)):
    if db.query(models.User).filter_by(username=u.username).first():
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    db_u = models.User(**u.dict())
    db.add(db_u)
    db.commit()
    db.refresh(db_u)
    return db_u

@app.get("/results/{user_id}")
def get_results(user_id: int, db: Session = Depends(database.get_db)):
    return db.query(models.SimulationResult).filter_by(user_id=user_id).order_by(models.SimulationResult.id.desc()).all()

@app.post("/results")
def save_result(r: ResultCreate, db: Session = Depends(database.get_db)):
    db_r = models.SimulationResult(**r.dict(), date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    db.add(db_r)
    db.commit()
    return db_r

# --- Motor Generador de Certificados PDF (Tema: Negro, Rojo, Blanco) ---
class CertPDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 22)
        # Título en Negro
        self.set_text_color(0, 0, 0)
        self.cell(0, 10, 'SECURITY ', 0, 0, 'C')
        
        # Superposición para simular "CLOUD" en rojo (Truco FPDF)
        w = self.get_string_width('SECURITY ')
        self.set_x(self.get_x() - (self.w / 2) + (w / 2) - 2)
        self.set_text_color(220, 38, 38) # Rojo
        self.cell(0, 10, 'CLOUD', 0, 1, 'C')
        
        self.set_font('Arial', '', 12)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, 'Certificado de Competencia Operativa en Entorno Virtual', 0, 1, 'C')
        
        # Línea roja de separación
        self.set_draw_color(220, 38, 38)
        self.set_line_width(0.8)
        self.line(20, 32, 190, 32)
        self.ln(15)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, 'Documento generado automáticamente por Security Cloud Platform.', 0, 0, 'C')

@app.get("/generate_pdf/{result_id}")
def generate_pdf(result_id: int, db: Session = Depends(database.get_db)):
    res = db.query(models.SimulationResult).filter_by(id=result_id).first()
    if not res: raise HTTPException(404, "Resultado no encontrado")
    user = db.query(models.User).filter_by(id=res.user_id).first()
    
    pdf = CertPDF()
    pdf.add_page()
    
    # Datos del Operador
    pdf.set_font("Arial", 'B', 14)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 10, f"OPERADOR EVALUADO: {user.username.upper()}", 0, 1)
    
    pdf.set_font("Arial", '', 12)
    pdf.cell(0, 8, f"Plataforma de Simulación: {res.simulator_type}", 0, 1)
    pdf.cell(0, 8, f"Fecha de Certificación: {res.date}", 0, 1)
    
    # Puntaje destacado
    pdf.ln(5)
    pdf.set_font("Arial", 'B', 16)
    if res.score >= 80:
        pdf.set_text_color(0, 128, 0) # Verde si pasa
    else:
        pdf.set_text_color(220, 38, 38) # Rojo si reprueba
    pdf.cell(0, 10, f"EFECTIVIDAD TACTICA (SCORE): {res.score}%", 0, 1)
    
    # Detalles y Auditoría
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