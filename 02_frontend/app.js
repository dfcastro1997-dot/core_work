// Asegúrate de que esta URL apunta a tu Render (o a http://localhost:8000 en desarrollo)
const API_URL = 'https://core-work-api.onrender.com';
let currentUser = null;
let allSchools = [];
let allUsers = [];

const ROLE_LABELS = {
    'admin': 'Administrador',
    'school': 'Escuela / Academia',
    'instructor': 'Instructor',
    'operator': 'Operador'
};

/* ================== SISTEMA DE MODALES ================== */
function customAlert(title, message, type = 'success') {
    const modal = document.getElementById('alert-modal');
    if (modal) {
        document.getElementById('alert-title').innerText = title;
        document.getElementById('alert-message').innerText = message;
        const icon = document.getElementById('alert-icon-container');
        if (type === 'success') {
            icon.innerHTML = `<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
            icon.className = "mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4";
        } else {
            icon.innerHTML = `<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
            icon.className = "mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4";
        }
        modal.classList.remove('hidden');
    } else {
        alert(title + ": " + message);
    }
}

function closeAlertModal() {
    const modal = document.getElementById('alert-modal');
    if (modal) modal.classList.add('hidden');
}

let pendingConfirmAction = null;
function customConfirm(title, message, callback) {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-message').innerText = message;
        pendingConfirmAction = callback;
        modal.classList.remove('hidden');
    } else {
        if(confirm(title + " - " + message)) callback();
    }
}

function closeConfirmModal(proceed) {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.add('hidden');
    if (proceed && pendingConfirmAction) pendingConfirmAction();
}

/* ================== INICIALIZACIÓN ================== */
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
        else if (path.endsWith('instructor.html') && currentUser.role === 'instructor') loadOperatorDashboard(); // Usa la misma función que operador
        else if (path.endsWith('index.html') || path === '/') redirectUserByRole();
        
    } else {
        if(!path.endsWith('index.html') && path !== '/') {
            window.location.href = 'index.html';
        }
    }
});

async function setupHeader() {
    const welcomeEl = document.getElementById('user-welcome');
    const roleEl = document.getElementById('user-role');
    
    if(welcomeEl) welcomeEl.innerText = currentUser.username.toUpperCase();
    if(roleEl) roleEl.innerText = ROLE_LABELS[currentUser.role];

    if (['school', 'operator', 'instructor'].includes(currentUser.role)) {
        try {
            const res = await fetch(`${API_URL}/schools`);
            if (res.ok) {
                const schools = await res.json();
                const userSchool = schools.find(s => s.id === currentUser.school_id);
                
                if (userSchool && userSchool.icon_url) {
                    const container = document.getElementById('top-right-logo-container');
                    const initialsEl = document.getElementById('top-right-initials');
                    const logoEl = document.getElementById('top-right-logo');
                    
                    if (logoEl && initialsEl && container) {
                        logoEl.src = userSchool.icon_url;
                        logoEl.classList.remove('hidden'); 
                        initialsEl.classList.add('hidden'); 
                        
                        container.classList.remove('bg-red-600', 'text-white', 'bg-gray-200', 'border-2', 'border-gray-300');
                        container.classList.add('bg-white', 'border', 'border-gray-200');
                    }
                }
            }
        } catch(e) { console.error("No se pudo cargar el logo de la academia."); }
    }
}

function redirectUserByRole() {
    if (currentUser.role === 'admin') window.location.href = 'admin.html';
    else if (currentUser.role === 'school') window.location.href = 'school.html';
    else if (currentUser.role === 'instructor') window.location.href = 'instructor.html';
    else if (currentUser.role === 'operator') window.location.href = 'operator.html';
}

async function login(e) {
    e.preventDefault();
    const r = document.getElementById('role').value;
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    
    const btn = document.getElementById('btn-ingresar');
    const loadingUi = document.getElementById('loading-ui');
    const progressBar = document.getElementById('progress-bar');
    const loadingText = document.getElementById('loading-text');
    
    btn.classList.add('hidden'); 
    loadingUi.classList.remove('hidden'); 
    progressBar.style.width = '0%';
    loadingText.classList.remove('text-red-600', 'text-green-600');
    loadingText.classList.add('text-gray-500', 'animate-pulse');
    
    const textos = ["Estableciendo conexión...", "Validando credenciales...", "Desplegando entorno..."];
    let txtIndex = 0;
    loadingText.innerText = textos[0];
    const textInterval = setInterval(() => {
        txtIndex = (txtIndex + 1) % textos.length;
        loadingText.innerText = textos[txtIndex];
    }, 800);

    let progress = 0;
    const progInterval = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 5;
        if(progress > 90) progress = 90; 
        progressBar.style.width = progress + '%';
    }, 300);

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({role: r, username: u, password: p})
        });
        
        clearInterval(textInterval);
        clearInterval(progInterval);
        
        if(res.ok) {
            progressBar.style.width = '100%';
            loadingText.innerText = "¡Acceso Autorizado!";
            loadingText.classList.remove('text-gray-500', 'animate-pulse');
            loadingText.classList.add('text-red-600'); 
            
            currentUser = await res.json();
            localStorage.setItem('securityCloudUser', JSON.stringify(currentUser));
            setTimeout(() => { redirectUserByRole(); }, 800);
            
        } else {
            btn.classList.remove('hidden');
            loadingUi.classList.add('hidden');
            alert('❌ Credenciales o Tipo de Ingreso incorrectos');
        }
    } catch(err) { 
        clearInterval(textInterval);
        clearInterval(progInterval);
        btn.classList.remove('hidden');
        loadingUi.classList.add('hidden');
        alert('❌ Error de conexión con el Servidor. Revisa que Render esté activo.'); 
    }
}

function logout() {
    localStorage.removeItem('securityCloudUser');
    currentUser = null;
    window.location.href = 'index.html';
}

/* ================== LÓGICA ADMIN ================== */

function showAdminTab(sectionId, element) {
    document.getElementById('schools-section').classList.add('hidden');
    document.getElementById('operators-section').classList.add('hidden');
    document.getElementById(sectionId).classList.remove('hidden');
    
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('bg-red-50', 'text-red-700', 'border-red-600');
        tab.classList.add('text-gray-600', 'border-transparent');
    });
    
    element.classList.remove('text-gray-600', 'border-transparent');
    element.classList.add('bg-red-50', 'text-red-700', 'border-red-600');
    
    const titulos = {
        'schools-section': 'Gestión de Escuelas',
        'operators-section': 'Directorio de Personal'
    };
    document.getElementById('header-title').innerText = titulos[sectionId];
    if(sectionId === 'operators-section') fetchAndRenderOperators();
}

async function loadAdminDashboard() {
    await fetchSchools();
    fetchAndRenderOperators();
}

async function fetchSchools() {
    try {
        const res = await fetch(`${API_URL}/schools`);
        if (!res.ok) throw new Error("Error fetching");
        allSchools = await res.json();
        
        const list = document.getElementById('school-list');
        if(list) {
            if(allSchools.length === 0) {
                list.innerHTML = `<li class="text-center py-6 text-gray-500 italic">No hay escuelas registradas.</li>`;
            } else {
                list.innerHTML = allSchools.map(s => {
                    const iconoHTML = s.icon_url 
                        ? `<img src="${s.icon_url}" class="w-12 h-12 rounded-lg object-contain bg-white border border-gray-200 flex-shrink-0">`
                        : `<div class="w-12 h-12 bg-gray-200 text-gray-500 rounded-lg flex items-center justify-center font-bold text-xl flex-shrink-0">${s.name.charAt(0).toUpperCase()}</div>`;
                    
                    return `
                    <li class="p-4 bg-gray-50 border border-gray-200 rounded-lg shadow-sm mb-3 flex items-center justify-between hover:border-red-300 transition-colors">
                        <div class="flex items-center">
                            ${iconoHTML}
                            <div class="ml-4">
                                <span class="block font-bold text-black text-lg">${s.name}</span>
                                <span class="block text-sm text-gray-500">Plan: <b>${s.subscription_type}</b> | Límite Ops/Inst: <b>${s.max_operators}</b></span>
                            </div>
                        </div>
                        <div class="flex space-x-3 ml-4">
                            <button onclick="openEditSchoolModal(${s.id})" class="text-blue-600 font-bold hover:underline text-sm">Editar</button>
                            <button onclick="deleteSchool(${s.id})" class="text-red-600 font-bold hover:underline text-sm">Borrar</button>
                        </div>
                    </li>
                    `;
                }).join('');
            }
        }
        
        const filterSelect = document.getElementById('filter-school');
        const modalSelect = document.getElementById('op-school-id');
        if(filterSelect && modalSelect) {
            let optionsHtml = allSchools.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            filterSelect.innerHTML = `<option value="all">Todas las escuelas</option>` + optionsHtml;
            modalSelect.innerHTML = optionsHtml;
        }
    } catch(e) {
        console.error(e);
        customAlert('Error de Red', 'Problema de conexión con el servidor al cargar escuelas.', 'error');
    }
}

async function createSchool(e) {
    e.preventDefault();
    const name = document.getElementById('school-name').value;
    const sub = document.getElementById('school-plan').value;
    const username = document.getElementById('school-username').value;
    const pass = document.getElementById('school-password').value;
    const limit = document.getElementById('school-limit').value;
    const iconUrl = document.getElementById('school-icon').value;
    
    try {
        const res = await fetch(`${API_URL}/schools`, { 
            method: 'POST', headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({name, subscription_type: sub, username: username, password: pass, max_operators: parseInt(limit), icon_url: iconUrl}) 
        });
        if(res.ok) {
            customAlert('Creación Exitosa', 'La escuela y su usuario de acceso fueron creados exitosamente.', 'success');
            document.getElementById('school-name').value = '';
            document.getElementById('school-username').value = '';
            document.getElementById('school-password').value = '';
            document.getElementById('school-icon').value = '';
            fetchSchools();
        } else {
            const err = await res.json();
            customAlert('Error de Validación', err.detail, 'error');
        }
    } catch(err) { customAlert('Error', 'Problema de conexión con el servidor.', 'error'); }
}

function openEditSchoolModal(id) {
    const school = allSchools.find(s => s.id === id);
    if(school) {
        document.getElementById('edit-school-id').value = school.id;
        document.getElementById('edit-school-name').value = school.name;
        document.getElementById('edit-school-plan').value = school.subscription_type;
        document.getElementById('edit-school-limit').value = school.max_operators;
        document.getElementById('edit-school-icon').value = school.icon_url || '';
        document.getElementById('edit-school-modal').classList.remove('hidden');
    }
}

function closeEditSchoolModal() {
    document.getElementById('edit-school-modal').classList.add('hidden');
}

async function saveEditSchool(e) {
    e.preventDefault();
    const id = document.getElementById('edit-school-id').value;
    const name = document.getElementById('edit-school-name').value;
    const sub = document.getElementById('edit-school-plan').value;
    const limit = document.getElementById('edit-school-limit').value;
    const iconUrl = document.getElementById('edit-school-icon').value;

    try {
        const res = await fetch(`${API_URL}/schools/${id}`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: name, subscription_type: sub, max_operators: parseInt(limit), icon_url: iconUrl})
        });
        if(res.ok) {
            customAlert('Éxito', 'Escuela actualizada correctamente.', 'success');
            closeEditSchoolModal();
            fetchSchools(); 
        } else {
            customAlert('Error', 'No se pudo actualizar la escuela.', 'error');
        }
    } catch (error) {
        customAlert('Error', 'Error de conexión con el servidor.', 'error');
    }
}

function deleteSchool(id) {
    customConfirm('Borrar Escuela', '¿Deseas eliminar la escuela? Se borrarán todos los operadores, instructores y resultados permanentemente.', async () => {
        try {
            const res = await fetch(`${API_URL}/schools/${id}`, { method: 'DELETE' });
            if(res.ok) {
                customAlert('Eliminado', 'La escuela ha sido eliminada por completo.', 'success');
                fetchSchools();
            } else {
                customAlert('Error', 'Ocurrió un problema al borrar.', 'error');
            }
        } catch(err) { customAlert('Error', 'Error de conexión.', 'error'); }
    });
}

/* ================== LÓGICA PERSONAL (ADMIN) ================== */
async function fetchAndRenderOperators() {
    try {
        const res = await fetch(`${API_URL}/users`);
        allUsers = await res.json();
        renderOperatorsTable();
    } catch(e) {}
}

function renderOperatorsTable() {
    const tbody = document.getElementById('operators-tbody');
    const filterId = document.getElementById('filter-school').value;
    if(!tbody) return;
    
    let ops = allUsers.filter(u => u.role === 'operator' || u.role === 'instructor');
    if(filterId !== 'all') ops = ops.filter(u => u.school_id == filterId);
    
    if(ops.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500 italic">No hay personal registrado en este filtro.</td></tr>`;
        return;
    }

    tbody.innerHTML = ops.map(o => {
        const sch = allSchools.find(s => s.id === o.school_id);
        const schName = sch ? sch.name : 'Desconocida';
        const roleBadge = o.role === 'instructor' 
            ? `<span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">Instructor</span>` 
            : `<span class="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded">Operador</span>`;

        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 font-bold text-black">${o.username}</td>
                <td class="px-6 py-4">${roleBadge}</td>
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
    document.getElementById('op-modal-title').innerText = id ? 'Editar Personal' : 'Crear Personal';
    
    if(id) {
        const op = allUsers.find(u => u.id === id);
        if(op) {
            document.getElementById('op-username').value = op.username;
            document.getElementById('op-school-id').value = op.school_id;
            document.getElementById('op-role').value = op.role;
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
    const role = document.getElementById('op-role').value;

    try {
        if(id) { 
            const res = await fetch(`${API_URL}/users/${id}`, {
                method: 'PUT', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({username, password: pass, school_id, role})
            });
            if(res.ok) { 
                customAlert('Actualizado', 'Datos actualizados.', 'success'); 
                closeOperatorModal(); 
                fetchAndRenderOperators(); 
            } else { customAlert('Error', 'No se pudo actualizar.', 'error'); }
        } else { 
            if(!pass) { customAlert('Aviso', 'La contraseña es obligatoria.', 'error'); return; }
            const res = await fetch(`${API_URL}/users`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({username, password: pass, role: role, school_id})
            });
            if(res.ok) { 
                customAlert('Creado', 'Usuario creado exitosamente.', 'success'); 
                closeOperatorModal(); 
                fetchAndRenderOperators(); 
            } else { 
                const data = await res.json();
                customAlert('Error', data.detail, 'error'); 
            }
        }
    } catch(err) { customAlert('Error', 'Error de conexión', 'error'); }
}

function deleteOperator(id) {
    customConfirm('Borrar Registro', '¿Estás seguro de borrar este usuario y sus resultados?', async () => {
        try {
            const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
            if(res.ok) fetchAndRenderOperators();
        } catch(err) { customAlert('Error', 'Error al borrar', 'error'); }
    });
}

/* ================== LÓGICA ESCUELA DASHBOARD ================== */
async function loadSchoolDashboard() {
    const res = await fetch(`${API_URL}/users`);
    const users = await res.json();
    const personnel = users.filter(u => u.school_id === currentUser.school_id && (u.role === 'operator' || u.role === 'instructor'));
    
    const list = document.getElementById('operator-list');
    if(list) {
        if (personnel.length === 0) {
            list.innerHTML = `<li class="text-center py-6 text-gray-500 italic">No tienes personal registrado.</li>`;
        } else {
            list.innerHTML = personnel.map(p => {
                const badge = p.role === 'instructor' 
                    ? `<span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded ml-2 uppercase tracking-wider">Instructor</span>` 
                    : `<span class="bg-gray-100 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded ml-2 uppercase tracking-wider">Operador</span>`;
                
                return `
                <li class="p-4 border-b border-gray-100 flex justify-between items-center hover:bg-gray-50 transition-colors">
                    <div class="flex items-center">
                        <span class="font-bold text-gray-800">${p.username.toUpperCase()}</span> 
                        ${badge}
                    </div>
                </li>
            `}).join('');
        }
    }
    loadSchoolGeneralResults();
}

async function createPersonnel(e) {
    e.preventDefault();
    const username = document.getElementById('op-username').value;
    const role = document.getElementById('op-role').value;
    try {
        const res = await fetch(`${API_URL}/users`, { 
            method: 'POST', headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({username, password: '123', role: role, school_id: currentUser.school_id}) 
        });
        if(res.ok){
            alert(`✅ ${role === 'instructor' ? 'Instructor' : 'Operador'} creado exitosamente (Pass: 123)`);
            document.getElementById('op-username').value = '';
            loadSchoolDashboard();
        } else {
            const err = await res.json();
            alert(`⚠️ Error: ${err.detail}`);
        }
    } catch(err) { alert('Error creando usuario'); }
}

async function loadSchoolGeneralResults() {
    const res = await fetch(`${API_URL}/school-results/${currentUser.school_id}`);
    const results = await res.json();
    const display = document.getElementById('school-general-results');
    
    if(!display) return;
    
    if(results.length === 0) {
        display.innerHTML = '<p class="text-sm text-gray-500 italic text-center mt-8">No hay simulaciones registradas en tu academia aún.</p>';
        return;
    }
    
    display.innerHTML = results.map(r => `
        <div class="mb-3 p-3 border-l-4 border-red-600 bg-white rounded-r-lg flex justify-between items-center shadow-sm">
            <div>
                <p class="font-bold text-sm text-gray-900">${r.simulator_type} <span class="text-xs text-gray-500 font-normal ml-2">por ${r.username.toUpperCase()} (${r.role === 'instructor' ? 'Instructor' : 'Operador'})</span></p>
                <p class="text-xs text-gray-600">Score: ${r.score}% | ${r.date.split(' ')[0]}</p>
            </div>
            <a href="${API_URL}/generate_pdf/${r.id}" target="_blank" class="text-red-600 hover:text-red-800 bg-red-50 p-2 rounded-full" title="Ver Informe PDF">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </a>
        </div>
    `).join('');
}

/* ================== LÓGICA OPERADOR / INSTRUCTOR DASHBOARD ================== */
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
            details: `[SISTEMA AUTOMATIZADO]\nEl personal completó el protocolo de inspección.\nTasa de Acierto: ${score}%.\nTiempo de Reacción Promedio: 4.2s.`
        })
    });
    
    alert(`✅ Práctica finalizada. Calificación técnica: ${score}%. \nEl reporte ha sido guardado en su perfil.`);
    
    document.getElementById('sim-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    loadOperatorDashboard();
}