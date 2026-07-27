// ==========================================
// CONFIGURACIÓN GLOBAL Y ESTADO
// ==========================================
const API_URL = 'https://core-work-api.onrender.com';
let tasksCache = [];
let deleteTaskId = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let networkInstance = null;
let selectedContactId = null;

// Inicializador Automático según la página
document.addEventListener('DOMContentLoaded', () => {
    initSettings(); // Cargar configuraciones globales a localStorage si no existen
    loadDynamicOptions(); // Llenar selects dinámicamente

    if (document.getElementById('dash-task-count')) fetchTasks();
    if (document.getElementById('calendar-grid')) renderCalendar();
    if (document.getElementById('finance-table-body')) renderFinances();
    if (document.getElementById('crm-network')) renderTelarana();
    if (document.getElementById('profile-list')) renderSettings();
});

// ==========================================
// MÓDULO CONFIGURACIONES (ENTIDADES DINÁMICAS)
// ==========================================
function initSettings() {
    if (!localStorage.getItem('core_work_profiles')) {
        localStorage.setItem('core_work_profiles', JSON.stringify(["Inversor Principal", "Proyecto Personal", "Soporte Técnico"]));
    }
    if (!localStorage.getItem('core_work_expenses')) {
        localStorage.setItem('core_work_expenses', JSON.stringify(["Ingreso", "Pasivo Fijo", "Gasto Hormiga", "Suscripciones"]));
    }
}

function getProfiles() { return JSON.parse(localStorage.getItem('core_work_profiles')); }
function getExpenseTypes() { return JSON.parse(localStorage.getItem('core_work_expenses')); }

function loadDynamicOptions() {
    const profileSelects = document.querySelectorAll('.dynamic-profiles');
    const expenseSelects = document.querySelectorAll('.dynamic-expenses');
    
    profileSelects.forEach(sel => {
        sel.innerHTML = '';
        getProfiles().forEach(p => sel.innerHTML += `<option value="${p}">${p}</option>`);
    });

    expenseSelects.forEach(sel => {
        sel.innerHTML = '';
        getExpenseTypes().forEach(e => sel.innerHTML += `<option value="${e}">${e}</option>`);
    });
}

function renderSettings() {
    const pList = document.getElementById('profile-list');
    const eList = document.getElementById('expense-list');
    
    pList.innerHTML = ''; eList.innerHTML = '';
    
    getProfiles().forEach((p, idx) => {
        pList.innerHTML += `<li class="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100">
            <span class="font-medium text-slate-800">${p}</span>
            <button onclick="deleteProfile(${idx})" class="text-red-500 hover:text-red-700">Eliminar</button>
        </li>`;
    });

    getExpenseTypes().forEach((e, idx) => {
        eList.innerHTML += `<li class="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100">
            <span class="font-medium text-slate-800">${e}</span>
            <button onclick="deleteExpenseType(${idx})" class="text-red-500 hover:text-red-700">Eliminar</button>
        </li>`;
    });
}

function addProfile() {
    const val = document.getElementById('new-profile').value;
    if(!val) return;
    const p = getProfiles(); p.push(val);
    localStorage.setItem('core_work_profiles', JSON.stringify(p));
    document.getElementById('new-profile').value = '';
    renderSettings();
}

function deleteProfile(idx) {
    const p = getProfiles(); p.splice(idx, 1);
    localStorage.setItem('core_work_profiles', JSON.stringify(p));
    renderSettings();
}

function addExpenseType() {
    const val = document.getElementById('new-expense').value;
    if(!val) return;
    const e = getExpenseTypes(); e.push(val);
    localStorage.setItem('core_work_expenses', JSON.stringify(e));
    document.getElementById('new-expense').value = '';
    renderSettings();
}

function deleteExpenseType(idx) {
    const e = getExpenseTypes(); e.splice(idx, 1);
    localStorage.setItem('core_work_expenses', JSON.stringify(e));
    renderSettings();
}


// ==========================================
// MÓDULO DE TAREAS (DASHBOARD & FASTAPI)
// ==========================================
async function fetchTasks() {
    try {
        const response = await fetch(`${API_URL}/tasks`);
        const rawTasks = await response.json();
        
        tasksCache = rawTasks.map(t => {
            let meta = { company: getProfiles()[0], date: 'Sin Fecha' };
            try { if (t.description) meta = JSON.parse(t.description); } catch(e) {}
            return { ...t, company: meta.company, dueDate: meta.date };
        });
        updateDashboard();
    } catch (error) { console.error("Error API Tareas:", error); }
}

function updateDashboard() {
    const activeTasks = tasksCache.filter(t => !t.completed);
    document.getElementById('dash-task-count').innerText = activeTasks.length;
    
    const events = getEventsLocal();
    document.getElementById('dash-event-count').innerText = events.length;

    const load = activeTasks.length + events.length;
    let workload = "Baja"; let wColor = "text-emerald-600";
    if(load > 5) { workload = "Media"; wColor = "text-indigo-600"; }
    if(load > 12) { workload = "Alta"; wColor = "text-red-600"; }
    
    const wt = document.getElementById('dash-workload-text');
    if (wt) { wt.innerText = workload; wt.className = `text-2xl font-bold mt-1 ${wColor}`; }

    updateBar('prog-today', Math.min(Math.round((load / 5) * 100), 100));
    updateBar('prog-week', Math.min(Math.round((load / 15) * 100), 100));
    updateBar('prog-month', Math.min(Math.round((load / 40) * 100), 100));

    const grid = document.getElementById('critical-tasks-grid');
    if (grid) {
        grid.innerHTML = '';
        getProfiles().slice(0,3).forEach(comp => {
            const compTasks = activeTasks.filter(t => t.company === comp).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 4);
            let html = `<div class="bg-slate-50 border border-slate-200 rounded-xl p-4"><h4 class="font-bold text-slate-800 text-sm mb-3 border-b border-slate-200 pb-2 truncate">${comp}</h4><ul class="space-y-2">`;
            
            if (compTasks.length === 0) html += `<li class="text-xs text-slate-500">Sin tareas pendientes.</li>`;
            else {
                compTasks.forEach(t => {
                    const dateColor = new Date(t.dueDate) < new Date() ? 'text-red-600 font-bold' : 'text-slate-500';
                    html += `<li class="flex items-start justify-between text-xs bg-white p-2 rounded border border-slate-100 shadow-sm cursor-pointer hover:border-slate-300 transition" onclick="openDeleteModal(${t.id})">
                                <span class="font-medium text-slate-700 pr-2 truncate">${t.title}</span><span class="${dateColor} whitespace-nowrap">${t.dueDate}</span>
                            </li>`;
                });
            }
            grid.innerHTML += html + `</ul></div>`;
        });
    }

    const evtContainer = document.getElementById('dash-upcoming-events');
    if (evtContainer) {
        evtContainer.innerHTML = '';
        const upcoming = events.sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);
        if(upcoming.length === 0) evtContainer.innerHTML = '<p class="text-xs text-slate-500">No hay eventos próximos.</p>';
        
        upcoming.forEach(e => {
            evtContainer.innerHTML += `
                <div class="flex items-center text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div class="bg-slate-900 text-white font-bold px-2 py-1 rounded mr-3 text-center min-w-[45px]">${e.date.split('-')[2]}<br><span class="text-[9px] font-normal">DIA</span></div>
                    <div class="truncate"><p class="font-bold text-slate-800 truncate">${e.name}</p><p class="text-slate-500 truncate">${e.time} | ${e.company}</p></div>
                </div>`;
        });
    }
}

function updateBar(idPrefix, value) {
    const t = document.getElementById(`${idPrefix}-text`);
    const b = document.getElementById(`${idPrefix}-bar`);
    if (t && b) { t.innerText = `${value}%`; b.style.width = `${value}%`; }
}

async function saveTask(event) {
    event.preventDefault();
    const payload = { 
        title: document.getElementById('task-title').value, 
        description: JSON.stringify({ company: document.getElementById('task-company').value, date: document.getElementById('task-date').value }), 
        is_ops: false 
    };
    await fetch(`${API_URL}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    closeTaskModal(); fetchTasks();
}

async function confirmDeleteTask() {
    if (!deleteTaskId) return;
    await fetch(`${API_URL}/tasks/${deleteTaskId}`, { method: 'DELETE' });
    closeDeleteModal(); fetchTasks();
}

function openTaskModal() { document.getElementById('task-modal').classList.remove('hidden'); }
function closeTaskModal() { document.getElementById('task-modal').classList.add('hidden'); }
function openDeleteModal(id) { deleteTaskId = id; document.getElementById('delete-modal').classList.remove('hidden'); }
function closeDeleteModal() { deleteTaskId = null; document.getElementById('delete-modal').classList.add('hidden'); }


// ==========================================
// MÓDULO DE AGENDA CALENDARIO
// ==========================================
function getEventsLocal() { return JSON.parse(localStorage.getItem('core_work_events') || '[]'); }

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const title = document.getElementById('calendar-month-year');
    if (!grid || !title) return;

    const events = getEventsLocal();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    title.innerText = `${monthNames[currentMonth]} ${currentYear}`;
    grid.innerHTML = '';

    for (let i = 0; i < firstDay; i++) grid.innerHTML += `<div class="bg-white calendar-cell p-2 text-slate-300"></div>`;

    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayEvents = events.filter(e => e.date === dateStr);
        
        let eventsHtml = dayEvents.map(e => `<div class="text-[10px] bg-slate-800 text-white p-1 mb-1 rounded truncate shadow-sm">${e.time} ${e.name}</div>`).join('');
        const isToday = new Date().toDateString() === new Date(currentYear, currentMonth, i).toDateString();

        grid.innerHTML += `
            <div class="bg-white calendar-cell p-2 border-t-2 ${isToday ? 'border-t-slate-900' : 'border-t-transparent'}">
                <div class="text-xs mb-2 ${isToday ? 'bg-slate-900 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold' : 'text-slate-700 font-medium'}">${i}</div>
                <div class="space-y-1">${eventsHtml}</div>
            </div>`;
    }
}

function changeMonth(step) {
    currentMonth += step;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
}

function saveEvent(e) {
    e.preventDefault();
    const evts = getEventsLocal();
    evts.push({
        id: Date.now().toString(), name: document.getElementById('evt-name').value,
        date: document.getElementById('evt-date').value, time: document.getElementById('evt-time').value,
        company: document.getElementById('evt-company').value, location: document.getElementById('evt-location').value
    });
    localStorage.setItem('core_work_events', JSON.stringify(evts));
    closeEventModal(); renderCalendar(); document.getElementById('event-form').reset();
}

function openEventModal() { document.getElementById('event-modal').classList.remove('hidden'); }
function closeEventModal() { document.getElementById('event-modal').classList.add('hidden'); }


// ==========================================
// MÓDULO DE FINANZAS
// ==========================================
function getFinancesLocal() { return JSON.parse(localStorage.getItem('core_work_finances') || '[]'); }

function renderFinances() {
    const tbody = document.getElementById('finance-table-body');
    if (!tbody) return;
    const finances = getFinancesLocal();
    tbody.innerHTML = '';
    
    let inc = 0, pas = 0, horm = 0;

    if (finances.length === 0) document.getElementById('empty-finance-msg').classList.remove('hidden');
    else {
        document.getElementById('empty-finance-msg').classList.add('hidden');
        finances.forEach((item, idx) => {
            const amt = parseFloat(item.amount);
            if (item.type.includes('Ingreso')) inc += amt;
            else if (item.type.includes('Hormiga')) horm += amt;
            else pas += amt;

            tbody.innerHTML += `
                <tr class="hover:bg-slate-50 border-b border-slate-50">
                    <td class="px-6 py-3.5">${item.date}</td><td class="px-6 py-3.5 font-medium">${item.concept}</td>
                    <td class="px-6 py-3.5"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">${item.type}</span></td>
                    <td class="px-6 py-3.5">${item.entity}</td><td class="px-6 py-3.5 text-right font-bold">$${amt.toFixed(2)}</td>
                    <td class="px-6 py-3.5 text-center"><button onclick="deleteFinance(${idx})" class="text-red-500 text-xs hover:underline">Borrar</button></td>
                </tr>`;
        });
    }

    document.getElementById('fin-total-ingresos').innerText = `$${inc.toFixed(2)}`;
    document.getElementById('fin-total-pasivos').innerText = `$${pas.toFixed(2)}`;
    document.getElementById('fin-total-hormiga').innerText = `$${horm.toFixed(2)}`;
    document.getElementById('fin-balance-neto').innerText = `$${(inc - (pas + horm)).toFixed(2)}`;
}

function saveFinance(e) {
    e.preventDefault();
    const f = getFinancesLocal();
    f.push({
        concept: document.getElementById('fin-concept').value, type: document.getElementById('fin-type').value,
        amount: document.getElementById('fin-amount').value, entity: document.getElementById('fin-entity').value,
        date: document.getElementById('fin-date').value
    });
    localStorage.setItem('core_work_finances', JSON.stringify(f));
    closeFinanceModal(); renderFinances(); document.getElementById('finance-form').reset();
}

function deleteFinance(idx) { const f = getFinancesLocal(); f.splice(idx, 1); localStorage.setItem('core_work_finances', JSON.stringify(f)); renderFinances(); }
function openFinanceModal() { document.getElementById('finance-modal').classList.remove('hidden'); }
function closeFinanceModal() { document.getElementById('finance-modal').classList.add('hidden'); }


// ==========================================
// MÓDULO TELARAÑA (CRM RELACIONAL)
// ==========================================
function getContactsLocal() { return JSON.parse(localStorage.getItem('core_work_crm') || '[]'); }

function renderTelarana() {
    const container = document.getElementById('crm-network');
    const tbody = document.getElementById('contacts-table-body');
    if (!container || !tbody) return;

    const contacts = getContactsLocal();
    tbody.innerHTML = '';
    
    const nodes = [{ id: 1, label: 'YO', shape: 'circle', color: { background: '#0F172A', border: '#0F172A' }, font: { color: 'white', face: 'Inter' } }];
    const edges = [];
    const today = new Date();

    contacts.forEach(c => {
        const lastDate = new Date(c.lastContact);
        const diffTime = Math.abs(today - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let status = 'Al día'; let bColor = '#10B981'; // Green
        if(diffDays > 15) { status = 'Requiere Seguimiento'; bColor = '#F59E0B'; } // Yellow
        if(diffDays > 30) { status = 'Alerta Inactividad'; bColor = '#EF4444'; } // Red

        // Añadir a la tabla
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 border-b border-slate-50">
                <td class="px-6 py-3.5 font-medium">${c.name}</td>
                <td class="px-6 py-3.5">${c.type}</td>
                <td class="px-6 py-3.5">Hace ${diffDays} días (${c.lastContact})</td>
                <td class="px-6 py-3.5 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold text-white" style="background-color: ${bColor}">${status}</span></td>
                <td class="px-6 py-3.5 text-right">
                    <button onclick="openInteractionModal('${c.id}', '${c.name}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-1 rounded border border-slate-300">Programar Acción</button>
                    <button onclick="deleteContact('${c.id}')" class="ml-2 text-xs text-red-500 hover:underline">Borrar</button>
                </td>
            </tr>`;

        // Añadir al grafo
        nodes.push({
            id: c.id, label: c.name, shape: 'dot', size: 14,
            color: { background: bColor, border: '#0F172A' },
            font: { color: '#334155', face: 'Inter', size: 11 }
        });
        edges.push({ from: 1, to: c.id, color: { color: '#CBD5E1' } });
    });

    const options = { physics: { stabilization: false, barnesHut: { gravitationalConstant: -2000 } } };
    if (networkInstance) networkInstance.destroy();
    networkInstance = new vis.Network(container, { nodes, edges }, options);
}

function saveContact(e) {
    e.preventDefault();
    const c = getContactsLocal();
    c.push({
        id: 'c_' + Date.now(), name: document.getElementById('contact-name').value,
        type: document.getElementById('contact-type').value, lastContact: document.getElementById('contact-last-date').value
    });
    localStorage.setItem('core_work_crm', JSON.stringify(c));
    closeContactModal(); renderTelarana(); document.getElementById('contact-form').reset();
}

function saveInteraction(e) {
    e.preventDefault();
    const contactId = document.getElementById('interaction-contact-id').value;
    
    // Al agendar, actualizamos la fecha de último contacto al día programado o al día de hoy.
    const dateInput = document.getElementById('interaction-date').value;
    let contacts = getContactsLocal();
    const contactIndex = contacts.findIndex(c => c.id === contactId);
    
    if (contactIndex > -1) {
        contacts[contactIndex].lastContact = dateInput;
        localStorage.setItem('core_work_crm', JSON.stringify(contacts));
        
        // También lo mandamos al calendario (Agenda) automáticamente
        const events = getEventsLocal();
        events.push({
            id: Date.now().toString(), name: `Llamada/Reunión con: ${contacts[contactIndex].name}`,
            date: dateInput, time: document.getElementById('interaction-type').value,
            company: contacts[contactIndex].type, location: document.getElementById('interaction-notes').value
        });
        localStorage.setItem('core_work_events', JSON.stringify(events));
    }
    
    closeInteractionModal(); renderTelarana(); document.getElementById('interaction-form').reset();
    alert("Interacción programada. Se ha actualizado el nodo en la red y se ha añadido al calendario de tu Agenda.");
}

function deleteContact(id) {
    const c = getContactsLocal().filter(x => x.id !== id);
    localStorage.setItem('core_work_crm', JSON.stringify(c));
    renderTelarana();
}

function openContactModal() { document.getElementById('contact-modal').classList.remove('hidden'); }
function closeContactModal() { document.getElementById('contact-modal').classList.add('hidden'); }
function openInteractionModal(id, name) {
    document.getElementById('interaction-contact-id').value = id;
    document.getElementById('interaction-contact-name').innerText = name;
    document.getElementById('interaction-modal').classList.remove('hidden');
}
function closeInteractionModal() { document.getElementById('interaction-modal').classList.add('hidden'); }