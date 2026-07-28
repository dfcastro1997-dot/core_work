const API_URL = 'https://core-work-api.onrender.com';
let currentUser = null;

// Mapa de roles para la interfaz
const ROLE_LABELS = {
    'admin': 'Administrador',
    'school': 'Escuela / Academia',
    'operator': 'Operador'
};

document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('securityCloudUser');
    const path = window.location.pathname;

    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        
        // Cargar Header global si no estamos en el login
        if(!path.endsWith('index.html') && path !== '/') {
            setupHeader();
        }

        // Ejecutar lógicas específicas según la página en la que estemos
        if (path.endsWith('admin.html') && currentUser.role === 'admin') loadAdminDashboard();
        else if (path.endsWith('school.html') && currentUser.role === 'school') loadSchoolDashboard();
        else if (path.endsWith('operator.html') && currentUser.role === 'operator') loadOperatorDashboard();
        else if (path.endsWith('index.html') || path === '/') redirectUserByRole(); // Si está logueado y va al index, redirigir.
        
    } else {
        // Si no hay sesión y NO está en el index, forzar redirección al login
        if(!path.endsWith('index.html') && path !== '/') {
            window.location.href = 'index.html';
        }
    }
});

function setupHeader() {
    const welcomeEl = document.getElementById('user-welcome');
    const roleEl = document.getElementById('user-role');
    
    if(welcomeEl) welcomeEl.innerText = currentUser.username.toUpperCase();
    if(roleEl) roleEl.innerText = ROLE_LABELS[currentUser.role];
}

function redirectUserByRole() {
    if (currentUser.role === 'admin') window.location.href = 'admin.html';
    else if (currentUser.role === 'school') window.location.href = 'school.html';
    else if (currentUser.role === 'operator') window.location.href = 'operator.html';
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
            localStorage.setItem('securityCloudUser', JSON.stringify(currentUser));
            redirectUserByRole();
        } else {
            alert('❌ Credenciales incorrectas');
        }
    } catch(err) { alert('❌ Error conectando con el servidor'); }
}

function logout() {
    localStorage.removeItem('securityCloudUser');
    currentUser = null;
    window.location.href = 'index.html';
}

// --- LOGICA ADMIN ---
async function loadAdminDashboard() {
    const res = await fetch(`${API_URL}/schools`);
    const schools = await res.json();
    const list = document.getElementById('school-list');
    list.innerHTML = schools.map(s => `
        <li class="p-4 bg-white border border-gray-200 rounded-lg shadow-sm mb-3 flex flex-col">
            <span class="font-bold text-gray-900 text-lg">${s.name}</span>
            <span class="text-sm text-gray-500">Suscripción: <b class="text-black">${s.subscription_type}</b> | ID: ${s.id}</span>
        </li>
    `).join('');
}

async function createSchool(e) {
    e.preventDefault();
    const name = document.getElementById('school-name').value;
    const sub = document.getElementById('school-plan').value;
    
    const resS = await fetch(`${API_URL}/schools`, { 
        method: 'POST', headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({name, subscription_type: sub}) 
    });
    const newSchool = await resS.json();
    
    const adminUser = `${name.replace(/\s+/g, '').toLowerCase()}_admin`;
    await fetch(`${API_URL}/users`, { 
        method: 'POST', headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({username: adminUser, password: '123', role: 'school', school_id: newSchool.id}) 
    });
    
    alert(`✅ Escuela creada.\nUsuario Admin: ${adminUser}\nContraseña: 123`);
    document.getElementById('school-name').value = '';
    loadAdminDashboard();
}

// --- LOGICA ESCUELA ---
async function loadSchoolDashboard() {
    const res = await fetch(`${API_URL}/users`);
    const users = await res.json();
    const operators = users.filter(u => u.school_id === currentUser.school_id && u.role === 'operator');
    
    const list = document.getElementById('operator-list');
    list.innerHTML = operators.map(o => `
        <li class="p-4 border-b border-gray-100 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <span class="font-bold text-gray-800">${o.username.toUpperCase()}</span> 
            <button onclick="viewOperatorResults(${o.id})" class="bg-black text-white text-xs px-4 py-2 rounded shadow-sm hover:bg-gray-800 transition-colors">Ver Reportes</button>
        </li>
    `).join('');
}

async function createOperator(e) {
    e.preventDefault();
    const username = document.getElementById('op-username').value;
    try {
        const res = await fetch(`${API_URL}/users`, { 
            method: 'POST', headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({username, password: '123', role: 'operator', school_id: currentUser.school_id}) 
        });
        if(res.ok){
            alert('✅ Operador creado exitosamente (Pass: 123)');
            document.getElementById('op-username').value = '';
            loadSchoolDashboard();
        } else {
            alert('⚠️ El nombre de usuario ya existe.');
        }
    } catch(err) { alert('Error creando operador'); }
}

async function viewOperatorResults(userId) {
    const res = await fetch(`${API_URL}/results/${userId}`);
    const results = await res.json();
    const display = document.getElementById('school-results-display');
    
    if(results.length === 0) {
        display.innerHTML = '<p class="text-sm text-gray-500 italic">Este operador aún no tiene simulaciones registradas.</p>';
        return;
    }
    
    display.innerHTML = results.map(r => `
        <div class="mb-3 p-3 border-l-4 border-red-600 bg-gray-50 rounded-r-lg flex justify-between items-center shadow-sm">
            <div>
                <p class="font-bold text-sm text-gray-900">${r.simulator_type}</p>
                <p class="text-xs text-gray-600">Score: ${r.score}% | ${r.date.split(' ')[0]}</p>
            </div>
            <a href="${API_URL}/generate_pdf/${r.id}" target="_blank" class="text-red-600 hover:text-red-800 bg-red-50 p-2 rounded-full">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </a>
        </div>
    `).join('');
}

// --- LOGICA OPERADOR ---
let activeSim = '';
async function loadOperatorDashboard() {
    const res = await fetch(`${API_URL}/results/${currentUser.id}`);
    const results = await res.json();
    const list = document.getElementById('my-certificates');
    
    if(results.length === 0) {
        list.innerHTML = '<p class="text-sm text-gray-500">No hay certificaciones disponibles.</p>';
    } else {
        list.innerHTML = results.map(r => `
            <li class="p-4 mb-3 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center shadow-sm hover:shadow transition-shadow">
                <span class="font-bold text-gray-900 text-sm">${r.simulator_type} <span class="text-gray-500 font-normal ml-2">| Eficiencia: ${r.score}%</span></span>
                <a href="${API_URL}/generate_pdf/${r.id}" target="_blank" class="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors">
                    Descargar PDF
                </a>
            </li>
        `).join('');
    }
}

function startSim(type) {
    activeSim = type;
    document.getElementById('sim-title').innerText = `Entorno Activo: ${type} WEB`;
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('sim-view').classList.remove('hidden');
}

async function finishSim() {
    const score = Math.floor(Math.random() * 20) + 80; // Score random 80-100
    
    await fetch(`${API_URL}/results`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            user_id: currentUser.id, 
            simulator_type: activeSim, 
            score: score, 
            details: `[SISTEMA AUTOMATIZADO]\nEl operador completó el protocolo de inspección.\nTasa de Acierto: ${score}%.\nTiempo de Reacción Promedio: 4.2s.`
        })
    });
    
    alert(`✅ Práctica finalizada. Calificación técnica: ${score}%. \nEl reporte ha sido guardado en su perfil.`);
    
    document.getElementById('sim-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    loadOperatorDashboard();
}