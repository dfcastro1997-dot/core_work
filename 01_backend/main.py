import os
import json
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

models.Base.metadata.create_all(bind=database.engine)

with database.SessionLocal() as session:
    if session.query(models.User).count() == 0:
        school_test = models.School(name="Academia Central Guardias", subscription_type="Mensual", max_operators=100, max_instructors=20, is_active=True, allowed_sims="DENSITY,VMS-X")
        session.add(school_test)
        session.commit()
        session.refresh(school_test)

        admin = models.User(username="admin", password="123", role="admin")
        academia = models.User(username="academia", password="123", role="school", school_id=school_test.id)
        instructor = models.User(username="instructor_jefe", password="123", role="instructor", school_id=school_test.id)
        operador = models.User(username="operador", password="123", role="operator", school_id=school_test.id)
        
        session.add_all([admin, academia, instructor, operador])
        session.commit()

app = FastAPI(title="SECURITY CLOUD API V3.1")

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_credentials=False, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

class LoginData(BaseModel): role: str; username: str; password: str
class SchoolCreate(BaseModel): name: str; subscription_type: str; username: str; password: str; max_operators: int; max_instructors: int = 10; icon_url: str = ""; is_active: bool = True; allowed_sims: str = "DENSITY,VMS-X"
class SchoolUpdate(BaseModel): name: str; subscription_type: str; max_operators: int; max_instructors: int = 10; icon_url: str = ""; is_active: bool = True; allowed_sims: str = "DENSITY,VMS-X"
class UserCreate(BaseModel): username: str; password: str; role: str; school_id: int = None
class UserUpdate(BaseModel): username: str; password: str; school_id: int; role: str
class ResultCreate(BaseModel): user_id: int; simulator_type: str; score: float; details: str
class FeedbackUpdate(BaseModel): feedback: str

class QuizCreate(BaseModel): school_id: int; instructor_id: int; title: str; questions: str; time_limit: int; assigned_operators: str
class AnswerItem(BaseModel): question_index: int; selected_option: int
class QuizSubmit(BaseModel): quiz_id: int; operator_id: int; answers: list[AnswerItem]
class QuizAssign(BaseModel): new_operators: list[int]

@app.post("/login")
def login(data: LoginData, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter_by(username=data.username, password=data.password, role=data.role).first()
    if not user: raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    if user.school_id and user.role != "admin":
        school = db.query(models.School).filter_by(id=user.school_id).first()
        if school and not school.is_active: raise HTTPException(status_code=403, detail="Tu academia ha sido suspendida.")
    return {"id": user.id, "role": user.role, "school_id": user.school_id, "username": user.username}

@app.get("/schools")
def get_schools(db: Session = Depends(database.get_db)):
    return db.query(models.School).all()

@app.post("/schools")
def create_school(s: SchoolCreate, db: Session = Depends(database.get_db)):
    if db.query(models.User).filter_by(username=s.username).first(): raise HTTPException(status_code=400, detail="El usuario ya existe")
    db_s = models.School(**s.dict(exclude={'username', 'password'}))
    db.add(db_s)
    db.commit()
    db.refresh(db_s)
    db_u = models.User(username=s.username, password=s.password, role="school", school_id=db_s.id)
    db.add(db_u)
    db.commit()
    return db_s

@app.put("/schools/{school_id}")
def update_school(school_id: int, s: SchoolUpdate, db: Session = Depends(database.get_db)):
    db_s = db.query(models.School).filter_by(id=school_id).first()
    if not db_s: raise HTTPException(status_code=404, detail="Escuela no encontrada")
    for key, value in s.dict().items(): setattr(db_s, key, value)
    db.commit()
    return db_s

@app.delete("/schools/{school_id}")
def delete_school(school_id: int, db: Session = Depends(database.get_db)):
    db_s = db.query(models.School).filter_by(id=school_id).first()
    if not db_s: raise HTTPException(status_code=404, detail="Escuela no encontrada")
    users = db.query(models.User).filter_by(school_id=school_id).all()
    for u in users:
        db.query(models.SimulationResult).filter_by(user_id=u.id).delete()
        db.query(models.QuizResult).filter_by(operator_id=u.id).delete()
        db.delete(u)
    db.query(models.Quiz).filter_by(school_id=school_id).delete()
    db.delete(db_s)
    db.commit()
    return {"msg": "Escuela borrada"}

@app.get("/users")
def get_users(db: Session = Depends(database.get_db)):
    return db.query(models.User).all()

@app.post("/users")
def create_user(u: UserCreate, db: Session = Depends(database.get_db)):
    if db.query(models.User).filter_by(username=u.username).first(): raise HTTPException(status_code=400, detail="El usuario ya existe")
    if u.role in ["operator", "instructor"] and u.school_id:
        school = db.query(models.School).filter_by(id=u.school_id).first()
        if school:
            if u.role == "operator":
                if db.query(models.User).filter_by(school_id=u.school_id, role="operator").count() >= school.max_operators: raise HTTPException(status_code=400, detail="Límite de Operadores alcanzado.")
            elif u.role == "instructor":
                if db.query(models.User).filter_by(school_id=u.school_id, role="instructor").count() >= school.max_instructors: raise HTTPException(status_code=400, detail="Límite de Instructores alcanzado.")
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
    db_u.username = u.username; db_u.password = u.password if u.password else db_u.password; db_u.school_id = u.school_id; db_u.role = u.role
    db.commit()
    return db_u

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(database.get_db)):
    db_u = db.query(models.User).filter_by(id=user_id).first()
    if not db_u: raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.query(models.SimulationResult).filter_by(user_id=user_id).delete()
    db.query(models.QuizResult).filter_by(operator_id=user_id).delete()
    db.delete(db_u)
    db.commit()
    return {"msg": "Usuario borrado"}

@app.get("/results/{user_id}")
def get_results(user_id: int, db: Session = Depends(database.get_db)):
    return db.query(models.SimulationResult).filter_by(user_id=user_id).order_by(models.SimulationResult.id.desc()).all()

@app.get("/school-results/{school_id}")
def get_school_results(school_id: int, db: Session = Depends(database.get_db)):
    results = db.query(models.SimulationResult, models.User).join(models.User, models.SimulationResult.user_id == models.User.id).filter(models.User.school_id == school_id).order_by(models.SimulationResult.id.desc()).all()
    return [{ "id": r.SimulationResult.id, "user_id": r.SimulationResult.user_id, "username": r.User.username, "role": r.User.role, "simulator_type": r.SimulationResult.simulator_type, "score": r.SimulationResult.score, "date": r.SimulationResult.date, "details": r.SimulationResult.details, "feedback": r.SimulationResult.feedback } for r in results]

@app.post("/results")
def save_result(r: ResultCreate, db: Session = Depends(database.get_db)):
    db_r = models.SimulationResult(**r.dict(), date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    db.add(db_r)
    db.commit()
    return db_r

@app.put("/results/{result_id}/feedback")
def add_feedback(result_id: int, f: FeedbackUpdate, db: Session = Depends(database.get_db)):
    res = db.query(models.SimulationResult).filter_by(id=result_id).first()
    if not res: raise HTTPException(404, "Resultado no encontrado")
    res.feedback = f.feedback
    db.commit()
    return res

# ================= RUTAS PARA EXÁMENES (QUIZZES) =================

@app.post("/quizzes")
def create_quiz(q: QuizCreate, db: Session = Depends(database.get_db)):
    db_q = models.Quiz(
        school_id=q.school_id, instructor_id=q.instructor_id, title=q.title,
        questions=q.questions, time_limit=q.time_limit, assigned_operators=q.assigned_operators,
        date_created=datetime.now().strftime("%Y-%m-%d")
    )
    db.add(db_q)
    db.commit()
    return {"msg": "Examen creado exitosamente"}

@app.get("/quizzes/school/{school_id}")
def get_school_quizzes(school_id: int, db: Session = Depends(database.get_db)):
    return db.query(models.Quiz).filter_by(school_id=school_id).order_by(models.Quiz.id.desc()).all()

# NUEVO: Ruta para asignar un examen que ya existe a nuevos alumnos
@app.put("/quizzes/{quiz_id}/assign")
def assign_quiz(quiz_id: int, req: QuizAssign, db: Session = Depends(database.get_db)):
    quiz = db.query(models.Quiz).filter_by(id=quiz_id).first()
    if not quiz: raise HTTPException(404, "Examen no encontrado")
    
    current_assigned = json.loads(quiz.assigned_operators)
    # Convierte a set para eliminar duplicados si por error se manda dos veces
    updated_assigned = list(set(current_assigned + req.new_operators))
    quiz.assigned_operators = json.dumps(updated_assigned)
    
    db.commit()
    return {"msg": "Asignación actualizada exitosamente"}

# NUEVO: Ruta para saber que examenes ya hizo el operador y no dejarselos repetir
@app.get("/quizzes/operator/{operator_id}/completed")
def get_completed_quizzes(operator_id: int, db: Session = Depends(database.get_db)):
    results = db.query(models.QuizResult).filter_by(operator_id=operator_id).all()
    # Retorna unicamente un arreglo con los IDs de los examenes que ya entregó
    return [r.quiz_id for r in results]

@app.post("/quizzes/submit")
def submit_quiz(sub: QuizSubmit, db: Session = Depends(database.get_db)):
    quiz = db.query(models.Quiz).filter_by(id=sub.quiz_id).first()
    if not quiz: raise HTTPException(404, "Examen no encontrado")
    
    questions = json.loads(quiz.questions)
    score = 0.0
    ans_map = { a.question_index: a.selected_option for a in sub.answers }
    
    for i, q in enumerate(questions):
        if i in ans_map and ans_map[i] == int(q['correct']):
            score += float(q['weight'])
            
    result = models.QuizResult(quiz_id=quiz.id, operator_id=sub.operator_id, score=score, date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    db.add(result)
    db.commit()
    return {"score": score}

@app.get("/quizzes/results/{school_id}")
def get_quiz_grades(school_id: int, db: Session = Depends(database.get_db)):
    results = db.query(models.QuizResult, models.User, models.Quiz).join(models.User, models.QuizResult.operator_id == models.User.id).join(models.Quiz, models.QuizResult.quiz_id == models.Quiz.id).filter(models.User.school_id == school_id).order_by(models.QuizResult.id.desc()).all()
    return [{"id": r.QuizResult.id, "operator_name": r.User.username, "quiz_title": r.Quiz.title, "score": r.QuizResult.score, "date": r.QuizResult.date } for r in results]

class CertPDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 22); self.set_text_color(0, 0, 0); self.cell(0, 10, 'SECURITY ', 0, 0, 'C')
        w = self.get_string_width('SECURITY '); self.set_x(self.get_x() - (self.w / 2) + (w / 2) - 2)
        self.set_text_color(220, 38, 38); self.cell(0, 10, 'CLOUD', 0, 1, 'C'); self.set_font('Arial', '', 12)
        self.set_text_color(100, 100, 100); self.cell(0, 8, 'Certificado de Competencia Operativa', 0, 1, 'C')
        self.set_draw_color(220, 38, 38); self.set_line_width(0.8); self.line(20, 32, 190, 32); self.ln(15)
    def footer(self):
        self.set_y(-15); self.set_font('Arial', 'I', 8); self.set_text_color(150, 150, 150)
        self.cell(0, 10, 'Generado automaticamente por Security Cloud Platform.', 0, 0, 'C')

@app.get("/generate_pdf/{result_id}")
def generate_pdf(result_id: int, db: Session = Depends(database.get_db)):
    res = db.query(models.SimulationResult).filter_by(id=result_id).first()
    if not res: raise HTTPException(404, "Resultado no encontrado")
    user = db.query(models.User).filter_by(id=res.user_id).first()
    pdf = CertPDF()
    pdf.add_page(); pdf.set_font("Arial", 'B', 14); pdf.set_text_color(0, 0, 0); pdf.cell(0, 10, f"PERSONAL EVALUADO: {user.username.upper()} ({user.role.upper()})", 0, 1)
    pdf.set_font("Arial", '', 12); pdf.cell(0, 8, f"Plataforma: {res.simulator_type}", 0, 1); pdf.cell(0, 8, f"Fecha: {res.date}", 0, 1); pdf.ln(5)
    pdf.set_font("Arial", 'B', 16)
    if res.score >= 80: pdf.set_text_color(0, 128, 0)
    else: pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 10, f"EFECTIVIDAD TACTICA (SCORE): {res.score}%", 0, 1); pdf.ln(5)
    pdf.set_font("Arial", 'B', 12); pdf.set_text_color(0, 0, 0); pdf.cell(0, 10, "Auditoria Forense (Log):", 0, 1)
    pdf.set_font("Arial", '', 11); pdf.set_fill_color(245, 245, 245); pdf.multi_cell(0, 8, f"{res.details}", fill=True, border=1); pdf.ln(5)
    if res.feedback:
        pdf.set_font("Arial", 'B', 12); pdf.set_text_color(220, 38, 38); pdf.cell(0, 10, "Comentarios del Instructor:", 0, 1)
        pdf.set_font("Arial", 'I', 11); pdf.set_text_color(0, 0, 0); pdf.multi_cell(0, 8, f"{res.feedback}")
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    pdf.output(temp_file.name)
    return FileResponse(temp_file.name, media_type='application/pdf', filename=f"Cert_{user.username}.pdf")

@app.get("/reset-db")
def reset_database():
    models.Base.metadata.drop_all(bind=database.engine)
    models.Base.metadata.create_all(bind=database.engine)
    return {"msg": "Base de datos reseteada con éxito."}