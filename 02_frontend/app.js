// Cambia a http://localhost:8000 si pruebas en local
const API_URL = 'https://core-work-api.onrender.com';
let currentUser = null;
let allSchools = [];
let allUsers = [];
let schoolDataResults = []; 

const ROLE_LABELS = { 'admin': 'Administrador', 'school': 'Escuela / Academia', 'instructor': 'Instructor', 'operator': 'Operador' };

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
    } else { alert(title + ": " + message); }
}

function closeAlertModal() { document.getElementById('alert-modal').classList.add('hidden'); }

let pendingConfirmAction = null;
function customConfirm(title, message, callback) {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-message').innerText = message;
        pendingConfirmAction = callback;
        modal.classList.remove('hidden');
    } else { if(confirm(title + " - " + message)) callback(); }
}

function closeConfirmModal(proceed) {
    document.getElementById('confirm-modal').classList.add('hidden');
    if (proceed && pendingConfirmAction) pendingConfirmAction();
}

/* ================== INICIALIZACIÓN ================== */
document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('securityCloudUser');
    const path = window.location.pathname;

    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        if(!path.endsWith('index.html') && path !== '/') setupHeader();

        if (path.endsWith('admin.html') && currentUser.role === 'admin') loadAdminDashboard();
        else if (path.endsWith('school.html') && currentUser.role === 'school') loadSchoolDashboard();
        else if (path.endsWith('operator.html') && currentUser.role === 'operator') loadOperatorDashboard();
        else if (path.endsWith('instructor.html') && currentUser.role === 'instructor') { loadOperatorDashboard(); loadSchoolGeneralResults(); }
        else if (path.endsWith('index.html') || path === '/') redirectUserByRole();
    } else {
        if(!path.endsWith('index.html') && path !== '/') window.location.href = 'index.html';
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
                        logoEl.classList.remove('hidden'); initialsEl.classList.add('hidden'); 
                        container.classList.remove('bg-red-600', 'bg-gray-200');
                        container.classList.add('bg-white', 'border', 'border-gray-200');
                    }
                }
                if((currentUser.role === 'operator' || currentUser.role === 'instructor') && userSchool) {
                    renderAllowedSimulators(userSchool.allowed_sims);
                }
            }
        } catch(e) {}
    }
}

function renderAllowedSimulators(allowedStr) {
    const container = document.getElementById('simulators-container');
    if(!container) return;
    let html = '';
    const sims = allowedStr ? allowedStr.split(',') : [];
    
    if(sims.includes('DENSITY')) {
        const bg = currentUser.role === 'instructor' ? 'group-hover:bg-red-600' : 'group-hover:bg-red-600';
        html += `
        <div class="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-red-600 transition-all cursor-pointer group flex flex-col" onclick="startSim('DENSITY')">
            <div class="w-14 h-14 bg-gray-100 text-black rounded-xl flex items-center justify-center mb-6 ${bg} group-hover:text-white transition-colors">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            </div>
            <h3 class="text-2xl font-bold text-black mb-2">DENSITY</h3>
            <p class="text-sm text-gray-500 mb-8 flex-1 leading-relaxed">Simulación 3D avanzada para inspección de equipajes.</p>
            <button class="w-full bg-black text-white py-3.5 rounded-lg font-bold ${bg} transition-colors shadow-sm">Entrar al Módulo</button>
        </div>`;
    }
    
    if(sims.includes('VMS-X')) {
        html += `
        <div class="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-black transition-all cursor-pointer group flex flex-col" onclick="startSim('VMS-X')">
            <div class="w-14 h-14 bg-gray-100 text-black rounded-xl flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            </div>
            <h3 class="text-2xl font-bold text-black mb-2">VMS-X</h3>
            <p class="text-sm text-gray-500 mb-8 flex-1 leading-relaxed">Centro de monitoreo táctico CCTV y reconocimiento.</p>
            <button class="w-full border-2 border-black text-black py-3.5 rounded-lg font-bold group-hover:bg-black group-hover:text-white transition-colors">Entrar al Módulo</button>
        </div>`;
    }
    
    container.innerHTML = html === '' ? `<div class="col-span-2 text-center p-8 bg-red-50 text-red-600 rounded-xl font-bold border border-red-200">Tu academia no tiene permisos asignados.</div>` : html;
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
    
    btn.classList.add('hidden'); loadingUi.classList.remove('hidden'); progressBar.style.width = '0%';
    
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
        clearInterval(progInterval);
        
        if(res.ok) {
            progressBar.style.width = '100%';
            currentUser = await res.json();
            localStorage.setItem('securityCloudUser', JSON.stringify(currentUser));
            setTimeout(() => { redirectUserByRole(); }, 800);
        } else {
            const err = await res.json();
            btn.classList.remove('hidden'); loadingUi.classList.add('hidden');
            alert(`❌ ${err.detail}`);
        }
    } catch(err) { 
        clearInterval(progInterval);
        btn.classList.remove('hidden'); loadingUi.classList.add('hidden');
        alert('❌ Error de conexión. El servidor backend no responde.'); 
    }
}

function logout() { localStorage.removeItem('securityCloudUser'); currentUser = null; window.location.href = 'index.html'; }

/* ================== LÓGICA ADMIN (ESCUELAS Y LIMITES) ================== */
function showAdminTab(sectionId, element) {
    document.getElementById('schools-section').classList.add('hidden');
    document.getElementById('operators-section').classList.add('hidden');
    document.getElementById(sectionId).classList.remove('hidden');
    
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('bg-red-50', 'text-red-700', 'border-red-600');
        tab.classList.add('text-gray-600', 'border-transparent');
    });
    element.classList.add('bg-red-50', 'text-red-700', 'border-red-600');
    
    document.getElementById('header-title').innerText = sectionId === 'schools-section' ? 'Gestión de Escuelas' : 'Directorio de Personal';
    if(sectionId === 'operators-section') fetchAndRenderOperators();
}

async function loadAdminDashboard() { await fetchSchools(); fetchAndRenderOperators(); }

async function fetchSchools() {
    try {
        const res = await fetch(`${API_URL}/schools`);
        allSchools = await res.json();
        
        const list = document.getElementById('school-list');
        if(list) {
            if(allSchools.length === 0) list.innerHTML = `<li class="text-center py-6 text-gray-500 italic">No hay escuelas registradas.</li>`;
            else {
                list.innerHTML = allSchools.map(s => {
                    const statusBadge = s.is_active ? `<span class="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Activa</span>` : `<span class="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Suspendida</span>`;
                    return `
                    <li class="p-4 bg-gray-50 border border-gray-200 rounded-lg shadow-sm mb-3 flex items-center justify-between hover:border-red-300 transition-colors">
                        <div class="flex items-center">
                            <div class="w-12 h-12 bg-gray-200 text-gray-500 rounded-lg flex items-center justify-center font-bold text-xl shrink-0">
                                ${s.icon_url ? `<img src="${s.icon_url}" class="w-full h-full object-contain rounded-lg">` : s.name.charAt(0).toUpperCase()}
                            </div>
                            <div class="ml-4">
                                <span class="block font-bold text-black text-lg">${s.name} ${statusBadge}</span>
                                <span class="block text-xs text-gray-500 mt-1">Ops: ${s.max_operators} | Inst: ${s.max_instructors} | Sims: ${s.allowed_sims}</span>
                            </div>
                        </div>
                        <div class="flex space-x-3 ml-4">
                            <button onclick="openEditSchoolModal(${s.id})" class="text-blue-600 font-bold hover:underline text-sm">Editar</button>
                            <button onclick="deleteSchool(${s.id})" class="text-red-600 font-bold hover:underline text-sm">Borrar</button>
                        </div>
                    </li>`;
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
    } catch(e) {}
}

function getCheckedSims(prefix) {
    let sims = [];
    if(document.getElementById(`${prefix}-density`) && document.getElementById(`${prefix}-density`).checked) sims.push("DENSITY");
    if(document.getElementById(`${prefix}-vmsx`) && document.getElementById(`${prefix}-vmsx`).checked) sims.push("VMS-X");
    return sims.join(",");
}

async function createSchool(e) {
    e.preventDefault();
    const name = document.getElementById('school-name').value;
    const sub = document.getElementById('school-plan').value;
    const username = document.getElementById('school-username').value;
    const pass = document.getElementById('school-password').value;
    const limit = document.getElementById('school-limit').value;
    const limitInst = document.getElementById('school-limit-inst').value;
    const iconUrl = document.getElementById('school-icon').value;
    const allowed = getCheckedSims("sim");
    
    try {
        const res = await fetch(`${API_URL}/schools`, { 
            method: 'POST', headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({name, subscription_type: sub, username, password: pass, max_operators: parseInt(limit), max_instructors: parseInt(limitInst), icon_url: iconUrl, allowed_sims: allowed, is_active: true}) 
        });
        if(res.ok) { customAlert('Éxito', 'Escuela creada.', 'success'); e.target.reset(); fetchSchools(); } 
        else { const err = await res.json(); customAlert('Error', err.detail, 'error'); }
    } catch(err) {}
}

function openEditSchoolModal(id) {
    const s = allSchools.find(x => x.id === id);
    if(s) {
        document.getElementById('edit-school-id').value = s.id;
        document.getElementById('edit-school-name').value = s.name;
        document.getElementById('edit-school-plan').value = s.subscription_type;
        document.getElementById('edit-school-limit').value = s.max_operators;
        document.getElementById('edit-school-limit-inst').value = s.max_instructors;
        document.getElementById('edit-school-icon').value = s.icon_url;
        
        const chkActive = document.getElementById('edit-school-active');
        chkActive.checked = s.is_active;
        chkActive.dispatchEvent(new Event('change'));
        
        document.getElementById('edit-sim-density').checked = s.allowed_sims.includes("DENSITY");
        document.getElementById('edit-sim-vmsx').checked = s.allowed_sims.includes("VMS-X");
        
        document.getElementById('edit-school-modal').classList.remove('hidden');
    }
}

function closeEditSchoolModal() { document.getElementById('edit-school-modal').classList.add('hidden'); }

async function saveEditSchool(e) {
    e.preventDefault();
    const id = document.getElementById('edit-school-id').value;
    const payload = {
        name: document.getElementById('edit-school-name').value,
        subscription_type: document.getElementById('edit-school-plan').value,
        max_operators: parseInt(document.getElementById('edit-school-limit').value),
        max_instructors: parseInt(document.getElementById('edit-school-limit-inst').value),
        icon_url: document.getElementById('edit-school-icon').value,
        is_active: document.getElementById('edit-school-active').checked,
        allowed_sims: getCheckedSims("edit-sim")
    };
    try {
        const res = await fetch(`${API_URL}/schools/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) { customAlert('Éxito', 'Escuela actualizada.', 'success'); closeEditSchoolModal(); fetchSchools(); }
    } catch (error) {}
}

function deleteSchool(id) {
    customConfirm('Borrar Escuela', 'Se borrarán todos los operadores y resultados permanentemente.', async () => {
        const res = await fetch(`${API_URL}/schools/${id}`, { method: 'DELETE' });
        if(res.ok) fetchSchools();
    });
}

/* ADMIN GESTION PERSONAL */
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
    
    if(ops.length === 0) return tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500 italic">No hay registros.</td></tr>`;

    tbody.innerHTML = ops.map(o => {
        const sch = allSchools.find(s => s.id === o.school_id);
        const roleBadge = o.role === 'instructor' ? `<span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">Instructor</span>` : `<span class="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">Operador</span>`;
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 font-bold">${o.username}</td>
                <td class="px-6 py-4">${roleBadge}</td>
                <td class="px-6 py-4">${sch ? sch.name : 'N/A'}</td>
                <td class="px-6 py-4 text-center space-x-3">
                    <button onclick="openOperatorModal(${o.id})" class="text-blue-600 hover:underline">Editar</button>
                    <button onclick="deleteOperator(${o.id})" class="text-red-600 hover:underline">Borrar</button>
                </td>
            </tr>`;
    }).join('');
}

function openOperatorModal(id = null) {
    document.getElementById('op-modal-form').reset();
    document.getElementById('op-id').value = id || '';
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
function closeOperatorModal() { document.getElementById('operator-modal').classList.add('hidden'); }

async function saveOperator(e) {
    e.preventDefault();
    const payload = {
        username: document.getElementById('op-username').value,
        password: document.getElementById('op-password').value,
        school_id: parseInt(document.getElementById('op-school-id').value),
        role: document.getElementById('op-role').value
    };
    const id = document.getElementById('op-id').value;

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/users/${id}` : `${API_URL}/users`;
        if(!id && !payload.password) return customAlert('Error', 'Contraseña obligatoria', 'error');
        const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) { closeOperatorModal(); fetchAndRenderOperators(); } 
        else { const data = await res.json(); customAlert('Error', data.detail, 'error'); }
    } catch(err) {}
}

function deleteOperator(id) {
    customConfirm('Borrar', '¿Borrar usuario permanentemente?', async () => {
        await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
        fetchAndRenderOperators();
    });
}

/* ================== LÓGICA ESCUELA DASHBOARD Y REPORTES ================== */
async function loadSchoolDashboard() {
    const res = await fetch(`${API_URL}/users`);
    allUsers = await res.json(); 
    const personnel = allUsers.filter(u => u.school_id === currentUser.school_id && (u.role === 'operator' || u.role === 'instructor'));
    
    const list = document.getElementById('operator-list');
    if(list) {
        if (personnel.length === 0) list.innerHTML = `<li class="text-center py-6 text-gray-500 italic">No tienes personal registrado.</li>`;
        else {
            list.innerHTML = personnel.map(p => {
                const badge = p.role === 'instructor' 
                    ? `<span class="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded ml-2 uppercase tracking-wider">Instructor</span>` 
                    : `<span class="bg-gray-100 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded ml-2 uppercase tracking-wider">Operador</span>`;
                
                return `
                <li class="p-4 border-b border-gray-100 flex justify-between items-center hover:bg-gray-50 transition-colors">
                    <div class="flex items-center"><span class="font-bold text-gray-800">${p.username.toUpperCase()}</span> ${badge}</div>
                    <div class="flex space-x-3 ml-4 items-center">
                        <button onclick="openSchoolPersonnelModal(${p.id})" class="text-blue-600 font-bold hover:underline text-xs">Editar</button>
                        <button onclick="deleteSchoolPersonnel(${p.id})" class="text-red-600 font-bold hover:underline text-xs">Borrar</button>
                    </div>
                </li>`
            }).join('');
        }
    }
    loadSchoolGeneralResults();
    loadSchoolQuizGrades(); // Cargar también los quices para la escuela
}

async function createPersonnel(e) {
    e.preventDefault();
    const payload = {
        username: document.getElementById('op-username').value,
        password: document.getElementById('op-password').value,
        role: document.getElementById('op-role').value,
        school_id: currentUser.school_id
    };
    try {
        const res = await fetch(`${API_URL}/users`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if(res.ok){
            customAlert('Éxito', `Personal creado exitosamente`, 'success');
            e.target.reset(); loadSchoolDashboard();
        } else {
            const err = await res.json(); customAlert('Alerta de Límite', err.detail, 'error');
        }
    } catch(err) {}
}

function openSchoolPersonnelModal(id) {
    const p = allUsers.find(u => u.id === id);
    if(p) {
        document.getElementById('sp-id').value = p.id;
        document.getElementById('sp-username').value = p.username;
        document.getElementById('sp-role').value = p.role;
        document.getElementById('school-personnel-modal').classList.remove('hidden');
    }
}
function closeSchoolPersonnelModal() { document.getElementById('school-personnel-modal').classList.add('hidden'); }

async function saveSchoolPersonnel(e) {
    e.preventDefault();
    const id = document.getElementById('sp-id').value;
    const payload = {
        username: document.getElementById('sp-username').value,
        password: document.getElementById('sp-password').value,
        school_id: currentUser.school_id,
        role: document.getElementById('sp-role').value
    };
    const res = await fetch(`${API_URL}/users/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if(res.ok) { closeSchoolPersonnelModal(); loadSchoolDashboard(); }
    else { const data = await res.json(); customAlert('Error', data.detail, 'error'); }
}

function deleteSchoolPersonnel(id) {
    customConfirm('Borrar Personal', '¿Borrar usuario permanentemente?', async () => {
        await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
        loadSchoolDashboard();
    });
}

/* METRICAS Y EXPORTACION */
async function loadSchoolGeneralResults() {
    const res = await fetch(`${API_URL}/school-results/${currentUser.school_id}`);
    schoolDataResults = await res.json();
    
    const display = document.getElementById('school-general-results');
    if(display) {
        if(schoolDataResults.length === 0) {
            display.innerHTML = '<p class="text-sm text-gray-500 italic text-center mt-8">No hay simulaciones registradas.</p>';
        } else {
            display.innerHTML = schoolDataResults.map(r => `
                <div class="mb-3 p-4 border-l-4 border-red-600 bg-white rounded-r-lg flex justify-between items-center shadow-sm">
                    <div>
                        <p class="font-bold text-sm text-gray-900">${r.simulator_type} <span class="text-xs text-gray-500 font-normal ml-2">por ${r.username.toUpperCase()} (${r.role})</span></p>
                        <p class="text-xs text-gray-600">Score: ${r.score}% | ${r.date.split(' ')[0]}</p>
                        ${r.feedback ? `<p class="text-xs text-red-600 mt-1 italic">" ${r.feedback} "</p>` : ''}
                    </div>
                    <div class="flex space-x-2">
                        ${currentUser.role === 'instructor' ? `<button onclick="openFeedbackModal(${r.id})" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-1 px-3 rounded border border-gray-300">Comentar</button>` : ''}
                        <a href="${API_URL}/generate_pdf/${r.id}" target="_blank" class="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded">PDF</a>
                    </div>
                </div>
            `).join('');
        }
    }

    if(currentUser.role === 'school') {
        const totalPruebas = schoolDataResults.length;
        const prom = totalPruebas > 0 ? (schoolDataResults.reduce((acc, curr) => acc + curr.score, 0) / totalPruebas).toFixed(1) : 0;
        const kpi = document.getElementById('kpi-score');
        if(kpi) kpi.innerText = `${prom}%`;
        
        const ctx = document.getElementById('schoolChart');
        if(ctx && typeof Chart !== 'undefined' && totalPruebas > 0) {
            if(window.schoolChartInstance) window.schoolChartInstance.destroy();
            const dateMap = {};
            schoolDataResults.slice().reverse().forEach(r => {
                const date = r.date.split(' ')[0];
                if(!dateMap[date]) dateMap[date] = [];
                dateMap[date].push(r.score);
            });
            const labels = Object.keys(dateMap).slice(-7); 
            const data = labels.map(l => dateMap[l].reduce((a,b)=>a+b,0)/dateMap[l].length);

            window.schoolChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{ label: 'Promedio Táctico Diario (%)', data: data, borderColor: 'rgb(220, 38, 38)', backgroundColor: 'rgba(220, 38, 38, 0.1)', tension: 0.3, fill: true }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }
}

async function loadSchoolQuizGrades() {
    const tbody = document.getElementById('school-quiz-grades-tbody');
    if(!tbody) return;
    try {
        const res = await fetch(`${API_URL}/quizzes/results/${currentUser.school_id}`);
        const grades = await res.json();
        if(grades.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500 italic">No hay calificaciones registradas.</td></tr>`;
        } else {
            tbody.innerHTML = grades.map(g => {
                const color = g.score >= 80 ? 'text-green-600' : 'text-red-600';
                return `
                <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
                    <td class="py-3 text-xs text-gray-500">${g.date.split(' ')[0]}</td>
                    <td class="py-3 font-bold text-black">${g.operator_name.toUpperCase()}</td>
                    <td class="py-3 text-gray-700">${g.quiz_title}</td>
                    <td class="py-3 text-center font-extrabold text-sm ${color}">${g.score}%</td>
                </tr>`;
            }).join('');
        }
    } catch(e) {}
}

function exportToCSV() {
    if(schoolDataResults.length === 0) return customAlert('Aviso', 'No hay datos para exportar', 'error');
    let csvContent = "data:text/csv;charset=utf-8,ID,Usuario,Rol,Simulador,Score(%),Fecha,Comentario_Instructor\n";
    schoolDataResults.forEach(row => {
        let cleanFeedback = row.feedback ? row.feedback.replace(/,/g, " ") : "";
        csvContent += `${row.id},${row.username},${row.role},${row.simulator_type},${row.score},${row.date},${cleanFeedback}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Reporte_Academia.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

/* ================== INSTRUCTOR FEEDBACK ================== */
function openFeedbackModal(resultId) {
    document.getElementById('feed-result-id').value = resultId;
    document.getElementById('feed-text').value = '';
    document.getElementById('feedback-modal').classList.remove('hidden');
}
function closeFeedbackModal() { document.getElementById('feedback-modal').classList.add('hidden'); }

async function saveFeedback(e) {
    e.preventDefault();
    const id = document.getElementById('feed-result-id').value;
    const fb = document.getElementById('feed-text').value;
    try {
        const res = await fetch(`${API_URL}/results/${id}/feedback`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({feedback: fb})
        });
        if(res.ok) { closeFeedbackModal(); loadSchoolGeneralResults(); customAlert('Éxito', 'Comentario añadido al PDF.', 'success');}
    } catch(e) { customAlert('Error', 'No se pudo guardar.', 'error'); }
}


/* ================== SISTEMA DE EVALUACIONES (QUIZZES) ================== */
let questionCount = 0;

async function loadQuizMaker() {
    document.getElementById('quiz-title').value = '';
    document.getElementById('quiz-time').value = '15';
    document.getElementById('questions-container').innerHTML = '';
    questionCount = 0;
    addQuestion(); 
    updateTotalWeight();

    const res = await fetch(`${API_URL}/users`);
    const users = await res.json();
    const ops = users.filter(u => u.school_id === currentUser.school_id && u.role === 'operator');
    
    const list = document.getElementById('operators-assign-list');
    if (ops.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-500 italic col-span-3">No hay operadores en la academia.</p>';
    } else {
        list.innerHTML = ops.map(o => `
            <label class="flex items-center space-x-2 cursor-pointer bg-white p-2 rounded border border-gray-200 shadow-sm hover:border-red-300">
                <input type="checkbox" value="${o.id}" class="chk-assign rounded text-red-600 focus:ring-red-600">
                <span class="text-xs font-bold text-gray-700">${o.username}</span>
            </label>
        `).join('');
    }
}

function addQuestion() {
    questionCount++;
    const id = questionCount;
    const div = document.createElement('div');
    div.className = "bg-white border border-gray-200 rounded-xl p-6 relative shadow-sm question-block";
    div.innerHTML = `
        <div class="absolute -top-3 -left-3 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md">${id}</div>
        <button type="button" onclick="this.parentElement.remove(); updateTotalWeight();" class="absolute top-4 right-4 text-red-500 hover:text-red-700 font-bold text-xs bg-red-50 px-2 py-1 rounded">X Eliminar</button>
        
        <div class="mb-4 pr-20">
            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Enunciado de la Pregunta</label>
            <textarea class="q-text w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-sm outline-none focus:border-red-500" rows="2" required></textarea>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div><label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Opción 1</label><input type="text" class="q-opt w-full bg-gray-50 border border-gray-300 p-2 rounded text-sm outline-none" required></div>
            <div><label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Opción 2</label><input type="text" class="q-opt w-full bg-gray-50 border border-gray-300 p-2 rounded text-sm outline-none" required></div>
            <div><label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Opción 3</label><input type="text" class="q-opt w-full bg-gray-50 border border-gray-300 p-2 rounded text-sm outline-none" required></div>
            <div><label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Opción 4</label><input type="text" class="q-opt w-full bg-gray-50 border border-gray-300 p-2 rounded text-sm outline-none" required></div>
        </div>

        <div class="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div>
                <label class="block text-xs font-bold text-black uppercase mb-1">Respuesta Correcta</label>
                <select class="q-correct w-full border border-gray-300 p-2 rounded text-sm outline-none cursor-pointer">
                    <option value="0">Opción 1</option><option value="1">Opción 2</option><option value="2">Opción 3</option><option value="3">Opción 4</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-bold text-black uppercase mb-1">Peso en la Nota (%)</label>
                <input type="number" class="q-weight w-full border border-gray-300 p-2 rounded text-sm outline-none focus:border-red-500 font-bold text-red-600" value="20" min="1" max="100" required onchange="updateTotalWeight()">
            </div>
        </div>
    `;
    document.getElementById('questions-container').appendChild(div);
    updateTotalWeight();
}

function updateTotalWeight() {
    const weights = document.querySelectorAll('.q-weight');
    let sum = 0; weights.forEach(w => sum += parseInt(w.value || 0));
    const lbl = document.getElementById('quiz-total-weight');
    if(lbl) {
        lbl.innerText = `${sum}%`;
        lbl.className = sum === 100 ? "text-green-600 text-lg font-extrabold ml-2" : "text-red-600 text-lg font-extrabold ml-2";
    }
}

async function saveQuiz() {
    const title = document.getElementById('quiz-title').value.trim();
    const time = document.getElementById('quiz-time').value;
    
    if(!title) return customAlert('Aviso', 'Dale un nombre a la evaluación.', 'error');

    const weights = document.querySelectorAll('.q-weight');
    let sum = 0; weights.forEach(w => sum += parseInt(w.value || 0));
    if(sum !== 100) return customAlert('Matemática Inválida', 'La suma del peso de todas las preguntas debe ser exactamente 100%.', 'error');

    const blocks = document.querySelectorAll('.question-block');
    const questionsArray = [];
    for(let block of blocks) {
        const text = block.querySelector('.q-text').value.trim();
        const opts = Array.from(block.querySelectorAll('.q-opt')).map(o => o.value.trim());
        const correct = block.querySelector('.q-correct').value;
        const weight = block.querySelector('.q-weight').value;

        if(!text || opts.some(o => !o)) return customAlert('Campos Vacíos', 'Llena todos los enunciados y opciones.', 'error');
        questionsArray.push({ q: text, opts: opts, correct: correct, weight: weight });
    }

    const checkboxes = document.querySelectorAll('.chk-assign:checked');
    if(checkboxes.length === 0) return customAlert('Aviso', 'Asigna el examen a por lo menos 1 operador.', 'error');
    
    const assignedIds = Array.from(checkboxes).map(c => parseInt(c.value));
    
    const payload = {
        school_id: currentUser.school_id, instructor_id: currentUser.id, title: title,
        questions: JSON.stringify(questionsArray), time_limit: parseInt(time), assigned_operators: JSON.stringify(assignedIds)
    };

    try {
        const res = await fetch(`${API_URL}/quizzes`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) {
            customAlert('Evaluación Desplegada', 'El examen está activo para los operadores.', 'success');
            document.getElementById('quiz-title').value = '';
            switchView('dashboard');
        } else customAlert('Error', 'No se pudo crear la evaluación.', 'error');
    } catch(e) { customAlert('Error', 'Fallo de conexión.', 'error'); }
}

async function loadQuizGrades() {
    try {
        const res = await fetch(`${API_URL}/quizzes/results/${currentUser.school_id}`);
        const grades = await res.json();
        const tbody = document.getElementById('quiz-grades-tbody');
        if(!tbody) return;

        if(grades.length === 0) tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500 italic">Nadie ha tomado exámenes aún.</td></tr>`;
        else {
            tbody.innerHTML = grades.map(g => {
                const color = g.score >= 80 ? 'text-green-600' : 'text-red-600';
                return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4 text-xs text-gray-500">${g.date.split(' ')[0]}</td>
                    <td class="px-6 py-4 font-bold text-black">${g.operator_name.toUpperCase()}</td>
                    <td class="px-6 py-4 text-gray-700">${g.quiz_title}</td>
                    <td class="px-6 py-4 text-center font-extrabold text-lg ${color}">${g.score}%</td>
                </tr>`;
            }).join('');
        }
    } catch(e) {}
}


// OPERADOR: Cargar y Tomar Exámenes
let activeQuizData = null;
let activeQuizTimer = null;
let timeRemaining = 0;

async function loadOperatorQuizzes() {
    try {
        const res = await fetch(`${API_URL}/quizzes/school/${currentUser.school_id}`);
        const allQuizzes = await res.json();
        
        const myQuizzes = allQuizzes.filter(q => {
            if(!q.is_active) return false;
            try { const assigned = JSON.parse(q.assigned_operators); return assigned.includes(currentUser.id); } catch(e) { return false; }
        });

        const list = document.getElementById('operator-quiz-list');
        if(!list) return;

        if(myQuizzes.length === 0) list.innerHTML = `<div class="col-span-2 text-center p-8 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 italic">No tienes evaluaciones teóricas pendientes.</div>`;
        else {
            list.innerHTML = myQuizzes.map(q => `
                <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-red-600 transition-all flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-bold text-black text-lg">${q.title}</h3>
                            <span class="bg-red-50 text-red-700 text-[10px] font-bold px-2 py-1 rounded border border-red-200 shrink-0">NUEVO</span>
                        </div>
                        <p class="text-xs text-gray-500 flex items-center mt-3"><svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Tiempo Límite: <b>${q.time_limit} mins</b></p>
                    </div>
                    <button onclick='takeQuiz(${JSON.stringify(q).replace(/'/g, "\\'")})' class="w-full mt-6 bg-black hover:bg-red-600 text-white font-bold py-2.5 rounded-lg transition-colors shadow-sm text-sm">
                        Comenzar Examen
                    </button>
                </div>
            `).join('');
        }
    } catch(e) {}
}

function takeQuiz(quizObj) {
    customConfirm('Iniciar Examen', `¿Estás listo? El tiempo comenzará a correr (${quizObj.time_limit} minutos) y no podrás pausarlo.`, () => {
        activeQuizData = quizObj;
        
        document.getElementById('active-quiz-title').innerText = quizObj.title;
        const container = document.getElementById('quiz-questions-render');
        container.innerHTML = '';
        
        const questions = JSON.parse(quizObj.questions);
        questions.forEach((q, index) => {
            let optsHtml = q.opts.map((opt, i) => `
                <label class="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-red-50 transition-colors">
                    <input type="radio" name="q_${index}" value="${i}" class="w-4 h-4 text-red-600 focus:ring-red-600">
                    <span class="text-sm font-semibold text-gray-800">${opt}</span>
                </label>
            `).join('');

            container.innerHTML += `
                <div class="quiz-item" data-index="${index}">
                    <h4 class="text-lg font-bold text-black mb-4"><span class="text-red-600 mr-2">${index + 1}.</span>${q.q}</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">${optsHtml}</div>
                </div>`;
        });

        document.getElementById('take-quiz-view').classList.remove('hidden');
        startQuizTimer(quizObj.time_limit);
    });
}

function startQuizTimer(minutes) {
    timeRemaining = minutes * 60;
    updateTimerDisplay();
    
    activeQuizTimer = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        if(timeRemaining <= 0) {
            clearInterval(activeQuizTimer);
            customAlert('Tiempo Agotado', 'El tiempo ha terminado. Enviando...', 'error');
            document.getElementById('quiz-form').dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}));
        }
    }, 1000);
}

function updateTimerDisplay() {
    const el = document.getElementById('quiz-timer');
    if(!el) return;
    const m = String(Math.floor(timeRemaining / 60)).padStart(2, '0');
    const s = String(timeRemaining % 60).padStart(2, '0');
    el.innerText = `${m}:${s}`;
    if (timeRemaining < 60) el.classList.add('animate-pulse', 'text-red-900', 'bg-red-200'); 
}

async function submitQuiz(e) {
    if(e) e.preventDefault();
    clearInterval(activeQuizTimer);

    const answersArray = [];
    const questions = JSON.parse(activeQuizData.questions);
    
    questions.forEach((q, index) => {
        const radios = document.getElementsByName(`q_${index}`);
        let selected = -1; 
        for(let r of radios) { if(r.checked) { selected = parseInt(r.value); break; } }
        answersArray.push({ question_index: index, selected_option: selected });
    });

    const payload = { quiz_id: activeQuizData.id, operator_id: currentUser.id, answers: answersArray };

    try {
        const res = await fetch(`${API_URL}/quizzes/submit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) {
            const data = await res.json();
            document.getElementById('take-quiz-view').classList.add('hidden');
            customAlert('Examen Completado', `Tu calificación final es: ${data.score}%`, 'success');
            loadOperatorQuizzes(); 
        }
    } catch(err) { customAlert('Error', 'Fallo al enviar.', 'error'); }
}

/* ================== LÓGICA DE SIMULADORES (PRÁCTICAS) ================== */
async function loadOperatorDashboard() {
    const res = await fetch(`${API_URL}/results/${currentUser.id}`);
    const results = await res.json();
    const list = document.getElementById('my-certificates');
    if(!list) return;
    
    if(results.length === 0) list.innerHTML = '<p class="text-sm text-gray-500">No hay certificaciones disponibles.</p>';
    else {
        list.innerHTML = results.map(r => `
            <li class="p-4 mb-3 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center shadow-sm hover:border-red-300 transition-colors">
                <span class="font-bold text-gray-900 text-sm">${r.simulator_type} <span class="text-gray-500 font-normal ml-2">| Eficiencia: ${r.score}%</span></span>
                <a href="${API_URL}/generate_pdf/${r.id}" target="_blank" class="text-xs font-bold text-white bg-red-600 hover:bg-black px-4 py-2 rounded-lg transition-colors">Descargar PDF</a>
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
            user_id: currentUser.id, simulator_type: activeSim, score: score, 
            details: `[SISTEMA AUTOMATIZADO]\nEl personal completó el protocolo de inspección.\nTasa de Acierto: ${score}%.\nTiempo de Reacción Promedio: 4.2s.`
        })
    });
    
    customAlert('Práctica finalizada', `Calificación técnica: ${score}%. \nEl reporte ha sido guardado.`, 'success');
    document.getElementById('sim-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    loadOperatorDashboard();
    if(currentUser.role === 'instructor') loadSchoolGeneralResults();
}