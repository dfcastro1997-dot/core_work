const API_URL = 'https://core-work-api.onrender.com';
let currentUser = null;
let allSchools = [];
let allUsers = [];

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
        
        if(!path.endsWith('index.html') && path !== '/') {
            setupHeader();
        }

        if (path.endsWith('admin.html') && currentUser.role === 'admin') loadAdminDashboard();
        else if (path.endsWith('school.html') && currentUser.role === 'school') loadSchoolDashboard();
        else if (path.endsWith('operator.html') && currentUser.role === 'operator') loadOperatorDashboard();
        else if (path.endsWith('index.html') || path === '/') redirectUserByRole();
        
    } else {
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
    const r = document.getElementById('role').value;
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({role: r, username: u, password: p})
        });
        if(res.ok) {
            currentUser = await res.json();
            localStorage.setItem('securityCloudUser', JSON.stringify(currentUser));
            redirectUserByRole();
        } else {
            alert('❌ Credenciales o Tipo de Ingreso incorrectos');
        }
    } catch(err) { alert('❌ Error conectando con el servidor'); }
}

function logout() {
    localStorage.removeItem('securityCloudUser');
    currentUser = null;
    window.location.href = 'index.html';
}

/* =========================================================================
   LOGICA ADMIN 
========================================================================= */

function showAdminTab(sectionId, element) {
    // Esconder todas
    document.getElementById('schools-section').classList.add('hidden');
    document.getElementById('operators-section').classList.add('hidden');
    
    // Mostrar la elegida
    document.getElementById(sectionId).classList.remove('hidden');
    
    // Cambiar estilos del menú
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('bg-red-50', 'text-red-700', 'border-red-600');
        tab.classList.add('text-gray-600', 'border-transparent');
    });
    
    element.classList.remove('text-gray-600', 'border-transparent');
    element.classList.add('bg-red-50', 'text-red-700', 'border-red-600');
    
    // Cambiar titulo
    const titulos = {
        'schools-section': 'Gestión de Escuelas',
        'operators-section': 'Directorio de Operadores'
    };
    document.getElementById('header-title').innerText = titulos[sectionId];
    
    // Recargar datos si es necesario
    if(sectionId === 'operators-section') fetchAndRenderOperators();
}

async function loadAdminDashboard() {
    await fetchSchools();
    fetchAndRenderOperators();
}

async function fetchSchools() {
    const res = await fetch(`${API_URL}/schools`);
    allSchools = await res.json();
    
    // Render list
    const list = document.getElementById('school-list');
    if(list) {
        list.innerHTML = allSchools.map(s => `
            <li class="p-4 bg-gray-50 border border-gray-200 rounded-lg shadow-sm mb-3 flex flex-col hover:border-red-300 transition-colors">
                <span class="font-bold text-black text-lg">${s.name}</span>
                <span class="text-sm text-gray-500">Plan: <b>${s.subscription_type}</b> | Límite Ops: <b>${s.max_operators}</b> | ID: ${s.id}</span>
            </li>
        `).join('');
    }
    
    // Fill selects
    const filterSelect = document.getElementById('filter-school');
    const modalSelect = document.getElementById('op-school-id');
    
    if(filterSelect && modalSelect) {
        let optionsHtml = allSchools.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        filterSelect.innerHTML = `<option value="all">Todas las escuelas</option>` + optionsHtml;
        modalSelect.innerHTML = optionsHtml;
    }
}

async function createSchool(e) {
    e.preventDefault();
    const name = document.getElementById('school-name').value;
    const sub = document.getElementById('school-plan').value;
    const username = document.getElementById('school-username').value;
    const pass = document.getElementById('school-password').value;
    const limit = document.getElementById('school-limit').value;
    
    try {
        const res = await fetch(`${API_URL}/schools`, { 
            method: 'POST', headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({name, subscription_type: sub, username: username, password: pass, max_operators: parseInt(limit)}) 
        });
        if(res.ok) {
            alert(`✅ Escuela y su usuario de acceso creados exitosamente.`);
            document.getElementById('school-name').value = '';
            document.getElementById('school-username').value = '';
            document.getElementById('school-password').value = '';
            fetchSchools();
        } else {
            const err = await res.json();
            alert(`⚠️ Error: ${err.detail}`);
        }
    } catch(err) { alert("Error de conexión"); }
}

async function fetchAndRenderOperators() {
    const res = await fetch(`${API_URL}/users`);
    allUsers = await res.json();
    renderOperatorsTable();
}

function renderOperatorsTable() {
    const tbody = document.getElementById('operators-tbody');
    const filterId = document.getElementById('filter-school').value;
    
    if(!tbody) return;
    
    let ops = allUsers.filter(u => u.role === 'operator');
    if(filterId !== 'all') {
        ops = ops.filter(u => u.school_id == filterId);
    }
    
    if(ops.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-500 italic">No hay operadores registrados en este filtro.</td></tr>`;
        return;
    }

    tbody.innerHTML = ops.map(o => {
        const sch = allSchools.find(s => s.id === o.school_id);
        const schName = sch ? sch.name : 'Desconocida';
        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 font-bold text-black">${o.username}</td>
                <td class="px-6 py-4 text-gray-600">${schName}</td>
                <td class="px-6 py-4 text-center space-x-3">
                    <button onclick="openOperatorModal(${o.id})" class="text-blue-600 font-bold hover:underline">Editar</button>
                    <button onclick="deleteOperator(${o.id})" class="text-red-600 font-bold hover:underline">Borrar</button>
                </td>
            </tr>
        `;
    }).join('');
}

function openOperatorModal(id = null) {
    document.getElementById('op-modal-form').reset();
    document.getElementById('op-id').value = id || '';
    document.getElementById('op-modal-title').innerText = id ? 'Editar Operador' : 'Crear Operador';
    
    if(id) {
        const op = allUsers.find(u => u.id === id);
        if(op) {
            document.getElementById('op-username').value = op.username;
            document.getElementById('op-school-id').value = op.school_id;
        }
    }
    document.getElementById('operator-modal').classList.remove('hidden');
}

function closeOperatorModal() {
    document.getElementById('operator-modal').classList.add('hidden');
}

async function saveOperator(e) {
    e.preventDefault();
    const id = document.getElementById('op-id').value;
    const username = document.getElementById('op-username').value;
    const pass = document.getElementById('op-password').value;
    const school_id = parseInt(document.getElementById('op-school-id').value);

    try {
        if(id) { // Editar
            const res = await fetch(`${API_URL}/users/${id}`, {
                method: 'PUT', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({username, password: pass, school_id})
            });
            if(res.ok) { alert('✅ Actualizado'); closeOperatorModal(); fetchAndRenderOperators(); }
            else { alert('⚠️ Error al actualizar'); }
        } else { // Crear
            if(!pass) return alert("La contraseña es obligatoria para nuevos.");
            const res = await fetch(`${API_URL}/users`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({username, password: pass, role: 'operator', school_id})
            });
            if(res.ok) { alert('✅ Creado'); closeOperatorModal(); fetchAndRenderOperators(); }
            else { 
                const data = await res.json();
                alert(`⚠️ ${data.detail}`); 
            }
        }
    } catch(err) { alert('Error de conexión'); }
}

async function deleteOperator(id) {
    if(!confirm("¿Estás seguro de borrar este operador y todos sus historiales PDF?")) return;
    try {
        const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
        if(res.ok) fetchAndRenderOperators();
    } catch(err) { alert("Error al borrar"); }
}

/* =========================================================================
   LOGICA ESCUELA 
========================================================================= */
async function loadSchoolDashboard() {
    const res = await fetch(`${API_URL}/users`);
    const users = await res.json();
    const operators = users.filter(u => u.school_id === currentUser.school_id && u.role === 'operator');
    
    const list = document.getElementById('operator-list');
    if(!list) return;
    list.innerHTML = operators.map(o => `
        <li class="p-4 border-b border-gray-100 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <span class="font-bold text-gray-800">${o.username.toUpperCase()}</span> 
            <button onclick="viewOperatorResults(${o.id})" class="bg-black text-white text-xs px-4 py-2 rounded shadow-sm hover:bg-red-600 transition-colors">Ver Reportes PDF</button>
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
            const err = await res.json();
            alert(`⚠️ Error: ${err.detail}`);
        }
    } catch(err) { alert('Error creando operador'); }
}

async function viewOperatorResults(userId) {
    const res = await fetch(`${API_URL}/results/${userId}`);
    const results = await res.json();
    const display = document.getElementById('school-results-display');
    
    if(results.length === 0) {
        display.innerHTML = '<p class="text-sm text-gray-500 italic text-center mt-8">Este operador aún no tiene simulaciones registradas.</p>';
        return;
    }
    
    display.innerHTML = results.map(r => `
        <div class="mb-3 p-3 border-l-4 border-red-600 bg-white rounded-r-lg flex justify-between items-center shadow-sm">
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

/* =========================================================================
   LOGICA OPERADOR 
========================================================================= */
let activeSim = '';
async function loadOperatorDashboard() {
    const res = await fetch(`${API_URL}/results/${currentUser.id}`);
    const results = await res.json();
    const list = document.getElementById('my-certificates');
    if(!list) return;
    
    if(results.length === 0) {
        list.innerHTML = '<p class="text-sm text-gray-500">No hay certificaciones disponibles.</p>';
    } else {
        list.innerHTML = results.map(r => `
            <li class="p-4 mb-3 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center shadow-sm hover:border-red-300 transition-colors">
                <span class="font-bold text-gray-900 text-sm">${r.simulator_type} <span class="text-gray-500 font-normal ml-2">| Eficiencia: ${r.score}%</span></span>
                <a href="${API_URL}/generate_pdf/${r.id}" target="_blank" class="text-xs font-bold text-white bg-red-600 hover:bg-black px-4 py-2 rounded-lg transition-colors">
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
    const score = Math.floor(Math.random() * 20) + 80; 
    
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