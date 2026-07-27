const API_URL = 'https://core-work-api.onrender.com';

let tasksCache = [];
let deleteTaskId = null;
let networkInstance = null;

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('task-list')) {
        fetchTasks();
    }
    if (document.getElementById('financeChart')) {
        initFinanceChart();
    }
});

// --- GESTIÓN DE TAREAS ---
async function fetchTasks() {
    try {
        const response = await fetch(`${API_URL}/tasks`);
        tasksCache = await response.json();
        
        const taskList = document.getElementById('task-list');
        const taskCount = document.getElementById('task-count');
        const opsCount = document.getElementById('ops-count');
        
        if (taskList) taskList.innerHTML = '';
        if (taskCount) taskCount.innerText = tasksCache.length;
        if (opsCount) opsCount.innerText = tasksCache.filter(t => t.is_ops && !t.completed).length;

        if (tasksCache.length === 0 && taskList) {
            taskList.innerHTML = '<li class="text-gray-500 text-sm text-center py-4">No hay tareas pendientes.</li>';
        } else if (taskList) {
            tasksCache.forEach(task => {
                const li = document.createElement('li');
                li.className = "flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors bg-white";
                
                const opsTag = task.is_ops ? `<span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">OPS</span>` : '';

                li.innerHTML = `
                    <div class="flex items-center space-x-3">
                        <input type="checkbox" onchange="toggleTask(${task.id}, this.checked)" class="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer" ${task.completed ? 'checked' : ''}>
                        <span class="${task.completed ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}">${task.title}</span>
                        ${opsTag}
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="openEditModal(${task.id})" class="p-1.5 text-gray-400 hover:text-black rounded-md hover:bg-gray-100 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 210.3H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button onclick="openDeleteModal(${task.id})" class="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                `;
                taskList.appendChild(li);
            });
        }

        // Renderizar mapa neuronal si estamos en el dashboard
        if (document.getElementById('neural-canvas')) {
            initNeuralNetwork();
        }

    } catch (error) {
        console.error("Error al obtener tareas:", error);
    }
}

// --- RED NEURONAL (VIS.JS) ---
function initNeuralNetwork() {
    const container = document.getElementById('neural-canvas');
    if (!container) return;

    // Nodos Base
    const nodesArray = [
        { id: 1, label: 'CORE-WORK', shape: 'dot', size: 22, color: { background: '#DC2626', border: '#111827' }, font: { color: '#111827', face: 'Inter', size: 14, bold: true } },
        { id: 2, label: 'Empresa A', shape: 'dot', size: 16, color: { background: '#111827', border: '#111827' }, font: { color: '#111827', face: 'Inter', size: 12 } },
        { id: 3, label: 'Empresa B', shape: 'dot', size: 16, color: { background: '#DC2626', border: '#DC2626' }, font: { color: '#111827', face: 'Inter', size: 12 } },
        { id: 4, label: 'Aiven DB', shape: 'diamond', size: 14, color: { background: '#3B82F6', border: '#1E40AF' }, font: { color: '#111827', face: 'Inter', size: 11 } },
        { id: 5, label: 'Render API', shape: 'diamond', size: 14, color: { background: '#10B981', border: '#065F46' }, font: { color: '#111827', face: 'Inter', size: 11 } },
    ];

    const edgesArray = [
        { from: 1, to: 2, color: { color: '#9CA3AF' } },
        { from: 1, to: 3, color: { color: '#9CA3AF' } },
        { from: 1, to: 4, color: { color: '#9CA3AF' } },
        { from: 1, to: 5, color: { color: '#9CA3AF' } },
    ];

    // Conectar tareas dinámicas
    tasksCache.forEach((task, index) => {
        const nodeId = 100 + task.id;
        const targetParent = task.is_ops ? 3 : 2; // Asigna interconexión inteligente
        nodesArray.push({
            id: nodeId,
            label: task.title.length > 18 ? task.title.substring(0, 15) + '...' : task.title,
            shape: 'dot',
            size: 10,
            color: { background: task.completed ? '#D1D5DB' : '#EF4444', border: '#374151' },
            font: { color: '#4B5563', face: 'Inter', size: 10 }
        });
        edgesArray.push({ from: targetParent, to: nodeId, color: { color: '#E5E7EB' } });
    });

    const data = {
        nodes: new vis.DataSet(nodesArray),
        edges: new vis.DataSet(edgesArray)
    };

    const options = {
        physics: {
            stabilization: false,
            barnesHut: { gravitationalConstant: -3000, springLength: 90 }
        },
        interaction: { hover: true, dragNodes: true }
    };

    if (networkInstance) networkInstance.destroy();
    networkInstance = new vis.Network(container, data, options);
}

// --- GRÁFICO FINANCIERO ---
function initFinanceChart() {
    const ctx = document.getElementById('financeChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
            datasets: [{
                label: 'Ingresos Netos ($)',
                data: [3200, 3800, 4100, 3900, 4250, 4800],
                borderColor: '#DC2626',
                backgroundColor: 'rgba(220, 38, 38, 0.05)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

// --- CONTROLLERS MODALES ---
function openCreateModal() {
    document.getElementById('modal-title').innerText = "Nueva Tarea";
    document.getElementById('task-id').value = "";
    document.getElementById('task-title').value = "";
    document.getElementById('task-is-ops').checked = false;
    document.getElementById('task-modal').classList.remove('hidden');
}

function openEditModal(id) {
    const task = tasksCache.find(t => t.id === id);
    if (!task) return;

    document.getElementById('modal-title').innerText = "Editar Tarea";
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-is-ops').checked = task.is_ops;
    document.getElementById('task-modal').classList.remove('hidden');
}

function closeTaskModal() {
    document.getElementById('task-modal').classList.add('hidden');
}

async function saveTask(event) {
    event.preventDefault();
    const id = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value;
    const isOps = document.getElementById('task-is-ops').checked;
    const payload = { title, is_ops: isOps };

    if (id) {
        await fetch(`${API_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } else {
        await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }

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

function openDeleteModal(id) {
    deleteTaskId = id;
    document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
    deleteTaskId = null;
    document.getElementById('delete-modal').classList.add('hidden');
}

async function confirmDeleteTask() {
    if (!deleteTaskId) return;
    await fetch(`${API_URL}/tasks/${deleteTaskId}`, { method: 'DELETE' });
    closeDeleteModal();
    fetchTasks();
}