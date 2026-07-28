const API_URL = 'https://core-work-api.onrender.com';
let financesCache = [], pocketsCache = [], settingsCache = [];
let balanceVisible = false;

document.addEventListener('DOMContentLoaded', async () => { await fetchAllData(); });

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

const safeFetch = (url) => fetch(url).then(r => r.ok ? r.json() : []).catch(() => []);

async function fetchAllData() {
    try {
        const [resFinances, resPockets, resSettings] = await Promise.all([ safeFetch(`${API_URL}/finances`), safeFetch(`${API_URL}/pockets`), safeFetch(`${API_URL}/settings`) ]);
        settingsCache = Array.isArray(resSettings) ? resSettings : [];
        financesCache = Array.isArray(resFinances) ? resFinances : [];
        pocketsCache = Array.isArray(resPockets) ? resPockets : [];
    } catch (err) { console.error(err); } 
    finally {
        loadDynamicOptions();
        if (document.getElementById('dash-income-total')) updateDashboard();
        if (document.getElementById('finance-table-body')) { renderFinances(); renderPockets(); }
        if (document.getElementById('expense-list')) renderSettings();
    }
}

function loadDynamicOptions() {
    const categories = settingsCache.filter(s => s.type === 'categories').map(s => s.value);
    const fixedItems = settingsCache.filter(s => s.type === 'fixed').map(s => s.value);
    document.querySelectorAll('.dynamic-expenses').forEach(sel => { sel.innerHTML = ''; categories.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`); });
    const fixedDatalist = document.getElementById('fixed-expenses-list');
    if (fixedDatalist) { fixedDatalist.innerHTML = ''; fixedItems.forEach(f => fixedDatalist.innerHTML += `<option value="${f}"></option>`); }
}

function renderSettings() {
    const cList = document.getElementById('expense-list'), fList = document.getElementById('fixed-list');
    if(!cList) return;
    cList.innerHTML = ''; fList.innerHTML = '';
    settingsCache.filter(s => s.type === 'categories').forEach(e => cList.innerHTML += `<li class="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100"><span class="font-medium text-slate-800">${e.value}</span><button onclick="deleteSetting(${e.id})" class="text-red-500 hover:text-red-700">Eliminar</button></li>`);
    settingsCache.filter(s => s.type === 'fixed').forEach(f => fList.innerHTML += `<li class="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100"><span class="font-medium text-slate-800">${f.value}</span><button onclick="deleteSetting(${f.id})" class="text-red-500 hover:text-red-700">Eliminar</button></li>`);
}

async function addExpenseType() { const val = document.getElementById('new-expense').value; if(val) { await fetch(`${API_URL}/settings`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'categories', value:val})}); document.getElementById('new-expense').value=''; fetchAllData(); } }
async function addFixedItem() { const val = document.getElementById('new-fixed').value; if(val) { await fetch(`${API_URL}/settings`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'fixed', value:val})}); document.getElementById('new-fixed').value=''; fetchAllData(); } }
async function deleteSetting(id) { await fetch(`${API_URL}/settings/${id}`, {method:'DELETE'}); fetchAllData(); }

async function testTelegramAlert() {
    try {
        const response = await fetch(`${API_URL}/test-telegram`, { method: 'POST' });
        if(response.ok) showCustomAlert("Telegram Ok", "Reporte financiero enviado.", "success");
        else showCustomAlert("Telegram Falló", "Verifica el token en el backend.", "error");
    } catch (e) { showCustomAlert("Error de Conexión", "El backend no responde.", "error"); }
}

function toggleBalance() { balanceVisible = !balanceVisible; updateBalanceDisplay(); }
function updateBalanceDisplay() {
    const el = document.getElementById('dash-income-total'), btn = document.getElementById('eye-icon-btn');
    if (!el || !btn) return;
    if (balanceVisible) { el.innerText = `$${el.getAttribute('data-value') || "0.00"}`; btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>`; } 
    else { el.innerText = '••••••'; btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>`; }
}
function updateDashboard() {
    let inc = 0, exp = 0, incMes = 0, expMes = 0; const now = new Date();
    financesCache.forEach(f => { 
        const amt = parseFloat(f.amount), isThisMonth = new Date(f.date).getMonth() === now.getMonth() && new Date(f.date).getFullYear() === now.getFullYear();
        if (amt > 0) { inc += amt; if(isThisMonth) incMes += amt; } else { exp += Math.abs(amt); if(isThisMonth) expMes += Math.abs(amt); } 
    });
    if(document.getElementById('dash-income-total')) { document.getElementById('dash-income-total').setAttribute('data-value', (inc - exp).toFixed(2)); updateBalanceDisplay(); }
    if(document.getElementById('dash-ingresos-mes')) document.getElementById('dash-ingresos-mes').innerText = `$${incMes.toFixed(2)}`;
    if(document.getElementById('dash-egresos-mes')) document.getElementById('dash-egresos-mes').innerText = `$${expMes.toFixed(2)}`;
    if(document.getElementById('dash-neto-mes')) document.getElementById('dash-neto-mes').innerText = `$${(incMes - expMes).toFixed(2)}`;
}

function verifyFinances(e) {
    e.preventDefault();
    if (document.getElementById('fin-password').value === '12345') { const overlay = document.getElementById('auth-overlay'); overlay.style.opacity = '0'; setTimeout(() => overlay.classList.add('hidden'), 300); document.getElementById('fin-error').classList.add('hidden'); } else { document.getElementById('fin-error').classList.remove('hidden'); document.getElementById('fin-password').value = ''; }
}
function filterFinancesByTime(finances, filter) {
    if (filter === 'all') return finances;
    const now = new Date(), currentWeekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1)); currentWeekStart.setHours(0,0,0,0);
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
    tbody.innerHTML = ''; let inc = 0, exp = 0;
    if (finances.length === 0) document.getElementById('empty-finance-msg').classList.remove('hidden');
    else {
        document.getElementById('empty-finance-msg').classList.add('hidden');
        finances.forEach((item) => {
            const amt = parseFloat(item.amount);
            if (amt > 0) inc += amt; else exp += Math.abs(amt);
            const colorClass = amt > 0 ? "text-emerald-600" : "text-rose-600";
            tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b border-slate-50"><td class="px-6 py-3.5">${item.date}</td><td class="px-6 py-3.5 font-medium">${item.concept}</td><td class="px-6 py-3.5"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">${item.type}</span></td><td class="px-6 py-3.5 text-right font-bold ${colorClass}">$${Math.abs(amt).toFixed(2)}</td><td class="px-6 py-3.5 text-center"><button onclick="deleteFinance(${item.id})" class="text-red-500 text-xs hover:underline">Borrar</button></td></tr>`;
        });
    }
    if (document.getElementById('fin-total-ingresos')) { document.getElementById('fin-total-ingresos').innerText = `$${inc.toFixed(2)}`; document.getElementById('fin-total-pasivos').innerText = `$${exp.toFixed(2)}`; document.getElementById('fin-balance-neto').innerText = `$${(inc - exp).toFixed(2)}`; }
}
async function saveFinance(e) {
    e.preventDefault();
    let amt = Math.abs(parseFloat(document.getElementById('fin-amount').value));
    if(document.getElementById('fin-transaction-type').value === 'expense') amt = -amt;
    const payload = { concept: document.getElementById('fin-concept').value, type: document.getElementById('fin-type').value, amount: amt, date: document.getElementById('fin-date').value };
    try { await fetch(`${API_URL}/finances`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); closeFinanceModal(); document.getElementById('finance-form').reset(); showCustomAlert("Registrado", "Movimiento financiero guardado exitosamente.", "success"); fetchAllData(); } catch(err) { showCustomAlert("Error", "No se pudo registrar.", "error"); }
}
async function deleteFinance(id) { await fetch(`${API_URL}/finances/${id}`, { method: 'DELETE' }); showCustomAlert("Eliminado", "Registro borrado.", "success"); fetchAllData(); }
function openFinanceModal() { document.getElementById('finance-modal').classList.remove('hidden'); }
function closeFinanceModal() { document.getElementById('finance-modal').classList.add('hidden'); }

function openInvoiceModal() { document.getElementById('invoice-modal').classList.remove('hidden'); }
function closeInvoiceModal() { document.getElementById('invoice-modal').classList.add('hidden'); }
function generateInvoicePDF(e) {
    e.preventDefault();
    const client = document.getElementById('inv-client').value, concept = document.getElementById('inv-concept').value, amount = document.getElementById('inv-amount').value, date = new Date().toLocaleDateString('es-ES'), invoiceNumber = "INV-" + Math.floor(Math.random() * 10000);
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("CORE-FINANCE", 14, 22); doc.setFontSize(10); doc.setTextColor(100); doc.text("Facturación Electrónica Profesional", 14, 28);
    doc.setFontSize(16); doc.setTextColor(0); doc.text("FACTURA", 150, 22); doc.setFontSize(10); doc.text(`Número: ${invoiceNumber}`, 150, 28); doc.text(`Fecha: ${date}`, 150, 33);
    doc.setFontSize(12); doc.text(`Facturar a:`, 14, 45); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(client, 14, 52);
    doc.autoTable({ startY: 65, head: [['Descripción del Servicio / Venta', 'Total']], body: [ [concept, `$${parseFloat(amount).toFixed(2)}`] ], theme: 'striped', headStyles: { fillColor: [15, 23, 42] } });
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`Total a Pagar: $${parseFloat(amount).toFixed(2)}`, 140, (doc.lastAutoTable.finalY || 65) + 10);
    doc.save(`${invoiceNumber}_${client}.pdf`); closeInvoiceModal(); showCustomAlert("Factura Generada", "El PDF ha sido descargado.", "success");
}

function renderPockets() {
    const grid = document.getElementById('pockets-grid'); if (!grid) return; grid.innerHTML = '';
    if(pocketsCache.length === 0) { grid.innerHTML = '<p class="text-xs text-slate-500 col-span-3">No hay bolsillos de ahorro creados.</p>'; return; }
    pocketsCache.forEach(p => {
        const prog = Math.min(Math.round((p.current / p.target) * 100), 100);
        grid.innerHTML += `<div class="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between"><div class="flex justify-between items-start mb-2"><h4 class="font-bold text-slate-900 text-sm truncate pr-2">${p.name}</h4><span class="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded flex-shrink-0">${p.bank} - **${p.account}</span></div><div class="mb-3"><div class="flex justify-between text-xs mb-1"><span class="text-slate-500 font-medium">$${parseFloat(p.current).toFixed(2)}</span><span class="text-slate-800 font-bold">$${parseFloat(p.target).toFixed(2)}</span></div><div class="w-full bg-slate-200 rounded-full h-1.5"><div class="bg-emerald-500 h-1.5 rounded-full" style="width: ${prog}%"></div></div></div><div class="flex justify-between items-center border-t border-slate-200 pt-3"><button onclick="openPocketTxModal(${p.id})" class="text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 px-2 py-1 rounded">Transacción</button><button onclick="deletePocket(${p.id})" class="text-red-500 hover:text-red-700 text-xs font-medium">Borrar</button></div></div>`;
    });
}
async function savePocket(e) {
    e.preventDefault(); const payload = { name: document.getElementById('pkt-name').value, bank: document.getElementById('pkt-bank').value, account: document.getElementById('pkt-account').value, target: parseFloat(document.getElementById('pkt-target').value), current: parseFloat(document.getElementById('pkt-current').value) };
    try { await fetch(`${API_URL}/pockets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); closePocketModal(); document.getElementById('pocket-form').reset(); showCustomAlert("Bolsillo Creado", "Fondo registrado exitosamente.", "success"); fetchAllData(); } catch(err) { showCustomAlert("Error", "Falló la creación.", "error"); }
}
async function deletePocket(id) { await fetch(`${API_URL}/pockets/${id}`, { method: 'DELETE' }); showCustomAlert("Bolsillo Borrado", "Eliminado correctamente.", "success"); fetchAllData(); }
function openPocketModal() { document.getElementById('pocket-modal').classList.remove('hidden'); }
function closePocketModal() { document.getElementById('pocket-modal').classList.add('hidden'); }
function openPocketTxModal(id) { const p = pocketsCache.find(x => x.id === id); document.getElementById('tx-pocket-id').value = id; document.getElementById('tx-pocket-name').innerText = p.name; document.getElementById('pocket-tx-modal').classList.remove('hidden'); setTxType('add'); }
function closePocketTxModal() { document.getElementById('pocket-tx-modal').classList.add('hidden'); }
function setTxType(type) {
    document.getElementById('tx-type').value = type; const bAdd = document.getElementById('btn-tx-add'), bSub = document.getElementById('btn-tx-sub');
    if(type === 'add') { bAdd.className = "py-1.5 border-2 border-emerald-500 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg transition-colors"; bSub.className = "py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"; } 
    else { bSub.className = "py-1.5 border-2 border-rose-500 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg transition-colors"; bAdd.className = "py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"; }
}
async function executePocketTx(e) {
    e.preventDefault(); const id = parseInt(document.getElementById('tx-pocket-id').value), type = document.getElementById('tx-type').value, amount = parseFloat(document.getElementById('tx-amount').value), pkt = pocketsCache.find(x => x.id === id);
    let newCurrent = pkt.current; if (type === 'add') newCurrent += amount; else { if(amount > pkt.current) { showCustomAlert("Fondos Insuficientes", "El monto supera el saldo actual.", "error"); return; } newCurrent -= amount; }
    try { await fetch(`${API_URL}/pockets/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: newCurrent }) }); closePocketTxModal(); document.getElementById('pocket-tx-form').reset(); showCustomAlert("Transacción Exitosa", "Saldo actualizado.", "success"); fetchAllData(); } catch(err) { showCustomAlert("Error", "No se guardó el saldo.", "error"); }
}