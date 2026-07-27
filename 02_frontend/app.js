const API_URL = 'https://core-work-api.onrender.com';

let tasksCache = [];
let deleteTaskId = null;
let networkInstance = null;

// Inicializador según la página
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('task-list')) {
        fetchTasks();
    }
    if (document.getElementById('event-grid')) {
        renderEvents();
    }
    if (document.getElementById('finance-table-body')) {
        renderFinances();
    }
    updateDashboardMetrics();
});

// --- API DE TAREAS (FASTAPI) ---
async function fetchTasks() {
    try {
        const response = await fetch(`${API_URL}/tasks`);
        tasksCache = await response.json();
        
        const taskList = document.getElementById('task-list');
        if (!taskList) return;

        taskList.innerHTML = '';

        if (tasksCache.length === 0) {
            taskList.innerHTML = '<li class="text-slate-500 text-xs text-center py-4">No hay tareas pendientes.</li>';
        } else {
            tasksCache.forEach(task => {
                const li = document.createElement('li');
                li.className = "flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors bg-white";
                
                li.innerHTML = `
                    <div class="flex items-center space-x-3">
                        <input type="checkbox" onchange="toggleTask(${task.id}, this.checked)" class="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900 cursor-pointer" ${task.completed ? 'checked' : ''}>
                        <span class="${task.completed ? 'line-through text-slate-400' : 'text-slate-800 font-medium text-xs'}">${task.title}</span>
                    </div>
                    <div class="flex items-center space-x-1.5">
                        <button onclick="openDeleteModal(${task.id})" class="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                `;
                taskList.appendChild(li);
            });
        }

        if (document.getElementById('neural-canvas')) {
            initNeuralNetwork();
        }
        updateDashboardMetrics();

    } catch (error) {
        console.error("Error conectando a la API de tareas:", error);
    }
}

async function saveTask(event) {
    event.preventDefault();
    const title = document.getElementById('task-title').value;
    
    await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, description: "", is_ops: false })
    });

    closeTaskModal();
    fetchTasks();
}

async function toggleTask(id, completed) {
    await fetch(`${API_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed })
    });
    fetchTasks();
}

async function confirmDeleteTask() {
    if (!deleteTaskId) return;
    await fetch(`${API_URL}/tasks/${deleteTaskId}`, { method: 'DELETE' });
    closeDeleteModal();
    fetchTasks();
}

function openTaskModal() { document.getElementById('task-modal').classList.remove('hidden'); }
function closeTaskModal() { document.getElementById('task-modal').classList.add('hidden'); }
function openDeleteModal(id) { deleteTaskId = id; document.getElementById('delete-modal').classList.remove('hidden'); }
function closeDeleteModal() { deleteTaskId = null; document.getElementById('delete-modal').classList.add('hidden'); }

// --- MAPA NEURONAL PROFESIONAL (MONOCROMÁTICO / SOBRIO) ---
function initNeuralNetwork() {
    const container = document.getElementById('neural-canvas');
    if (!container) return;

    const events = getEventsLocal();

    // Nodos Principales de Empresas
    const nodesArray = [
        { id: 1, label: 'CORE-WORK', shape: 'dot', size: 18, color: { background: '#0F172A', border: '#0F172A' }, font: { color: '#0F172A', face: 'Inter', size: 12, bold: true } },
        { id: 2, label: 'Empresa A', shape: 'dot', size: 14, color: { background: '#334155', border: '#334155' }, font: { color: '#334155', face: 'Inter', size: 11 } },
        { id: 3, label: 'Empresa B', shape: 'dot', size: 14, color: { background: '#475569', border: '#475569' }, font: { color: '#475569', face: 'Inter', size: 11 } },
        { id: 4, label: 'Personal', shape: 'dot', size: 14, color: { background: '#64748B', border: '#64748B' }, font: { color: '#64748B', face: 'Inter', size: 11 } },
    ];

    const edgesArray = [
        { from: 1, to: 2, color: { color: '#E2E8F0' }, width: 1.5 },
        { from: 1, to: 3, color: { color: '#E2E8F0' }, width: 1.5 },
        { from: 1, to: 4, color: { color: '#E2E8F0' }, width: 1.5 },
    ];

    // Conectar Tareas Pendientes a las empresas (Nodos Tarea)
    tasksCache.forEach(task => {
        const nodeId = 1000 + task.id;
        nodesArray.push({
            id: nodeId,
            label: `Tarea: ${task.title.length > 20 ? task.title.substring(0, 18) + '...' : task.title}`,
            shape: 'dot',
            size: 8,
            color: { background: task.completed ? '#94A3B8' : '#1E293B', border: '#0F172A' },
            font: { color: '#475569', face: 'Inter', size: 9 }
        });
        edgesArray.push({ from: 2, to: nodeId, color: { color: '#CBD5E1' }, length: 110 });
    });

    // Conectar Eventos de Agenda a las empresas (Nodos Evento)
    events.forEach((evt, idx) => {
        const evtNodeId = 5000 + idx;
        let parentCompany = 2;
        if (evt.company === 'Empresa B') parentCompany = 3;
        if (evt.company === 'Personal') parentCompany = 4;

        nodesArray.push({
            id: evtNodeId,
            label: `Evento: ${evt.name}`,
            shape: 'diamond',
            size: 9,
            color: { background: '#475569', border: '#0F172A' },
            font: { color: '#334155', face: 'Inter', size: 9 }
        });
        edgesArray.push({ from: parentCompany, to: evtNodeId, color: { color: '#CBD5E1' }, length: 110 });
    });

    const data = {
        nodes: new vis.DataSet(nodesArray),
        edges: new vis.DataSet(edgesArray)
    };

    const options = {
        physics: {
            stabilization: false,
            barnesHut: { gravitationalConstant: -2500, springLength: 100 }
        },
        interaction: { hover: true, dragNodes: true, zoomView: true }
    };

    if (networkInstance) networkInstance.destroy();
    networkInstance = new vis.Network(container, data, options);
}

// --- AGENDA GLOBAL ---
function getEventsLocal() { return JSON.parse(localStorage.getItem('core_work_events') || '[]'); }
function saveEventsLocal(data) { localStorage.setItem('core_work_events', JSON.stringify(data)); }

function renderEvents() {
    const grid = document.getElementById('event-grid');
    const emptyMsg = document.getElementById('empty-agenda-msg');
    if (!grid) return;

    const events = getEventsLocal();
    grid.innerHTML = '';

    if (events.length === 0) {
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
        events.forEach((evt, idx) => {
            const card = document.createElement('div');
            card.className = "bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between";
            card.innerHTML = `
                <div>
                    <div class="flex justify-between items-start mb-3">
                        <span class="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded uppercase">${evt.company}</span>
                        <button onclick="deleteEvent(${idx})" class="text-slate-400 hover:text-red-600 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                    <h4 class="font-bold text-slate-900 text-sm mb-1">${evt.name}</h4>
                    <p class="text-xs text-slate-500 mb-2">⏱ Duración: ${evt.duration}</p>
                    <p class="text-xs text-slate-500 mb-3">📍 Ubicación: ${evt.location}</p>
                    ${evt.details ? `<p class="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">${evt.details}</p>` : ''}
                </div>
            `;
            grid.appendChild(card);
        });
    }
    updateDashboardMetrics();
}

function openEventModal() { document.getElementById('event-modal').classList.remove('hidden'); }
function closeEventModal() { document.getElementById('event-modal').classList.add('hidden'); }

function saveEvent(event) {
    event.preventDefault();
    const events = getEventsLocal();
    events.push({
        name: document.getElementById('event-name').value,
        company: document.getElementById('event-company').value,
        duration: document.getElementById('event-duration').value,
        location: document.getElementById('event-location').value,
        details: document.getElementById('event-details').value
    });
    saveEventsLocal(events);
    closeEventModal();
    renderEvents();
    document.getElementById('event-form').reset();
}

function deleteEvent(index) {
    const events = getEventsLocal();
    events.splice(index, 1);
    saveEventsLocal(events);
    renderEvents();
}

// --- FINANZAS & HISTORIAL ---
function getFinancesLocal() { return JSON.parse(localStorage.getItem('core_work_finances') || '[]'); }
function saveFinancesLocal(data) { localStorage.setItem('core_work_finances', JSON.stringify(data)); }

function renderFinances() {
    const tbody = document.getElementById('finance-table-body');
    const emptyMsg = document.getElementById('empty-finance-msg');
    if (!tbody) return;

    const finances = getFinancesLocal();
    tbody.innerHTML = '';

    let totalIngresos = 0;
    let totalPasivos = 0;
    let totalHormiga = 0;

    if (finances.length === 0) {
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
        finances.forEach((item, idx) => {
            const amount = parseFloat(item.amount);
            if (item.type === 'Ingreso') totalIngresos += amount;
            if (item.type === 'Pasivo') totalPasivos += amount;
            if (item.type === 'Gasto Hormiga') totalHormiga += amount;

            const row = document.createElement('tr');
            row.className = "hover:bg-slate-50 transition-colors";
            
            let badgeClass = "bg-slate-100 text-slate-700";
            if (item.type === 'Ingreso') badgeClass = "bg-emerald-100 text-emerald-800";
            if (item.type === 'Pasivo') badgeClass = "bg-slate-200 text-slate-800";
            if (item.type === 'Gasto Hormiga') badgeClass = "bg-rose-100 text-rose-800";

            row.innerHTML = `
                <td class="px-6 py-3.5 text-slate-500">${item.date}</td>
                <td class="px-6 py-3.5 font-semibold text-slate-900">${item.concept}</td>
                <td class="px-6 py-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}">${item.type}</span></td>
                <td class="px-6 py-3.5 text-slate-500">${item.entity}</td>
                <td class="px-6 py-3.5 text-right font-bold ${item.type === 'Ingreso' ? 'text-emerald-600' : 'text-slate-800'}">$${amount.toFixed(2)}</td>
                <td class="px-6 py-3.5 text-center">
                    <button onclick="deleteFinance(${idx})" class="text-slate-400 hover:text-red-600">
                        <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    document.getElementById('fin-total-ingresos').innerText = `$${totalIngresos.toFixed(2)}`;
    document.getElementById('fin-total-pasivos').innerText = `$${totalPasivos.toFixed(2)}`;
    document.getElementById('fin-total-hormiga').innerText = `$${totalHormiga.toFixed(2)}`;
    document.getElementById('fin-balance-neto').innerText = `$${(totalIngresos - (totalPasivos + totalHormiga)).toFixed(2)}`;

    updateDashboardMetrics();
}

function openFinanceModal() { document.getElementById('finance-modal').classList.remove('hidden'); }
function closeFinanceModal() { document.getElementById('finance-modal').classList.add('hidden'); }

function saveFinance(event) {
    event.preventDefault();
    const finances = getFinancesLocal();
    finances.push({
        concept: document.getElementById('fin-concept').value,
        type: document.getElementById('fin-type').value,
        amount: document.getElementById('fin-amount').value,
        entity: document.getElementById('fin-entity').value,
        date: document.getElementById('fin-date').value
    });
    saveFinancesLocal(finances);
    closeFinanceModal();
    renderFinances();
    document.getElementById('finance-form').reset();
}

function deleteFinance(index) {
    const finances = getFinancesLocal();
    finances.splice(index, 1);
    saveFinancesLocal(finances);
    renderFinances();
}

// --- MÉTRICAS GLOBAL DASHBOARD ---
function updateDashboardMetrics() {
    const taskCount = document.getElementById('dash-task-count');
    const eventCount = document.getElementById('dash-event-count');
    const incomeTotal = document.getElementById('dash-income-total');
    const expenseTotal = document.getElementById('dash-expense-total');

    if (taskCount) taskCount.innerText = tasksCache.filter(t => !t.completed).length;
    if (eventCount) eventCount.innerText = getEventsLocal().length;

    const finances = getFinancesLocal();
    let inc = 0;
    let exp = 0;
    finances.forEach(f => {
        const amt = parseFloat(f.amount);
        if (f.type === 'Ingreso') inc += amt;
        else exp += amt;
    });

    if (incomeTotal) incomeTotal.innerText = `$${inc.toFixed(2)}`;
    if (expenseTotal) expenseTotal.innerText = `$${exp.toFixed(2)}`;
}