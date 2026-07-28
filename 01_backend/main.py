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

# Crear Admin por defecto si no existe
with database.SessionLocal() as session:
    if session.query(models.User).filter_by(username="admin").count() == 0:
        admin = models.User(username="admin", password="123", role="admin")
        session.add(admin)
        session.commit()

app = FastAPI(title="DETAIM CLOUD API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Esquemas Pydantic
class LoginData(BaseModel): username: str; password: str
class SchoolCreate(BaseModel): name: str; subscription_type: str
class UserCreate(BaseModel): username: str; password: str; role: str; school_id: int = None
class ResultCreate(BaseModel): user_id: int; simulator_type: str; score: float; details: str

@app.post("/login")
def login(data: LoginData, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter_by(username=data.username, password=data.password).first()
    if not user: raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    return {"id": user.id, "role": user.role, "school_id": user.school_id, "username": user.username}

@app.get("/schools")
def get_schools(db: Session = Depends(database.get_db)): return db.query(models.School).all()

@app.post("/schools")
def create_school(s: SchoolCreate, db: Session = Depends(database.get_db)):
    db_s = models.School(**s.dict()); db.add(db_s); db.commit(); db.refresh(db_s); return db_s

@app.get("/users")
def get_users(db: Session = Depends(database.get_db)): return db.query(models.User).all()

@app.post("/users")
def create_user(u: UserCreate, db: Session = Depends(database.get_db)):
    if db.query(models.User).filter_by(username=u.username).first():
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    db_u = models.User(**u.dict()); db.add(db_u); db.commit(); db.refresh(db_u); return db_u

@app.get("/results/{user_id}")
def get_results(user_id: int, db: Session = Depends(database.get_db)):
    return db.query(models.SimulationResult).filter_by(user_id=user_id).all()

@app.post("/results")
def save_result(r: ResultCreate, db: Session = Depends(database.get_db)):
    db_r = models.SimulationResult(**r.dict(), date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    db.add(db_r); db.commit(); return db_r

# Motor Generador de Certificados PDF
class CertPDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 20)
        self.set_text_color(15, 23, 42)
        self.cell(0, 10, 'DETAIM TRAINING SIMULATORS', 0, 1, 'C')
        self.set_font('Arial', '', 12)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, 'Certificado Oficial de Competencia Operativa', 0, 1, 'C')
        self.set_draw_color(200, 200, 200)
        self.line(10, 30, 200, 30)
        self.ln(10)

@app.get("/generate_pdf/{result_id}")
def generate_pdf(result_id: int, db: Session = Depends(database.get_db)):
    res = db.query(models.SimulationResult).filter_by(id=result_id).first()
    if not res: raise HTTPException(404, "Resultado no encontrado")
    user = db.query(models.User).filter_by(id=res.user_id).first()
    
    pdf = CertPDF()
    pdf.add_page()
    pdf.set_font("Arial", 'B', 14)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 10, f"Operador Evaluado: {user.username.upper()}", 0, 1)
    
    pdf.set_font("Arial", '', 12)
    pdf.cell(0, 10, f"Plataforma: {res.simulator_type} WEB", 0, 1)
    pdf.cell(0, 10, f"Efectividad Táctica (Score): {res.score}%", 0, 1)
    pdf.cell(0, 10, f"Fecha de Certificación: {res.date}", 0, 1)
    
    pdf.ln(5)
    pdf.set_fill_color(241, 245, 249)
    pdf.multi_cell(0, 10, f"Auditoria Forense:\n{res.details}", fill=True)
    
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    pdf.output(temp_file.name)
    return FileResponse(temp_file.name, media_type='application/pdf', filename=f"Certificado_{user.username}.pdf")