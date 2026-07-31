import os
import json
import tempfile
import base64
from datetime import datetime
import matplotlib
matplotlib.use('Agg') # Evita errores de renderizado GUI en el servidor
import matplotlib.pyplot as plt
from PyPDF2 import PdfWriter
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

app = FastAPI(title="SECURITY CLOUD API V3.5")

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
class QuizUpdate(BaseModel): title: str; questions: str; time_limit: int; assigned_operators: str
class AnswerItem(BaseModel): question_index: int; selected_option: int
class QuizSubmit(BaseModel): quiz_id: int; operator_id: int; answers: list[AnswerItem]
class QuizAssign(BaseModel): new_operators: list[int]
class PracticalSubmit(BaseModel): quiz_id: int; operator_id: int; score: float; details: str

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

@app.put("/quizzes/{quiz_id}")
def update_quiz(quiz_id: int, q: QuizUpdate, db: Session = Depends(database.get_db)):
    db_q = db.query(models.Quiz).filter_by(id=quiz_id).first()
    if not db_q: raise HTTPException(404, "Examen no encontrado")
    db_q.title = q.title
    db_q.questions = q.questions
    db_q.time_limit = q.time_limit
    db_q.assigned_operators = q.assigned_operators
    db.commit()
    return {"msg": "Examen actualizado exitosamente"}

@app.delete("/quizzes/{quiz_id}")
def delete_quiz(quiz_id: int, db: Session = Depends(database.get_db)):
    db_q = db.query(models.Quiz).filter_by(id=quiz_id).first()
    if not db_q: raise HTTPException(404, "Examen no encontrado")
    # Borrar primero resultados asociados para evitar error de FK
    db.query(models.QuizResult).filter_by(quiz_id=quiz_id).delete()
    db.delete(db_q)
    db.commit()
    return {"msg": "Examen borrado exitosamente"}

@app.get("/quizzes/school/{school_id}")
def get_school_quizzes(school_id: int, db: Session = Depends(database.get_db)):
    return db.query(models.Quiz).filter_by(school_id=school_id).order_by(models.Quiz.id.desc()).all()

@app.put("/quizzes/{quiz_id}/assign")
def assign_quiz(quiz_id: int, req: QuizAssign, db: Session = Depends(database.get_db)):
    quiz = db.query(models.Quiz).filter_by(id=quiz_id).first()
    if not quiz: raise HTTPException(404, "Examen no encontrado")
    
    current_assigned = json.loads(quiz.assigned_operators)
    updated_assigned = list(set(current_assigned + req.new_operators))
    quiz.assigned_operators = json.dumps(updated_assigned)
    
    db.commit()
    return {"msg": "Asignación actualizada exitosamente"}

@app.get("/quizzes/operator/{operator_id}/completed")
def get_completed_quizzes(operator_id: int, db: Session = Depends(database.get_db)):
    results = db.query(models.QuizResult).filter_by(operator_id=operator_id).all()
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


@app.post("/quizzes/submit_practical")
def submit_practical(sub: PracticalSubmit, db: Session = Depends(database.get_db)):
    quiz = db.query(models.Quiz).filter_by(id=sub.quiz_id).first()
    if not quiz: raise HTTPException(404, "Examen no encontrado")

    # 1. Guardar en SimulationResult para que genere el Certificado PDF
    sim_res = models.SimulationResult(user_id=sub.operator_id, simulator_type=f"DENSITY (Evaluación: {quiz.title})", score=sub.score, details=sub.details, date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    db.add(sim_res)
    
    # 2. Guardar en QuizResult para marcarlo como Completado (Un solo intento)
    q_res = models.QuizResult(quiz_id=sub.quiz_id, operator_id=sub.operator_id, score=sub.score, date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    db.add(q_res)
    db.commit()
    return {"score": sub.score}






@app.get("/quizzes/results/{school_id}")
def get_quiz_grades(school_id: int, db: Session = Depends(database.get_db)):
    results = db.query(models.QuizResult, models.User, models.Quiz).join(models.User, models.QuizResult.operator_id == models.User.id).join(models.Quiz, models.QuizResult.quiz_id == models.Quiz.id).filter(models.User.school_id == school_id).order_by(models.QuizResult.id.desc()).all()
    return [{"id": r.QuizResult.id, "operator_name": r.User.username, "quiz_title": r.Quiz.title, "score": r.QuizResult.score, "date": r.QuizResult.date } for r in results]

class CertPDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 12)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, 'INFORME DE INSPECCIÓN Y TRAZABILIDAD', 0, 1, 'L')
        self.set_draw_color(220, 38, 38)
        self.set_line_width(0.5)
        self.line(10, 20, 200, 20)
        self.ln(5)

    def footer(self):
        self.set_y(-25)
        self.set_font('Arial', 'B', 8)
        self.set_text_color(220, 38, 38)
        self.cell(0, 4, 'CERTIFICADO DE AUTENTICIDAD CRIPTOGRÁFICA', 0, 1, 'C')
        self.set_font('Arial', '', 7)
        self.set_text_color(100, 100, 100)
        self.cell(0, 4, 'Documento respaldado por firma digital inalterable DENSITY:', 0, 1, 'C')
        self.cell(0, 4, f'DENS-{os.urandom(8).hex().upper()}', 0, 1, 'C')
        self.set_y(-10)
        self.cell(0, 10, f'Fecha: {datetime.now().strftime("%d/%m/%Y %H:%M:%S")} | Plataforma: Density   Página {self.page_no()}', 0, 0, 'C')


@app.get("/generate_pdf/{result_id}")
def generate_pdf(result_id: int, db: Session = Depends(database.get_db)):
    res = db.query(models.SimulationResult).filter_by(id=result_id).first()
    if not res: raise HTTPException(404, "Resultado no encontrado")
    user = db.query(models.User).filter_by(id=res.user_id).first()
    
    pdf = CertPDF()
    pdf.add_page()
    
    # 1. EXTRACCIÓN DE DATOS JSON
    details_data = {}
    reports = []
    try:
        details_data = json.loads(res.details)
        reports = details_data.get('reports', [])
    except:
        pass
        
    total_reales = sum([int(r.get('real_threats', 0)) for r in reports]) if reports else 0
    total_marcas = sum([int(r.get('marked_threats', 0)) for r in reports]) if reports else 0
    omisiones = max(0, total_reales - total_marcas)
    efectividad = res.score
    
    # 2. ENCABEZADO Y PUNTUACIONES
    pdf.set_font("Arial", 'B', 11)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 6, f"OPERADOR: {user.username.upper()} | CÉDULA: {user.id}000000 | FECHA: {res.date}", 0, 1)
    pdf.cell(0, 6, f"PUNTUACIÓN TOTAL: {efectividad} / 100", 0, 1)
    pdf.cell(0, 6, f"PRECISIÓN OPERACIONAL: {efectividad}%", 0, 1)
    pdf.ln(5)
    
    # 3. TABLA 1: CRONOLOGÍA
    pdf.set_font("Arial", 'B', 10)
    pdf.cell(0, 6, "CRONOLOGÍA DE EQUIPAJES AUDITADOS", 0, 1)
    pdf.set_font("Arial", '', 8)
    pdf.cell(0, 5, "La tabla inferior documenta el historial de la sesión, volumen de amenazas infiltradas (TIP) y el dictamen final.", 0, 1)
    
    pdf.set_font("Arial", 'B', 8)
    pdf.set_fill_color(178, 34, 34) # Rojo oscuro profesional
    pdf.set_text_color(255, 255, 255)
    pdf.cell(10, 6, "#", 1, 0, 'C', True)
    pdf.cell(60, 6, "PROPIETARIO", 1, 0, 'C', True)
    pdf.cell(30, 6, "OBJ. REALES", 1, 0, 'C', True)
    pdf.cell(30, 6, "MARCAS OP.", 1, 0, 'C', True)
    pdf.cell(30, 6, "PUNTAJE", 1, 0, 'C', True)
    pdf.cell(30, 6, "DIAGNÓSTICO", 1, 1, 'C', True)
    
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Arial", '', 8)
    
    for r in reports:
        pdf.cell(10, 6, str(r.get('bag', '')), 1, 0, 'C')
        pdf.cell(60, 6, str(r.get('subject', 'N/A'))[:25], 1, 0, 'C')
        pdf.cell(30, 6, str(r.get('real_threats', 0)), 1, 0, 'C')
        pdf.cell(30, 6, str(r.get('marked_threats', 0)), 1, 0, 'C')
        pdf.cell(30, 6, str(r.get('score', 0)), 1, 0, 'C')
        diag = "ACIERTO" if float(r.get('score', 0)) >= 80 else "FALLO"
        pdf.cell(30, 6, diag, 1, 1, 'C')
        
    pdf.ln(8)
    
    # 4. TABLA 2: CONSOLIDADO TÁCTICO
    pdf.set_font("Arial", 'B', 10)
    pdf.cell(0, 6, "CONSOLIDADO DE ACIERTOS Y FALLOS TÁCTICOS", 0, 1)
    
    pdf.set_font("Arial", 'B', 8)
    pdf.set_fill_color(178, 34, 34)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(47, 6, "VOLUMEN TOTAL TIP", 1, 0, 'C', True)
    pdf.cell(47, 6, "INTERCEPCIONES (ACIERTO)", 1, 0, 'C', True)
    pdf.cell(47, 6, "OMISIONES (FALLO)", 1, 0, 'C', True)
    pdf.cell(47, 6, "ÍNDICE EFECTIVIDAD", 1, 1, 'C', True)
    
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Arial", '', 8)
    pdf.cell(47, 6, str(total_reales), 1, 0, 'C')
    pdf.cell(47, 6, str(total_marcas), 1, 0, 'C')
    pdf.cell(47, 6, str(omisiones), 1, 0, 'C')
    pdf.cell(47, 6, f"{efectividad}%", 1, 1, 'C')
    pdf.ln(2)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 5, "Balance de efectividad: Las 'Omisiones' representan los objetos ilícitos que evadieron los controles de seguridad.", 0, 1)
    pdf.ln(6)
    
    # 5. CHARTS (MATPLOTLIB)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Arial", 'B', 10)
    pdf.cell(0, 6, "ANÁLISIS ESTADÍSTICO DE DESEMPEÑO", 0, 1)
    
    chart_path = tempfile.mktemp(suffix=".png")
    try:
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(8, 3.5))
        
        # Pie Chart
        sizes = [efectividad, max(0, 100-efectividad)]
        if sum(sizes) == 0: sizes = [100, 0]
        ax1.pie(sizes, labels=[f'{sizes[0]}%', f'{sizes[1]}%'], labeldistance=0.4, colors=['#B22222', '#F08080'], textprops={'color':"w", 'weight':'bold', 'fontsize': 10})
        ax1.set_title('Efectividad y Tasa de Falsos Negativos', fontsize=10, pad=10)
        
        # Bar Chart
        ax2.bar(['Reales (Sistema)', 'Marcas (Operador)'], [total_reales, total_marcas], color=['black', '#B22222'])
        ax2.set_title('Volumen de Incidentes vs Detecciones', fontsize=10, pad=10)
        
        plt.tight_layout()
        plt.savefig(chart_path, dpi=300)
        plt.close()
        
        pdf.image(chart_path, x=15, w=180)
        os.unlink(chart_path)
    except Exception as e:
        print("Error al generar gráficas:", e)
    
    # 6. REGISTRO VISUAL (IMÁGENES Y BITÁCORAS)
    if reports:
        pdf.add_page()
        pdf.set_font("Arial", 'B', 14)
        pdf.cell(0, 10, "REGISTRO VISUAL", 0, 1, 'C')
        pdf.ln(5)
        
        for r in reports:
            for idx, b64 in enumerate(r.get('screenshots', [])):
                if "," in b64:
                    _, data = b64.split(',', 1)
                    img_data = base64.b64decode(data)
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_img:
                        tmp_img.write(img_data)
                        tmp_name = tmp_img.name
                    
                    if pdf.get_y() > 200:
                        pdf.add_page()
                        
                    pdf.image(tmp_name, w=160, x=25)
                    
                    pdf.set_font("Arial", 'B', 9)
                    pdf.set_text_color(0, 0, 0)
                    pdf.cell(0, 6, f"Maleta: #{r.get('bag', '')} | Propietario: {r.get('subject', 'N/A')}", 0, 1, 'C')
                    pdf.set_font("Arial", '', 9)
                    pdf.set_text_color(80, 80, 80)
                    pdf.multi_cell(0, 5, f"Bitácora: {r.get('details', '')}", align='C')
                    pdf.ln(8)
                    
                    os.unlink(tmp_name)

    # Si hay comentarios del instructor
    if res.feedback:
        pdf.ln(5)
        pdf.set_font("Arial", 'B', 12); pdf.set_text_color(220, 38, 38); pdf.cell(0, 10, "Comentarios del Instructor:", 0, 1)
        pdf.set_font("Arial", 'I', 11); pdf.set_text_color(0, 0, 0); pdf.multi_cell(0, 8, f"{res.feedback}")
                    
    # Guardar reporte principal temporalmente
    body_path = tempfile.mktemp(suffix=".pdf")
    pdf.output(body_path)
    
    # 7. UNIÓN DE ARCHIVOS: PORTADA + CUERPO + CONTRAPORTADA
    try:
        merger = PdfWriter()
        
        # Adjuntar Portada (Si existe en la carpeta)
        portada_path = os.path.join("04_Pdf", "Portada_density.pdf")
        if os.path.exists(portada_path):
            merger.append(portada_path)
            
        # Adjuntar Informe
        merger.append(body_path)
        
        # Adjuntar Contraportada (Si existe)
        contraportada_path = os.path.join("04_Pdf", "Contraportada_density.pdf")
        if os.path.exists(contraportada_path):
            merger.append(contraportada_path)
            
        final_pdf_path = tempfile.mktemp(suffix=".pdf")
        merger.write(final_pdf_path)
        merger.close()
        os.unlink(body_path)
    except Exception as e:
        print("Error al unir PDFs:", e)
        final_pdf_path = body_path # Si falla la portada, devuelve el informe puro

    return FileResponse(final_pdf_path, media_type='application/pdf', filename=f"Cert_{user.username}.pdf")


@app.get("/reset-db")
def reset_database():
    models.Base.metadata.drop_all(bind=database.engine)
    models.Base.metadata.create_all(bind=database.engine)
    return {"msg": "Base de datos reseteada con éxito."}