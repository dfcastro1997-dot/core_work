const API_URL = 'https://core-work-api.onrender.com';

// Función para cargar tareas desde el backend
async function fetchTasks() {
    try {
        const response = await fetch(`${API_URL}/tasks`);
        const tasks = await response.json();
        
        const taskList = document.getElementById('task-list');
        const taskCount = document.getElementById('task-count');
        
        taskList.innerHTML = ''; // Limpiar lista
        taskCount.innerText = tasks.length;

        if(tasks.length === 0) {
            taskList.innerHTML = '<li class="text-gray-500 text-sm text-center">No hay tareas pendientes.</li>';
            return;
        }

        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = "flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors";
            
            // Si es tarea de OPS (Servidores), le ponemos una etiqueta roja
            const opsTag = task.is_ops ? `<span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">OPS</span>` : '';

            li.innerHTML = `
                <div class="flex items-center space-x-3">
                    <input type="checkbox" class="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500" ${task.completed ? 'checked' : ''}>
                    <span class="${task.completed ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}">${task.title}</span>
                    ${opsTag}
                </div>
                <button class="text-gray-400 hover:text-black">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                </button>
            `;
            taskList.appendChild(li);
        });
    } catch (error) {
        console.error("Error conectando con la API", error);
        document.getElementById('task-list').innerHTML = '<li class="text-red-500 text-sm text-center">Error conectando al servidor. Asegúrate de que FastAPI esté corriendo.</li>';
    }
}

// Función para simular agregar una tarea (POST)
async function addTask() {
    const title = prompt("Describe la nueva actividad:");
    if (!title) return;

    const isOps = confirm("¿Es una tarea crítica de infraestructura/servidores (OPS)?");

    await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, description: "", is_ops: isOps })
    });

    fetchTasks(); // Recargar la lista
}

// Iniciar cargando las tareas
document.addEventListener('DOMContentLoaded', fetchTasks);