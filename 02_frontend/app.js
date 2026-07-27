// ==========================================
// CONFIGURACIÓN GLOBAL Y ESTADO
// ==========================================
const API_URL = 'https://core-work-api.onrender.com';
let tasksCache = [], eventsCache = [], financesCache = [], pocketsCache = [], contactsCache = [];
let deleteTaskId = null, currentMonth = new Date().getMonth(), currentYear = new Date().getFullYear();
let networkInstance = null, selectedContactId = null, balanceVisible = false;
let timerInterval = null, activeTaskId = null, timerSeconds = 0;

document.addEventListener('DOMContentLoaded', async () => {
    initSettings(); loadDynamicOptions(); initTracker();
    await fetchAllData();
});

// SISTEMA UNIVERSAL DE MODALES
function showCustomAlert(title, message, type = 'info') {
    let modal = document.getElementById('global-alert-modal');
    if (!modal) {
        modal = document.createElement('div'); modal.id = 'global-alert-modal';
        modal.className = 'fixed inset-0 bg-slate-900/40 backdrop-blur-sm hidden flex items-center justify-center z-[100]';
        document.body.appendChild(modal);
    }
    let iconHtml = type === 'success' ? `<div class="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>` : (type === 'error' ? `<div class="mx-auto w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></div>` : `<div class="mx-auto w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`);
    modal.innerHTML = `<div class="bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl border border-slate-200 text-center">${iconHtml}<h3 class="text-base font-bold text-slate-900 mb-2">${title}</h3><p class="text-xs text-slate-600 mb-6">${message}</p><button onclick="document.getElementById('global-alert-modal').classList.add('hidden')" class="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors w-full">Entendido</button></div>`;
    modal.classList.remove('hidden');
}

// CARGA DE DATOS TOLERANTE A FALLOS
async function fetchAllData() {
    try {
        const [resTasks, resEvents, resFinances, resPockets, resContacts] = await Promise.all([
            fetch(`${API_URL}/tasks`).then(r => r.ok ? r.json() : []),
            fetch(`${API_URL}/events`).then(r => r.ok ? r.json() : []),
            fetch(`${API_URL}/finances`).then(r => r.ok ? r.json() : []),
            fetch(`${API_URL}/pockets`).then(r => r.ok ? r.json() : []),
            fetch(`${API_URL}/contacts`).then(r => r.ok ? r.json() : [])
        ]);

        tasksCache = Array.isArray(resTasks) ? resTasks.map(t => {
            let meta = { company: getProfiles()[0], subdivision: 'General', date: 'Sin Fecha' };
            try { if (t.description) meta = JSON.parse(t.description); } catch(e) {}
            return { ...t, company: meta.company, subdivision: meta.subdivision || 'General', dueDate: meta.date };
        }) : [];
        eventsCache = Array.isArray(resEvents) ? resEvents : [];
        financesCache = Array.isArray(resFinances) ? resFinances : [];
        pocketsCache = Array.isArray(resPockets) ? resPockets : [];
        contactsCache = Array.isArray(resContacts) ? resContacts : [];

        if (document.getElementById('dash-task-count')) updateDashboard();
        if (document.getElementById('calendar-grid')) renderCalendar();
        if (document.getElementById('col-todo')) renderKanban();
        if (document.getElementById('finance-table-body')) { renderFinances(); renderPockets(); }
        if (document.getElementById('crm-network')) renderTelarana();
        if (document.getElementById('profile-list')) renderSettings();
        if (document.getElementById('tracker-task-select')) populateTrackerSelect();
    } catch (err) {
        showCustomAlert("Conexión Fallida", "El backend en Render no está respondiendo. Verifica los logs de despliegue.", "error");
    }
}

// CONFIGURACIONES LOCALES
function initSettings() {
    if (!localStorage.getItem('core_work_profiles')) localStorage.setItem('core_work_profiles', JSON.stringify(["Inversor Principal", "Proyecto Personal", "Soporte Técnico"]));
    if (!localStorage.getItem('core_work_expenses')) localStorage.setItem('core_work_expenses', JSON.stringify(["Ingreso", "Pasivo Fijo", "Gasto Hormiga", "Suscripciones"]));
    if (!localStorage.getItem('core_work_fixed_items')) localStorage.setItem('core_work_fixed_items', JSON.stringify(["Arriendo Oficina", "Luz / Energía", "Internet", "Software Aiven / Render"]));
    if (!localStorage.getItem('core_work_subdivisions')) localStorage.setItem('core_work_subdivisions', JSON.stringify(["General", "Desarrollo", "Marketing", "Administrativo"]));
}
function getProfiles() { return JSON.parse(localStorage.getItem('core_work_profiles')); }
function getExpenseTypes() { return JSON.parse(localStorage.getItem('core_work_expenses')); }
function getFixedItems() { return JSON.parse(localStorage.getItem('core_work_fixed_items')); }
function getSubdivisions() { return JSON.parse(localStorage.getItem('core_work_subdivisions')); }

function loadDynamicOptions() {
    document.querySelectorAll('.dynamic-profiles').forEach(sel => { sel.innerHTML = ''; getProfiles().forEach(p => sel.innerHTML += `<option value="${p}">${p}</option>`); });
    document.querySelectorAll('.dynamic-expenses').forEach(sel => { sel.innerHTML = ''; getExpenseTypes().forEach(e => sel.innerHTML += `<option value="${e}">${e}</option>`); });
    document.querySelectorAll('.dynamic-subdivisions').forEach(sel => { sel.innerHTML = ''; getSubdivisions().forEach(s => sel.innerHTML += `<option value="${s}">${s}</option>`); });
    const fixedDatalist = document.getElementById('fixed-expenses-list');
    if (fixedDatalist) { fixedDatalist.innerHTML = ''; getFixedItems().forEach(f => fixedDatalist.innerHTML += `<option value="${f}">`); }
}
function renderSettings() {
    const pList = document.getElementById('profile-list'), eList = document.getElementById('expense-list'), fList = document.getElementById('fixed-list'), sList = document.getElementById('subdivision-list');
    if(!pList) return;
    pList.innerHTML = ''; eList.innerHTML = ''; fList.innerHTML = ''; sList.innerHTML = '';
    getProfiles().forEach((p, idx) => pList.innerHTML += `<li class="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100"><span class="font-medium text-slate-800">${p}</span><button onclick="deleteSetting('profiles', ${idx})" class="text-red-500 hover:text-red-700">Eliminar</button></li>`);
    getExpenseTypes().forEach((e, idx) => eList.innerHTML += `<li class="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100"><span class="font-medium text-slate-800">${e}</span><button onclick="deleteSetting('expenses', ${idx})" class="text-red-500 hover:text-red-700">Eliminar</button></li>`);
    getFixedItems().forEach((f, idx) => fList.innerHTML += `<li class="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100"><span class="font-medium text-slate-800">${f}</span><button onclick="deleteSetting('fixed', ${idx})" class="text-red-500 hover:text-red-700">Eliminar</button></li>`);
    getSubdivisions().forEach((s, idx) => sList.innerHTML += `<li class="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100"><span class="font-medium text-slate-800">${s}</span><button onclick="deleteSetting('subdivisions', ${idx})" class="text-red-500 hover:text-red-700">Eliminar</button></li>`);
}
function addProfile() { const val = document.getElementById('new-profile').value; if(val) { const d = getProfiles(); d.push(val); localStorage.setItem('core_work_profiles', JSON.stringify(d)); document.getElementById('new-profile').value=''; renderSettings(); loadDynamicOptions(); } }
function addExpenseType() { const val = document.getElementById('new-expense').value; if(val) { const d = getExpenseTypes(); d.push(val); localStorage.setItem('core_work_expenses', JSON.stringify(d)); document.getElementById('new-expense').value=''; renderSettings(); loadDynamicOptions(); } }
function addFixedItem() { const val = document.getElementById('new-fixed').value; if(val) { const d = getFixedItems(); d.push(val); localStorage.setItem('core_work_fixed_items', JSON.stringify(d)); document.getElementById('new-fixed').value=''; renderSettings(); loadDynamicOptions(); } }
function addSubdivision() { const val = document.getElementById('new-subdivision').value; if(val) { const d = getSubdivisions(); d.push(val); localStorage.setItem('core_work_subdivisions', JSON.stringify(d)); document.getElementById('new-subdivision').value=''; renderSettings(); loadDynamicOptions(); } }
function deleteSetting(type, idx) {
    let key = type === 'profiles' ? 'core_work_profiles' : (type === 'expenses' ? 'core_work_expenses' : (type === 'fixed' ? 'core_work_fixed_items' : 'core_work_subdivisions'));
    const d = JSON.parse(localStorage.getItem(key)); d.splice(idx, 1); localStorage.setItem(key, JSON.stringify(d)); renderSettings(); loadDynamicOptions();
}

async function testTelegramAlert() {
    try {
        const response = await fetch(`${API_URL}/test-telegram`, { method: 'POST' });
        if(response.ok) showCustomAlert("Telegram Ok", "Mensaje enviado exitosamente.", "success");
        else showCustomAlert("Telegram Falló", "Verifica el token y el ID en Render.", "error");
    } catch (e) { showCustomAlert("Error de Conexión", "El backend no responde.", "error"); }
}

// TAREAS & KANBAN
function renderKanban() {
    const cols = { 'todo': [], 'in_progress': [], 'review': [], 'done': [] };
    tasksCache.forEach(t => { let st = t.status || 'todo'; if (t.completed) st = 'done'; if(cols[st]) cols[st].push(t); });
    for (let key in cols) {
        const colEl = document.getElementById(`col-${key}`);
        if(!colEl) continue;
        colEl.innerHTML = '';
        cols[key].forEach(t => {
            let formatTime = t.time_spent > 0 ? `<span class="text-[9px] bg-indigo-100 text-indigo-700 px-1 rounded ml-1">⏱ ${Math.floor(t.time_spent/60)}m</span>` : '';
            colEl.innerHTML += `<div id="ktask-${t.id}" draggable="true" ondragstart="drag(event)" class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm cursor-move hover:border-slate-300"><div class="text-[10px] font-bold text-slate-400 uppercase mb-1">${t.company} ${formatTime}</div><p class="text-xs font-semibold text-slate-800 leading-tight">${t.title}</p></div>`;
        });
    }
}
function allowDrop(ev) { ev.preventDefault(); }
function drag(ev) { ev.dataTransfer.setData("taskId", ev.target.id.replace('ktask-', '')); }
async function drop(ev) {
    ev.preventDefault(); const taskId = ev.dataTransfer.getData("taskId"); let targetCol = ev.target.closest('.kanban-col');
    if (!targetCol) return;
    const newStatus = targetCol.id.replace('col-', ''); const isCompleted = newStatus === 'done';
    targetCol.appendChild(document.getElementById(`ktask-${taskId}`));
    await fetch(`${API_URL}/tasks/${taskId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus, completed: isCompleted }) });
    fetchAllData();
}

async function saveTask(event) {
    event.preventDefault();
    const payload = { title: document.getElementById('task-title').value, description: JSON.stringify({ company: document.getElementById('task-company').value, subdivision: document.getElementById('task-subdivision').value, date: document.getElementById('task-date').value }), is_ops: false };
    try {
        await fetch(`${API_URL}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        closeTaskModal(); document.getElementById('task-form').reset(); showCustomAlert("Guardado", "La tarea se registró correctamente.", "success"); fetchAllData();
    } catch(e) { showCustomAlert("Error", "No se pudo guardar la tarea en la nube.", "error"); }
}
async function confirmDeleteTask() {
    if (!deleteTaskId) return;
    await fetch(`${API_URL}/tasks/${deleteTaskId}`, { method: 'DELETE' });
    closeDeleteModal(); showCustomAlert("Eliminado", "Tarea removida.", "success"); fetchAllData();
}
function openTaskModal() { document.getElementById('task-modal').classList.remove('hidden'); }
function closeTaskModal() { document.getElementById('task-modal').classList.add('hidden'); }
function openDeleteModal(id) { deleteTaskId = id; document.getElementById('delete-modal').classList.remove('hidden'); }
function closeDeleteModal() { deleteTaskId = null; document.getElementById('delete-modal').classList.add('hidden'); }

// TIME TRACKER
function initTracker() {
    if (!document.getElementById('tracker-display')) return;
    activeTaskId = localStorage.getItem('tracker_task_id'); const isRunning = localStorage.getItem('tracker_running') === 'true';
    if (isRunning && activeTaskId) {
        timerSeconds = Math.floor((Date.now() - parseInt(localStorage.getItem('tracker_start_time'))) / 1000);
        document.getElementById('tracker-task-select').value = activeTaskId;
        document.getElementById('tracker-btn').innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>`;
        document.getElementById('tracker-btn').classList.replace('bg-slate-900', 'bg-red-600');
        timerInterval = setInterval(tickTimer, 1000);
    }
}
function populateTrackerSelect() {
    const sel = document.getElementById('tracker-task-select'); if (!sel) return;
    const currentVal = sel.value || activeTaskId; sel.innerHTML = '<option value="">Seleccionar tarea...</option>';
    tasksCache.filter(t => !t.completed).forEach(t => { sel.innerHTML += `<option value="${t.id}">${t.title.substring(0,20)}...</option>`; });
    if (currentVal) sel.value = currentVal;
}
function tickTimer() {
    timerSeconds++; document.getElementById('tracker-display').innerText = `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`;
}
async function toggleTimer() {
    const btn = document.getElementById('tracker-btn'), sel = document.getElementById('tracker-task-select');
    if (timerInterval) {
        clearInterval(timerInterval); timerInterval = null; localStorage.setItem('tracker_running', 'false');
        btn.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z"></path></svg>`; btn.classList.replace('bg-red-600', 'bg-slate-900');
        if (activeTaskId) {
            const t = tasksCache.find(x => x.id == activeTaskId);
            if (t) {
                await fetch(`${API_URL}/tasks/${activeTaskId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ time_spent: (t.time_spent || 0) + timerSeconds }) });
                fetchAllData(); 
            }
        }
        timerSeconds = 0; document.getElementById('tracker-display').innerText = "00:00"; activeTaskId = null; sel.disabled = false;
    } else {
        if (!sel.value) { showCustomAlert("Atención", "Selecciona una tarea.", "info"); return; }
        activeTaskId = sel.value; sel.disabled = true; timerSeconds = 0;
        localStorage.setItem('tracker_task_id', activeTaskId); localStorage.setItem('tracker_start_time', Date.now()); localStorage.setItem('tracker_running', 'true');
        btn.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>`; btn.classList.replace('bg-slate-900', 'bg-red-600');
        timerInterval = setInterval(tickTimer, 1000);
    }
}

// DASHBOARD
function toggleBalance() { balanceVisible = !balanceVisible; updateBalanceDisplay(); }
function updateBalanceDisplay() {
    const el = document.getElementById('dash-income-total'), btn = document.getElementById('eye-icon-btn');
    if (!el || !btn) return;
    if (balanceVisible) { el.innerText = `$${el.getAttribute('data-value') || "0.00"}`; btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>`; } 
    else { el.innerText = '••••••'; btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>`; }
}
function updateDashboard() {
    const activeTasks = tasksCache.filter(t => !t.completed);
    if(document.getElementById('dash-task-count')) document.getElementById('dash-task-count').innerText = activeTasks.length;
    if(document.getElementById('dash-event-count')) document.getElementById('dash-event-count').innerText = eventsCache.length;

    const load = activeTasks.length + eventsCache.length;
    let workload = "Baja", wColor = "text-emerald-600";
    if(load > 5) { workload = "Media"; wColor = "text-indigo-600"; }
    if(load > 12) { workload = "Alta"; wColor = "text-red-600"; }
    
    if (document.getElementById('dash-workload-text')) { document.getElementById('dash-workload-text').innerText = workload; document.getElementById('dash-workload-text').className = `text-2xl font-bold mt-1 ${wColor}`; }
    updateBar('prog-today', Math.min(Math.round((load / 5) * 100), 100)); updateBar('prog-week', Math.min(Math.round((load / 15) * 100), 100)); updateBar('prog-month', Math.min(Math.round((load / 40) * 100), 100));

    const grid = document.getElementById('critical-tasks-grid');
    if (grid) {
        grid.innerHTML = '';
        getProfiles().slice(0,3).forEach(comp => {
            const compTasks = activeTasks.filter(t => t.company === comp).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
            let html = `<div class="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col max-h-96 overflow-y-auto custom-scroll"><h4 class="font-bold text-slate-800 text-sm mb-3 border-b border-slate-200 pb-2 sticky top-0 bg-slate-50 z-10">${comp}</h4>`;
            if (compTasks.length === 0) html += `<p class="text-xs text-slate-500">Sin tareas.</p>`;
            else {
                const tasksBySub = {}; compTasks.forEach(t => { const sub = t.subdivision || 'General'; if (!tasksBySub[sub]) tasksBySub[sub] = []; tasksBySub[sub].push(t); });
                for (const sub in tasksBySub) {
                    html += `<div class="mb-4 last:mb-0"><h5 class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center"><span class="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>${sub}</h5><ul class="space-y-2">`;
                    tasksBySub[sub].forEach(t => { const dateColor = new Date(t.dueDate) < new Date() ? 'text-red-600 font-bold' : 'text-slate-500'; html += `<li class="flex items-start justify-between text-xs bg-white p-2.5 rounded border border-slate-200 shadow-sm cursor-pointer hover:border-slate-400 transition" onclick="openDeleteModal(${t.id})"><span class="font-medium text-slate-700 pr-2 leading-relaxed">${t.title}</span><span class="${dateColor} whitespace-nowrap mt-0.5">${t.dueDate}</span></li>`; });
                    html += `</ul></div>`;
                }
            }
            grid.innerHTML += html + `</div>`;
        });
    }

    const evtContainer = document.getElementById('dash-upcoming-events');
    if (evtContainer) {
        evtContainer.innerHTML = ''; const upcoming = eventsCache.sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);
        if(upcoming.length === 0) evtContainer.innerHTML = '<p class="text-xs text-slate-500">No hay eventos próximos.</p>';
        upcoming.forEach(e => { evtContainer.innerHTML += `<div class="flex items-center text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-100"><div class="bg-slate-900 text-white font-bold px-2 py-1 rounded mr-3 text-center min-w-[45px]">${e.date.split('-')[2]}<br><span class="text-[9px] font-normal">DIA</span></div><div class="truncate"><p class="font-bold text-slate-800 truncate">${e.name}</p><p class="text-slate-500 truncate">${e.time} | ${e.company}</p></div></div>`; });
    }

    let inc = 0, exp = 0; financesCache.forEach(f => { if (f.type.includes('Ingreso')) inc += parseFloat(f.amount); else exp += parseFloat(f.amount); });
    const di = document.getElementById('dash-income-total'); if(di) { di.setAttribute('data-value', (inc - exp).toFixed(2)); updateBalanceDisplay(); }
}
function updateBar(idPrefix, value) { const t = document.getElementById(`${idPrefix}-text`), b = document.getElementById(`${idPrefix}-bar`); if (t && b) { t.innerText = `${value}%`; b.style.width = `${value}%`; } }

// AGENDA
function renderCalendar() {
    const grid = document.getElementById('calendar-grid'), title = document.getElementById('calendar-month-year');
    if (!grid || !title) return;
    const firstDay = new Date(currentYear, currentMonth, 1).getDay(), daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    title.innerText = `${monthNames[currentMonth]} ${currentYear}`; grid.innerHTML = '';
    for (let i = 0; i < firstDay; i++) grid.innerHTML += `<div class="bg-white calendar-cell p-2 text-slate-300"></div>`;
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        let eventsHtml = eventsCache.filter(e => e.date === dateStr).map(e => `<div onclick="openActionModal(${e.id})" class="text-[10px] bg-slate-800 text-white p-1 mb-1 rounded truncate shadow-sm cursor-pointer hover:opacity-80">${e.time} ${e.name}</div>`).join('');
        let tasksHtml = tasksCache.filter(t => t.dueDate === dateStr && !t.completed).map(t => `<div class="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 p-1 mb-1 rounded truncate shadow-sm flex items-center cursor-pointer hover:bg-rose-100 transition" onclick="openDeleteModal(${t.id})" title="${t.title}"><svg class="w-3 h-3 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>${t.title}</div>`).join('');
        const isToday = new Date().toDateString() === new Date(currentYear, currentMonth, i).toDateString();
        grid.innerHTML += `<div class="bg-white calendar-cell p-2 border-t-2 hover:bg-slate-50 transition ${isToday ? 'border-t-slate-900' : 'border-t-transparent'}"><div class="text-xs mb-2 ${isToday ? 'bg-slate-900 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold' : 'text-slate-700 font-medium'}">${i}</div><div class="space-y-1">${eventsHtml}${tasksHtml}</div></div>`;
    }
}
function changeMonth(step) { currentMonth += step; if (currentMonth < 0) { currentMonth = 11; currentYear--; } if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar(); }
async function saveEvent(e) {
    e.preventDefault();
    const payload = { name: document.getElementById('evt-name').value, date: document.getElementById('evt-date').value, time: document.getElementById('evt-time').value, company: document.getElementById('evt-company').value, location: document.getElementById('evt-location').value };
    try {
        await fetch(`${API_URL}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        closeEventModal(); document.getElementById('event-form').reset(); showCustomAlert("Agendado", "Evento añadido al calendario.", "success"); fetchAllData();
    } catch(err) { showCustomAlert("Error", "No se guardó el evento.", "error"); }
}
function openEventModal() { document.getElementById('event-modal').classList.remove('hidden'); }
function closeEventModal() { document.getElementById('event-modal').classList.add('hidden'); }
function openActionModal(id) {
    selectedContactId = id; const evt = eventsCache.find(e => e.id === id);
    if(evt) { document.getElementById('action-evt-name').innerText = evt.name; document.getElementById('action-evt-desc').innerText = `${evt.date} | ${evt.time} \n ${evt.company} - ${evt.location}`; document.getElementById('event-action-modal').classList.remove('hidden'); }
}
function closeActionModal() { selectedContactId = null; document.getElementById('event-action-modal').classList.add('hidden'); }
async function deleteSelectedEvent() { await fetch(`${API_URL}/events/${selectedContactId}`, { method: 'DELETE' }); closeActionModal(); showCustomAlert("Eliminado", "Evento borrado.", "success"); fetchAllData(); }

// FINANZAS
function verifyFinances(e) {
    e.preventDefault();
    if (document.getElementById('fin-password').value === '12345') {
        const overlay = document.getElementById('auth-overlay'); overlay.style.opacity = '0'; setTimeout(() => overlay.classList.add('hidden'), 300); document.getElementById('fin-error').classList.add('hidden');
    } else { document.getElementById('fin-error').classList.remove('hidden'); document.getElementById('fin-password').value = ''; }
}
function filterFinancesByTime(finances, filter) {
    if (filter === 'all') return finances;
    const now = new Date(); const currentWeekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1)); currentWeekStart.setHours(0,0,0,0);
    return finances.filter(f => {
        const d = new Date(f.date);
        if (filter === 'year') return d.getFullYear() === new Date().getFullYear();
        if (filter === 'month') return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
        if (filter === 'week') return d >= currentWeekStart && d.getFullYear() === new Date().getFullYear();
        return true;
    });
}
function renderFinances() {
    const tbody = document.getElementById('finance-table-body'), filter = document.getElementById('fin-time-filter');
    if (!tbody || !filter) return;
    const finances = filterFinancesByTime(financesCache, filter.value);
    tbody.innerHTML = ''; let inc = 0, pas = 0, horm = 0;
    if (finances.length === 0) document.getElementById('empty-finance-msg').classList.remove('hidden');
    else {
        document.getElementById('empty-finance-msg').classList.add('hidden');
        finances.forEach((item) => {
            const amt = parseFloat(item.amount);
            if (item.type.includes('Ingreso')) inc += amt; else if (item.type.includes('Hormiga')) horm += amt; else pas += amt;
            tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b border-slate-50"><td class="px-6 py-3.5">${item.date}</td><td class="px-6 py-3.5 font-medium">${item.concept}</td><td class="px-6 py-3.5"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">${item.type}</span></td><td class="px-6 py-3.5">${item.entity}</td><td class="px-6 py-3.5 text-right font-bold">$${amt.toFixed(2)}</td><td class="px-6 py-3.5 text-center"><button onclick="deleteFinance(${item.id})" class="text-red-500 text-xs hover:underline">Borrar</button></td></tr>`;
        });
    }
    document.getElementById('fin-total-ingresos').innerText = `$${inc.toFixed(2)}`; document.getElementById('fin-total-pasivos').innerText = `$${pas.toFixed(2)}`; document.getElementById('fin-total-hormiga').innerText = `$${horm.toFixed(2)}`; document.getElementById('fin-balance-neto').innerText = `$${(inc - (pas + horm)).toFixed(2)}`;
    const lbl = { 'month': 'Mes Actual', 'week': 'Semana Actual', 'year': 'Año Actual', 'all': 'Todo el Historial' }; document.getElementById('fin-period-label').innerText = lbl[filter.value];
}
async function saveFinance(e) {
    e.preventDefault();
    const payload = { concept: document.getElementById('fin-concept').value, type: document.getElementById('fin-type').value, amount: parseFloat(document.getElementById('fin-amount').value), entity: document.getElementById('fin-entity').value, date: document.getElementById('fin-date').value };
    try {
        await fetch(`${API_URL}/finances`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        closeFinanceModal(); document.getElementById('finance-form').reset(); showCustomAlert("Registrado", "Movimiento financiero agregado.", "success"); fetchAllData();
    } catch(err) { showCustomAlert("Error", "No se pudo registrar.", "error"); }
}
async function deleteFinance(id) { await fetch(`${API_URL}/finances/${id}`, { method: 'DELETE' }); showCustomAlert("Eliminado", "Registro borrado de la nube.", "success"); fetchAllData(); }
function openFinanceModal() { document.getElementById('finance-modal').classList.remove('hidden'); }
function closeFinanceModal() { document.getElementById('finance-modal').classList.add('hidden'); }

// INVOICING
function openInvoiceModal() { document.getElementById('invoice-modal').classList.remove('hidden'); }
function closeInvoiceModal() { document.getElementById('invoice-modal').classList.add('hidden'); }
function generateInvoicePDF(e) {
    e.preventDefault();
    const client = document.getElementById('inv-client').value, concept = document.getElementById('inv-concept').value, amount = document.getElementById('inv-amount').value, date = new Date().toLocaleDateString('es-ES'), invoiceNumber = "INV-" + Math.floor(Math.random() * 10000);
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("CORE-WORK", 14, 22); doc.setFontSize(10); doc.setTextColor(100); doc.text("Servicios Ops & Consultoría SaaS", 14, 28);
    doc.setFontSize(16); doc.setTextColor(0); doc.text("FACTURA", 150, 22); doc.setFontSize(10); doc.text(`Número: ${invoiceNumber}`, 150, 28); doc.text(`Fecha: ${date}`, 150, 33);
    doc.setFontSize(12); doc.text(`Facturar a:`, 14, 45); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(client, 14, 52);
    doc.autoTable({ startY: 65, head: [['Descripción del Servicio', 'Total']], body: [ [concept, `$${parseFloat(amount).toFixed(2)}`] ], theme: 'striped', headStyles: { fillColor: [15, 23, 42] } });
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`Total a Pagar: $${parseFloat(amount).toFixed(2)}`, 140, (doc.lastAutoTable.finalY || 65) + 10);
    doc.save(`${invoiceNumber}_${client}.pdf`); closeInvoiceModal(); showCustomAlert("Factura Generada", "El PDF ha sido descargado en tu equipo.", "success");
}

// BOLSILLOS
function renderPockets() {
    const grid = document.getElementById('pockets-grid'); if (!grid) return; grid.innerHTML = '';
    if(pocketsCache.length === 0) { grid.innerHTML = '<p class="text-xs text-slate-500 col-span-3">No hay bolsillos de ahorro creados.</p>'; return; }
    pocketsCache.forEach(p => {
        const prog = Math.min(Math.round((p.current / p.target) * 100), 100);
        grid.innerHTML += `<div class="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between"><div class="flex justify-between items-start mb-2"><h4 class="font-bold text-slate-900 text-sm truncate pr-2">${p.name}</h4><span class="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded flex-shrink-0">${p.bank} - **${p.account}</span></div><div class="mb-3"><div class="flex justify-between text-xs mb-1"><span class="text-slate-500 font-medium">$${parseFloat(p.current).toFixed(2)}</span><span class="text-slate-800 font-bold">$${parseFloat(p.target).toFixed(2)}</span></div><div class="w-full bg-slate-200 rounded-full h-1.5"><div class="bg-emerald-500 h-1.5 rounded-full" style="width: ${prog}%"></div></div></div><div class="flex justify-between items-center border-t border-slate-200 pt-3"><button onclick="openPocketTxModal(${p.id})" class="text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 px-2 py-1 rounded">Transacción</button><button onclick="deletePocket(${p.id})" class="text-red-500 hover:text-red-700 text-xs font-medium">Borrar</button></div></div>`;
    });
}
async function savePocket(e) {
    e.preventDefault();
    const payload = { name: document.getElementById('pkt-name').value, bank: document.getElementById('pkt-bank').value, account: document.getElementById('pkt-account').value, target: parseFloat(document.getElementById('pkt-target').value), current: parseFloat(document.getElementById('pkt-current').value) };
    try { await fetch(`${API_URL}/pockets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); closePocketModal(); document.getElementById('pocket-form').reset(); showCustomAlert("Bolsillo Creado", "Ahorro registrado.", "success"); fetchAllData(); } 
    catch(err) { showCustomAlert("Error", "Falló la creación.", "error"); }
}
async function deletePocket(id) { await fetch(`${API_URL}/pockets/${id}`, { method: 'DELETE' }); showCustomAlert("Bolsillo Borrado", "Eliminado correctamente.", "success"); fetchAllData(); }
function openPocketModal() { document.getElementById('pocket-modal').classList.remove('hidden'); }
function closePocketModal() { document.getElementById('pocket-modal').classList.add('hidden'); }
function openPocketTxModal(id) { const p = pocketsCache.find(x => x.id === id); document.getElementById('tx-pocket-id').value = id; document.getElementById('tx-pocket-name').innerText = p.name; document.getElementById('pocket-tx-modal').classList.remove('hidden'); setTxType('add'); }
function closePocketTxModal() { document.getElementById('pocket-tx-modal').classList.add('hidden'); }
function setTxType(type) {
    document.getElementById('tx-type').value = type; const bAdd = document.getElementById('btn-tx-add'); const bSub = document.getElementById('btn-tx-sub');
    if(type === 'add') { bAdd.className = "py-1.5 border-2 border-emerald-500 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg transition-colors"; bSub.className = "py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"; } 
    else { bSub.className = "py-1.5 border-2 border-rose-500 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg transition-colors"; bAdd.className = "py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"; }
}
async function executePocketTx(e) {
    e.preventDefault(); const id = parseInt(document.getElementById('tx-pocket-id').value), type = document.getElementById('tx-type').value, amount = parseFloat(document.getElementById('tx-amount').value), pkt = pocketsCache.find(x => x.id === id);
    let newCurrent = pkt.current;
    if (type === 'add') newCurrent += amount; else { if(amount > pkt.current) { showCustomAlert("Fondos Insuficientes", "Supera el saldo actual.", "error"); return; } newCurrent -= amount; }
    try { await fetch(`${API_URL}/pockets/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: newCurrent }) }); closePocketTxModal(); document.getElementById('pocket-tx-form').reset(); showCustomAlert("Transacción Exitosa", "Saldo actualizado.", "success"); fetchAllData(); }
    catch(err) { showCustomAlert("Error", "No se guardó el saldo.", "error"); }
}

// TELARAÑA CRM
function renderTelarana() {
    const container = document.getElementById('crm-network'), tbody = document.getElementById('contacts-table-body');
    if (!container || !tbody) return;
    tbody.innerHTML = '';
    const nodes = [{ id: 'yo_1', label: 'YO', shape: 'circle', color: { background: '#0F172A', border: '#0F172A' }, font: { color: 'white', face: 'Inter' } }], edges = [], today = new Date();

    contactsCache.forEach(c => {
        const lastDate = new Date(c.lastContact), diffDays = Math.ceil(Math.abs(today - lastDate) / (1000 * 60 * 60 * 24));
        let status = 'Al día', bColor = '#10B981'; 
        if(diffDays >= 3 && diffDays < 5) { status = 'Requiere Seguimiento'; bColor = '#F59E0B'; } 
        if(diffDays >= 5) { status = 'Alerta Inactividad'; bColor = '#EF4444'; } 

        tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b border-slate-50"><td class="px-6 py-3.5 font-medium">${c.name}</td><td class="px-6 py-3.5">${c.type}</td><td class="px-6 py-3.5">Hace ${diffDays} días (${c.lastContact})</td><td class="px-6 py-3.5 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold text-white" style="background-color: ${bColor}">${status}</span></td><td class="px-6 py-3.5 text-right"><button onclick="openInteractionModal(${c.id}, '${c.name}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-1 rounded border border-slate-300">Programar Acción</button><button onclick="deleteContact(${c.id})" class="ml-2 text-xs text-red-500 hover:underline">Borrar</button></td></tr>`;
        nodes.push({ id: c.id, label: c.name, shape: 'dot', size: 14, color: { background: bColor, border: '#0F172A' }, font: { color: '#334155', face: 'Inter', size: 11 } });
        edges.push({ from: 'yo_1', to: c.id, color: { color: '#CBD5E1' } });
    });
    const options = { physics: { stabilization: false, barnesHut: { gravitationalConstant: -2000 } } };
    if (networkInstance) networkInstance.destroy();
    networkInstance = new vis.Network(container, { nodes, edges }, options);
}
async function saveContact(e) {
    e.preventDefault(); const payload = { name: document.getElementById('contact-name').value, type: document.getElementById('contact-type').value, lastContact: document.getElementById('contact-last-date').value };
    try { await fetch(`${API_URL}/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); closeContactModal(); document.getElementById('contact-form').reset(); showCustomAlert("Contacto Añadido", "El contacto se agregó a tu red neuronal.", "success"); fetchAllData(); }
    catch(err) { showCustomAlert("Error", "Fallo al guardar.", "error"); }
}
async function saveInteraction(e) {
    e.preventDefault(); const contactId = document.getElementById('interaction-contact-id').value, dateInput = document.getElementById('interaction-date').value, contact = contactsCache.find(c => c.id == contactId);
    if (contact) {
        try {
            await fetch(`${API_URL}/contacts/${contactId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastContact: dateInput }) });
            await fetch(`${API_URL}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Seguimiento: ${contact.name}`, date: dateInput, time: document.getElementById('interaction-type').value, company: contact.type, location: document.getElementById('interaction-notes').value }) });
            closeInteractionModal(); document.getElementById('interaction-form').reset(); showCustomAlert("Interacción Programada", "El seguimiento se ha actualizado en el CRM y en la Agenda.", "success"); fetchAllData();
        } catch (err) { showCustomAlert("Error", "Fallo al sincronizar interacción.", "error"); }
    }
}
async function deleteContact(id) { await fetch(`${API_URL}/contacts/${id}`, { method: 'DELETE' }); showCustomAlert("Contacto Borrado", "El contacto ha sido eliminado de la red.", "success"); fetchAllData(); }
function openContactModal() { document.getElementById('contact-modal').classList.remove('hidden'); }
function closeContactModal() { document.getElementById('contact-modal').classList.add('hidden'); }
function openInteractionModal(id, name) { document.getElementById('interaction-contact-id').value = id; document.getElementById('interaction-contact-name').innerText = name; document.getElementById('interaction-modal').classList.remove('hidden'); }
function closeInteractionModal() { document.getElementById('interaction-modal').classList.add('hidden'); }