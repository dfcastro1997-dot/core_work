const API_URL = 'http://localhost:8000';
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('detaimUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        routeUser();
    } else {
        showView('login-view');
    }
});

function showView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
}

async function login(e) {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: u, password: p})
        });
        if(res.ok) {
            currentUser = await res.json();
            localStorage.setItem('detaimUser', JSON.stringify(currentUser));
            routeUser();
        } else {
            alert('Credenciales incorrectas');
        }
    } catch(err) { alert('Error de conexión'); }
}

function logout() {
    localStorage.removeItem('detaimUser');
    currentUser = null;
    showView('login-view');
}

function routeUser() {
    document.getElementById('user-welcome').innerText = `Hola, ${currentUser.username.toUpperCase()}`;
    if(currentUser.role === 'admin') { loadAdminDashboard(); showView('admin-view'); }
    else if(currentUser.role === 'school') { loadSchoolDashboard(); showView('school-view'); }
    else if(currentUser.role === 'operator') { loadOperatorDashboard(); showView('operator-view'); }
}

// --- ADMIN LOGIC ---
async function loadAdminDashboard() {
    const res = await fetch(`${API_URL}/schools`);
    const schools = await res.json();
    const list = document.getElementById('school-list');
    list.innerHTML = schools.map(s => `<li class="p-3 bg-slate-50 border border-slate-200 rounded mb-2 font-bold">${s.name} - Plan: ${s.subscription_type} (ID: ${s.id})</li>`).join('');
}

async function createSchool(e) {
    e.preventDefault();
    const name = document.getElementById('school-name').value;
    const sub = document.getElementById('school-plan').value;
    const resS = await fetch(`${API_URL}/schools`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, subscription_type: sub}) });
    const newSchool = await resS.json();
    
    // Create admin user for this school
    await fetch(`${API_URL}/users`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: `${name.toLowerCase()}_admin`, password: '123', role: 'school', school_id: newSchool.id}) });
    alert(`Escuela creada. Usuario: ${name.toLowerCase()}_admin / Pass: 123`);
    loadAdminDashboard();
}

// --- SCHOOL LOGIC ---
async function loadSchoolDashboard() {
    const res = await fetch(`${API_URL}/users`);
    const users = await res.json();
    const operators = users.filter(u => u.school_id === currentUser.school_id && u.role === 'operator');
    const list = document.getElementById('operator-list');
    list.innerHTML = operators.map(o => `<li class="p-3 bg-slate-50 border border-slate-200 rounded mb-2 flex justify-between"><span>Operador: <b>${o.username}</b></span> <button onclick="viewOperatorResults(${o.id})" class="text-emerald-600 underline text-sm">Ver Certificados</button></li>`).join('');
}

async function createOperator(e) {
    e.preventDefault();
    const username = document.getElementById('op-username').value;
    await fetch(`${API_URL}/users`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username, password: '123', role: 'operator', school_id: currentUser.school_id}) });
    alert('Operador creado exitosamente');
    loadSchoolDashboard();
}

async function viewOperatorResults(userId) {
    const res = await fetch(`${API_URL}/results/${userId}`);
    const results = await res.json();
    if(results.length === 0) return alert("Sin resultados aún");
    let text = results.map(r => `${r.simulator_type} - Score: ${r.score}% - <a href="${API_URL}/generate_pdf/${r.id}" target="_blank" class="text-blue-500">Descargar PDF</a>`).join('<br>');
    document.getElementById('school-results-display').innerHTML = text;
}

// --- OPERATOR LOGIC ---
let activeSim = '';
async function loadOperatorDashboard() {
    const res = await fetch(`${API_URL}/results/${currentUser.id}`);
    const results = await res.json();
    const list = document.getElementById('my-certificates');
    list.innerHTML = results.map(r => `<li class="p-2 border-b"><a href="${API_URL}/generate_pdf/${r.id}" target="_blank" class="text-emerald-600 font-bold hover:underline">📄 Certificado ${r.simulator_type} (${r.score}%)</a></li>`).join('');
}

function startSim(type) {
    activeSim = type;
    document.getElementById('sim-title').innerText = `Simulador Activo: ${type} WEB`;
    showView('sim-view');
}

async function finishSim() {
    const score = Math.floor(Math.random() * 40) + 60; // Score random 60-100 para demo
    await fetch(`${API_URL}/results`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({user_id: currentUser.id, simulator_type: activeSim, score: score, details: `El operador identificó correctamente el 100% de amenazas en el entorno ${activeSim}.`})
    });
    alert(`¡Simulación completada con ${score}% de precisión!`);
    loadOperatorDashboard();
    showView('operator-view');
}