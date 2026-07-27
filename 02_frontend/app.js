const API_URL = 'https://core-work-api.onrender.com';

let tasksCache = [];
let deleteTaskId = null;

// --- NAVEGACIÓN ENTRE MENÚS ---
function switchTab(tabName) {
    const tabs = ['dashboard', 'agenda', 'finanzas', 'infraestructura'];
    const titles = {
        'dashboard': 'Resumen de Operaciones',
        'agenda': 'Agenda Global',
        'finanzas': 'Control Financiero',
        'infraestructura': 'Infraestructura & Servidores'
    };

    tabs.forEach(tab => {
        const view = document.getElementById(`view-${tab}`);
        const nav = document.getElementById(`nav-${tab}`);
        
        if (tab === tabName) {
            view.classList.remove('hidden');
            nav.className = "w-full flex items-center px-4 py-2 bg-red-50 text-red-600 rounded-lg font-semibold border-r-4 border-red-600 transition-all";
        } else {
            view.classList.add('hidden');
            nav.className = "w-full flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-all";
        }
    });

    document.getElementById('page-title').innerText = titles[tabName];
}

// --- GESTIÓN DE TAREAS (API) ---
async function fetchTasks() {
    try {
        const response = await fetch(`${API_URL}/tasks`);
        tasksCache = await response.json();
        
        const taskList = document.getElementById('task-list');
        const taskCount = document.getElementById('task-count');
        const opsCount = document.getElementById('ops-count');
        
        taskList.innerHTML = '';
        taskCount.innerText = tasksCache.length;
        opsCount.innerText = tasksCache.filter(t => t.is_ops && !t.completed).length;

        if (tasksCache.length === 0) {
            taskList.innerHTML = '<li class="text-gray-500 text-sm text-center py-4">No hay tareas pendientes.</li>';
            return;
        }

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
    } catch (error) {
        console.error("Error conectando con la API", error);
        document.getElementById('task-list').innerHTML = '<li class="text-red-500 text-sm text-center py-4">Error conectando con la base de datos.</li>';
    }
}

// Alternar completado
async function toggleTask(id, completed) {
    await fetch(`${API_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: completed })
    });
    fetchTasks();
}

// --- MANEJO DE MODALES (SIN POPUPS) ---
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

    const payload = { title: title, is_ops: isOps };

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

    await fetch(`${API_URL}/tasks/${deleteTaskId}`, {
        method: 'DELETE'
    });

    closeDeleteModal();
    fetchTasks();
}

// Inicialización
document.addEventListener('DOMContentLoaded', fetchTasks);