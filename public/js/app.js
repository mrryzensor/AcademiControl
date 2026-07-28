// AcademiControl SPA Engine - Completo con Edit, Delete, Búsqueda, Filtros y Generación Impresa de Libretas/Certificados
let currentUser = null;
let authToken = localStorage.getItem('ac_token');
let mainChartInstance = null;
let secondaryChartInstance = null;

// Cache global para búsquedas
let globalLevels = [];
let globalUsers = [];
let globalGrades = [];

// Service Worker PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW Error:', err));
    });
}

// Online / Offline Monitor
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

function updateOnlineStatus() {
    const statusPill = document.getElementById('connection-status');
    if (!statusPill) return;

    if (navigator.onLine) {
        statusPill.className = 'status-pill online';
        statusPill.innerHTML = '<i data-lucide="wifi" style="width:14px; height:14px;"></i> Online';
    } else {
        statusPill.className = 'status-pill offline';
        statusPill.innerHTML = '<i data-lucide="wifi-off" style="width:14px; height:14px;"></i> Modo Offline';
    }
    if (window.lucide) lucide.createIcons();
}

// Global Toasts System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Global Modals System (Cierre estrictamente controlado por el botón de cierre)
function showModal(title, contentHtml, modalMode = false) {
    const container = document.getElementById('modal-container');
    
    let sizeStyle = '';
    if (modalMode === 'full' || modalMode === 'full_lesson') {
        sizeStyle = 'width: 90vw; height: 90vh; max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column;';
    } else if (modalMode === true) {
        sizeStyle = 'max-width: 720px; width: 92vw;';
    }

    container.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-card glass-panel" style="${sizeStyle}">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-shrink:0; padding-bottom:0.75rem;">
                    <h3 class="gradient-text" style="font-size:1.2rem;">${title}</h3>
                    <button onclick="closeModal()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:0.25rem;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; min-height: 0;">${contentHtml}</div>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function closeModal() {
    document.getElementById('modal-container').innerHTML = '';
}

// Confirm Modal Reemplazo de alerts / confirm nativos
function showConfirmModal(title, message, onConfirm) {
    showModal(title, `
        <div style="display:flex; flex-direction:column; gap:1.25rem; text-align:center; padding:0.5rem 0;">
            <p style="font-size:1rem; color:var(--text-main); line-height:1.5;">${message}</p>
            <div style="display:flex; justify-content:center; gap:0.75rem; margin-top:0.5rem;">
                <button class="btn-primary" style="background:rgba(255,255,255,0.1); color:var(--text-muted);" onclick="closeModal()">Cancelar</button>
                <button class="btn-primary" style="background:var(--danger);" id="btn-confirm-action">Confirmar</button>
            </div>
        </div>
    `, true);

    document.getElementById('btn-confirm-action').onclick = () => {
        closeModal();
        if (typeof onConfirm === 'function') onConfirm();
    };
}

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
    updateOnlineStatus();

    const storedUser = localStorage.getItem('ac_user');
    if (authToken && storedUser && storedUser !== 'undefined') {
        try {
            currentUser = JSON.parse(storedUser);
            showApp();
        } catch(e) {
            showLogin();
        }
    } else {
        showLogin();
    }


    document.getElementById('login-form').addEventListener('submit', handleLogin);
    if (window.lucide) lucide.createIcons();
});

async function quickLogin(email) {
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = 'Admin123!';
    try {
        const response = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: 'Admin123!' })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error al iniciar sesión rápida');

        authToken = data.token;
        currentUser = data.user;

        localStorage.setItem('ac_token', authToken);
        localStorage.setItem('ac_user', JSON.stringify(currentUser));

        showToast(`Sesión iniciada como ${currentUser.role_name}`, 'success');
        showApp();
    } catch(err) {
        showToast(err.message, 'error');
    }
}

async function handleLogin(e) {

    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Credenciales inválidas');
        }

        authToken = data.token;
        currentUser = data.user;

        localStorage.setItem('ac_token', authToken);
        localStorage.setItem('ac_user', JSON.stringify(currentUser));

        showToast(`¡Bienvenido de nuevo, ${currentUser.name}!`, 'success');
        showApp();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function logout() {
    localStorage.removeItem('ac_token');
    localStorage.removeItem('ac_user');
    authToken = null;
    currentUser = null;
    showToast('Sesión cerrada correctamente', 'info');
    showLogin();
}

function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
    if (window.lucide) lucide.createIcons();
}

let myRolePermissions = {};

async function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';

    document.getElementById('user-display-name').innerText = currentUser.name;
    document.getElementById('user-display-role').innerText = currentUser.role_name;

    try {
        const res = await fetch('/api/v1/permissions/permissions', { headers: { 'Authorization': `Bearer ${authToken}` } });
        const data = await res.json();
        myRolePermissions = data.my_permissions || {};
    } catch(e) {}

    const permMenu = document.getElementById('menu-permissions-item');
    if (permMenu) {
        permMenu.style.display = (currentUser.email === 'daviex14@gmail.com' || currentUser.role_id === 'super_admin') ? 'flex' : 'none';
    }

    const isSuperAdmin = !currentUser || currentUser.email === 'daviex14@gmail.com' || currentUser.role_id === 'super_admin';
    const canAssignWorkload = isSuperAdmin || (myRolePermissions && myRolePermissions.assign_workload !== false);
    const workloadMenu = document.getElementById('menu-workload-item');
    if (workloadMenu) {
        workloadMenu.style.display = canAssignWorkload ? 'flex' : 'none';
    }

    switchTab('dashboard');
}


// Navigation Manager
function switchTab(tabName, el = null) {
    if (el) {
        document.querySelectorAll('.sidebar-item, .ios-tab-item').forEach(item => item.classList.remove('active'));
        el.classList.add('active');
    }

    const titleEl = document.getElementById('view-title');
    const subtitleEl = document.getElementById('view-subtitle');

    switch (tabName) {
        case 'dashboard':
            titleEl.innerText = `Dashboard - ${currentUser.role_name}`;
            subtitleEl.innerText = `Métricas en tiempo real para ${currentUser.email}`;
            loadDashboardMetrics();
            break;
        case 'academic':
            titleEl.innerText = "Módulo Académico & Niveles";
            subtitleEl.innerText = "Gestión de Niveles, Cursos y Silabos del Colegio";
            renderAcademicView();
            break;
        case 'users':
            titleEl.innerText = "Usuarios & Control de Acceso";
            subtitleEl.innerText = "Gestión de Alumnos, Docentes y Apoderados";
            renderUsersView();
            break;
        case 'grades':
            titleEl.innerText = "Registro de Calificaciones & Libreta de Notas";
            subtitleEl.innerText = "Evaluaciones, Filtros por Alumno y Exportador a PDF";
            renderGradesView();
            break;
        case 'certificates':
            titleEl.innerText = "Generador de Certificados & Diplomas";
            subtitleEl.innerText = "Emisión e Impresión Oficial de Diplomas con Firma";
            renderCertificatesView();
            break;
        case 'workload':
            titleEl.innerText = "Asignación de Carga Académica";
            subtitleEl.innerText = "Selección de Niveles, Grados, Secciones y Cursos a Dictar";
            renderWorkloadView();
            break;
        case 'permissions':
            titleEl.innerText = "Matriz de Permisos por Rol";
            subtitleEl.innerText = "Configuración Dinámica de Accesos (Exclusivo Administrador)";
            renderPermissionsView();
            break;
        case 'sync':
            titleEl.innerText = "Estado de Sincronización Offline";
            subtitleEl.innerText = "Cola de Mutaciones y Eventos Locales PWA";
            renderSyncView();
            break;
    }

    if (window.lucide) lucide.createIcons();
}

/* ================= MATRIZ DE PERMISOS DINÁMICOS POR ROL ================= */
async function renderPermissionsView() {
    const viewContainer = document.getElementById('dynamic-content-view');
    viewContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
            <h2>Configuración de Permisos por Rol</h2>
            <button class="btn-primary" onclick="savePermissionsMatrix()">
                <i data-lucide="save"></i> Guardar Cambios en Permisos
            </button>
        </div>
        <div class="glass-panel data-table-container" style="margin-top:1rem;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Rol del Sistema</th>
                        <th style="text-align:center;">Ver Cursos</th>
                        <th style="text-align:center;">Editar Cursos</th>
                        <th style="text-align:center;">Eliminar Cursos</th>
                        <th style="text-align:center;">Ver Usuarios</th>
                        <th style="text-align:center;">Editar Usuarios</th>
                        <th style="text-align:center;">Eliminar Usuarios</th>
                        <th style="text-align:center;">Carga Académica</th>
                        <th style="text-align:center;">Ver Notas</th>
                        <th style="text-align:center;">Editar Notas</th>
                        <th style="text-align:center;">Eliminar Notas</th>
                    </tr>
                </thead>
                <tbody id="permissions-table-body">
                    <tr><td colspan="11" style="color:var(--text-muted);">Cargando matriz de permisos...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    if (window.lucide) lucide.createIcons();

    try {
        const res = await fetch('/api/v1/permissions/permissions', { headers: { 'Authorization': `Bearer ${authToken}` } });
        const data = await res.json();
        const perms = data.permissions;

        const rolesList = [
            { id: 'super_admin', name: 'Super Admin' },
            { id: 'school_admin', name: 'Director Colegio' },
            { id: 'staff', name: 'Personal Admin' },
            { id: 'teacher', name: 'Docente' },
            { id: 'parent', name: 'Apoderado' },
            { id: 'student', name: 'Alumno' }
        ];

        const tbody = document.getElementById('permissions-table-body');
        tbody.innerHTML = '';

        const keys = [
            'view_academic', 'edit_academic', 'delete_academic',
            'view_users', 'edit_users', 'delete_users', 'assign_workload',
            'view_grades', 'edit_grades', 'delete_grades'
        ];


        rolesList.forEach(r => {
            const rolePerms = perms[r.id] || {};
            const tr = document.createElement('tr');
            
            const cells = keys.map(k => `
                <td style="text-align:center;">
                    <input type="checkbox" class="perm-cb" data-role="${r.id}" data-key="${k}" ${rolePerms[k] ? 'checked' : ''}>
                </td>
            `).join('');

            tr.innerHTML = `<td><strong>${r.name}</strong></td>${cells}`;
            tbody.appendChild(tr);
        });

    } catch (e) {
        showToast("Error cargando permisos dinámicos", "error");
    }
}

async function savePermissionsMatrix() {
    const checkboxes = document.querySelectorAll('.perm-cb');
    const newPerms = {};

    checkboxes.forEach(cb => {
        const role = cb.getAttribute('data-role');
        const key = cb.getAttribute('data-key');
        if (!newPerms[role]) newPerms[role] = {};
        newPerms[role][key] = cb.checked;
    });

    try {
        const res = await fetch('/api/v1/permissions/permissions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ permissions: newPerms })
        });
        if (!res.ok) throw new Error("No se pudieron guardar los permisos");
        showToast("¡Matriz de permisos actualizada exitosamente!", "success");
    } catch (e) {
        showToast(e.message, "error");
    }
}


/* ================= 1. DASHBOARD VIEW ================= */
async function loadDashboardMetrics() {
    const viewContainer = document.getElementById('dynamic-content-view');
    viewContainer.innerHTML = `
        <div id="kpi-container" class="kpi-grid"></div>
        <div class="charts-grid">
            <div class="chart-card glass-panel">
                <h3 id="chart1-title" style="font-size: 1rem; color: var(--text-main);">Indicador Principal</h3>
                <div style="position: relative; height: 260px;"><canvas id="mainChart"></canvas></div>
            </div>
            <div class="chart-card glass-panel">
                <h3 id="chart2-title" style="font-size: 1rem; color: var(--text-main);">Análisis Secundario</h3>
                <div style="position: relative; height: 260px;"><canvas id="secondaryChart"></canvas></div>
            </div>
        </div>
    `;

    try {
        const res = await fetch('/api/v1/analytics/metrics', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        renderKPIs(data.kpis);
        renderCharts(data.charts);
    } catch (err) {
        showToast("Error al cargar métricas del dashboard", "error");
    }
}

function renderKPIs(kpis) {
    const container = document.getElementById('kpi-container');
    container.innerHTML = '';

    kpis.forEach(kpi => {
        const card = document.createElement('div');
        card.className = 'kpi-card glass-panel';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="kpi-title">${kpi.title}</span>
                <i data-lucide="trending-up" style="color:var(--accent-blue);"></i>
            </div>
            <div class="kpi-value gradient-text">${kpi.value}</div>
            <div class="kpi-change">${kpi.change}</div>
        `;
        container.appendChild(card);
    });
    if (window.lucide) lucide.createIcons();
}

function renderCharts(charts) {
    document.getElementById('chart1-title').innerText = charts.mainChart.title;
    const ctx1 = document.getElementById('mainChart').getContext('2d');
    if (mainChartInstance) mainChartInstance.destroy();

    mainChartInstance = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: charts.mainChart.labels,
            datasets: [{
                data: charts.mainChart.data,
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderRadius: 8
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    document.getElementById('chart2-title').innerText = charts.secondaryChart.title;
    const ctx2 = document.getElementById('secondaryChart').getContext('2d');
    if (secondaryChartInstance) secondaryChartInstance.destroy();

    secondaryChartInstance = new Chart(ctx2, {
        type: currentUser.role_id === 'student' ? 'radar' : 'doughnut',
        data: {
            labels: charts.secondaryChart.labels,
            datasets: [{
                data: charts.secondaryChart.data,
                backgroundColor: ['rgba(59, 130, 246, 0.7)', 'rgba(139, 92, 246, 0.7)', 'rgba(16, 185, 129, 0.7)', 'rgba(245, 158, 11, 0.7)']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// Función genérica para exportar cualquier arreglo de datos en formato Excel (.xlsx)
function exportToExcel(filename, data) {
    if (!window.XLSX) {
        showToast("Error: La librería de Excel no se ha cargado correctamente.", "error");
        return;
    }
    if (!data || data.length === 0) {
        showToast("No hay datos disponibles para exportar.", "error");
        return;
    }
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte");
    XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast(`Exportado correctamente a ${filename}.xlsx`, "success");
}

/* ================= 2. MÓDULO ACADÉMICO (EDITABLE, ELIMINABLE, BUSCABLE, EXPORTABLE XLSX) ================= */
async function renderAcademicView() {
    const viewContainer = document.getElementById('dynamic-content-view');
    viewContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
            <h2>Estructura Académica</h2>
            <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
                <input type="text" id="search-academic" class="form-input" placeholder="Buscar curso o nivel..." oninput="filterAcademicView()" style="width:220px;">
                <button class="btn-primary" onclick="openNewLevelModal()">
                    <i data-lucide="plus-circle"></i> Nuevo Nivel
                </button>
                <button class="btn-primary" style="background:linear-gradient(135deg, #10b981, #059669);" onclick="exportAcademicToExcel()">
                    <i data-lucide="file-spreadsheet"></i> Exportar XLSX
                </button>
            </div>
        </div>
        <div id="levels-list" style="display:flex; flex-direction:column; gap:1.5rem; margin-top:1rem;">
            <p style="color:var(--text-muted);">Cargando estructura...</p>
        </div>
    `;
    if (window.lucide) lucide.createIcons();

    try {
        const res = await fetch('/api/v1/academic/levels', { headers: { 'Authorization': `Bearer ${authToken}` } });
        globalLevels = await res.json();
        filterAcademicView();
    } catch (err) {
        showToast("Error al cargar niveles académicos", "error");
    }
}

function exportAcademicToExcel() {
    const exportData = [];
    globalLevels.forEach(lvl => {
        if (lvl.courses && lvl.courses.length > 0) {
            lvl.courses.forEach(c => {
                exportData.push({
                    "Nivel Académico": lvl.name,
                    "Orden Nivel": lvl.level_order,
                    "Código Curso": c.code,
                    "Nombre Curso": c.name
                });
            });
        } else {
            exportData.push({
                "Nivel Académico": lvl.name,
                "Orden Nivel": lvl.level_order,
                "Código Curso": "-",
                "Nombre Curso": "-"
            });
        }
    });
    exportToExcel("Estructura_Academica", exportData);
}

function filterAcademicView() {
    const query = (document.getElementById('search-academic')?.value || '').toLowerCase();
    const listEl = document.getElementById('levels-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const isSuperAdmin = !currentUser || currentUser.email === 'daviex14@gmail.com' || currentUser.role_id === 'super_admin';
    const canEditAcademic = isSuperAdmin || (myRolePermissions && myRolePermissions.edit_academic !== false);
    const canDeleteAcademic = isSuperAdmin || (myRolePermissions && myRolePermissions.delete_academic !== false);

    const filtered = globalLevels.filter(lvl => {
        const lvlMatch = lvl.name.toLowerCase().includes(query);
        const courseMatch = lvl.courses.some(c => c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query));
        return lvlMatch || courseMatch;
    });

    if (filtered.length === 0) {
        listEl.innerHTML = '<p style="color:var(--text-muted);">No se encontraron niveles ni cursos coincidentes.</p>';
        return;
    }

    filtered.forEach(lvl => {
        const card = document.createElement('div');
        card.className = 'glass-panel';
        card.style.padding = '1.5rem';

        const coursesList = lvl.courses.map(c => {
            const editCrsBtn = canEditAcademic ? `<button class="role-chip btn-edit" onclick="openEditCourseModal('${c.id}', '${c.name}', '${c.code}', '${c.grade || 'General'}', '${c.section || 'Sección A'}')"><i data-lucide="pencil" style="width:14px; height:14px;"></i> Editar</button>` : '';
            const deleteCrsBtn = canDeleteAcademic ? `<button class="role-chip btn-delete" onclick="deleteCourse('${c.id}')"><i data-lucide="trash-2" style="width:14px; height:14px;"></i> Eliminar</button>` : '';
            const lessonsBtn = `<button class="role-chip" style="background:rgba(6,182,212,0.2); color:#22d3ee; border:1px solid rgba(6,182,212,0.3);" onclick="openCourseLessonsModal('${c.id}', '${c.name}')"><i data-lucide="play-circle" style="width:14px; height:14px;"></i> Clases / Contenido</button>`;

            return `
                <tr style="border-bottom:1px solid var(--bg-card-border);">
                    <td style="padding:0.75rem 0.5rem; white-space:nowrap;"><strong>${c.code}</strong></td>
                    <td style="padding:0.75rem 0.5rem; white-space:nowrap;">${c.name}</td>
                    <td style="padding:0.75rem 0.5rem; white-space:nowrap;"><span class="role-chip" style="background:rgba(59,130,246,0.15); color:#60a5fa;">${c.grade || 'General'}</span></td>
                    <td style="padding:0.75rem 0.5rem; white-space:nowrap;"><span class="role-chip" style="background:rgba(16,185,129,0.15); color:#34d399;">${c.section || 'Sección A'}</span></td>
                    <td style="padding:0.75rem 0.5rem; text-align:right; white-space:nowrap;">
                        <div style="display:inline-flex; gap:0.35rem; align-items:center; justify-content:flex-end;">
                            ${lessonsBtn}
                            ${editCrsBtn}
                            ${deleteCrsBtn}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const editLvlBtn = canEditAcademic ? `
            <button class="role-chip btn-edit" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="openEditLevelModal('${lvl.id}', '${lvl.name}', ${lvl.level_order})">
                <i data-lucide="pencil" style="width:14px; height:14px;"></i> Editar Nivel
            </button>
        ` : '';

        const deleteLvlBtn = canDeleteAcademic ? `
            <button class="role-chip btn-delete" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="deleteLevel('${lvl.id}')">
                <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
        ` : '';

        const addCrsBtn = canEditAcademic ? `
            <button class="btn-primary" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="openNewCourseModal('${lvl.id}')">
                <i data-lucide="plus"></i> Curso
            </button>
        ` : '';


        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--bg-card-border); padding-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
                <h3 class="gradient-text"><i data-lucide="book-open" style="width:18px;"></i> ${lvl.name} (Orden: ${lvl.level_order})</h3>
                <div style="display:flex; gap:0.5rem;">
                    ${addCrsBtn}
                    ${editLvlBtn}
                    ${deleteLvlBtn}
                </div>
            </div>
            <div class="data-table-container">
                <table class="data-table" style="width:100%; text-align:left;">
                    <thead>
                        <tr style="color:var(--text-muted); font-size:0.85rem;">
                            <th>Código</th><th>Nombre de Curso</th><th>Grado</th><th>Sección</th><th style="text-align:right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>${coursesList || '<tr><td colspan="5" style="padding:0.5rem 0; color:var(--text-muted);">Sin cursos registrados.</td></tr>'}</tbody>
                </table>
            </div>
        `;
        listEl.appendChild(card);
    });
    if (window.lucide) lucide.createIcons();
}


function openNewLevelModal() {
    showModal("Crear Nuevo Nivel Académico", `
        <form id="new-level-form" style="display:flex; flex-direction:column; gap:1rem;">
            <div class="form-group"><label>Nombre del Nivel</label><input type="text" id="lvl-name" class="form-input" placeholder="Ej. Superior / Inicial" required></div>
            <div class="form-group"><label>Orden</label><input type="number" id="lvl-order" class="form-input" value="3" required></div>
            <button type="submit" class="btn-primary">Guardar Nivel</button>
        </form>
    `);
    document.getElementById('new-level-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('lvl-name').value;
        const level_order = parseInt(document.getElementById('lvl-order').value);
        try {
            await fetch('/api/v1/academic/levels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ name, level_order })
            });
            closeModal();
            showToast("Nivel académico creado", "success");
            renderAcademicView();
        } catch (err) { showToast(err.message, "error"); }
    };
}

function openEditLevelModal(id, currentName, currentOrder) {
    showModal("Editar Nivel Académico", `
        <form id="edit-level-form" style="display:flex; flex-direction:column; gap:1rem;">
            <div class="form-group"><label>Nombre del Nivel</label><input type="text" id="edit-lvl-name" class="form-input" value="${currentName}" required></div>
            <div class="form-group"><label>Orden de Jerarquía</label><input type="number" id="edit-lvl-order" class="form-input" value="${currentOrder}" required></div>
            <button type="submit" class="btn-primary">Actualizar Nivel</button>
        </form>
    `);
    document.getElementById('edit-level-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('edit-lvl-name').value;
        const level_order = parseInt(document.getElementById('edit-lvl-order').value);
        try {
            await fetch(`/api/v1/academic/levels/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ name, level_order })
            });
            closeModal();
            showToast("Nivel actualizado", "success");
            renderAcademicView();
        } catch (err) { showToast(err.message, "error"); }
    };
}

async function deleteLevel(id) {
    showConfirmModal("Eliminar Nivel Académico", "¿Deseas eliminar este nivel académico y todos sus cursos?", async () => {
        try {
            await fetch(`/api/v1/academic/levels/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            showToast("Nivel eliminado", "success");
            renderAcademicView();
        } catch (err) { showToast("Error al eliminar nivel", "error"); }
    });
}

function openNewCourseModal(levelId) {
    showModal("Agregar Curso", `
        <form id="new-course-form" style="display:flex; flex-direction:column; gap:1rem;">
            <div class="form-group"><label>Nombre del Curso</label><input type="text" id="crs-name" class="form-input" placeholder="Ej. Matemáticas" required></div>
            <div class="form-group"><label>Código</label><input type="text" id="crs-code" class="form-input" placeholder="Ej. MAT-101" required></div>
            <div class="form-group"><label>Grado</label><input type="text" id="crs-grade" class="form-input" placeholder="Ej. 1° Año / 5° Grado" required></div>
            <div class="form-group"><label>Sección</label><input type="text" id="crs-section" class="form-input" placeholder="Ej. Sección A" required></div>
            <button type="submit" class="btn-primary">Guardar Curso</button>
        </form>
    `);
    document.getElementById('new-course-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('crs-name').value;
        const code = document.getElementById('crs-code').value;
        const grade = document.getElementById('crs-grade').value;
        const section = document.getElementById('crs-section').value;
        try {
            await fetch('/api/v1/academic/courses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ level_id: levelId, name, code, grade, section })
            });
            closeModal();
            showToast("Curso agregado", "success");
            renderAcademicView();
        } catch (err) { showToast(err.message, "error"); }
    };
}

function openEditCourseModal(id, name, code, grade, section) {
    showModal("Editar Curso", `
        <form id="edit-course-form" style="display:flex; flex-direction:column; gap:1rem;">
            <div class="form-group"><label>Nombre del Curso</label><input type="text" id="edit-crs-name" class="form-input" value="${name}" required></div>
            <div class="form-group"><label>Código del Curso</label><input type="text" id="edit-crs-code" class="form-input" value="${code}" required></div>
            <div class="form-group"><label>Grado</label><input type="text" id="edit-crs-grade" class="form-input" value="${grade || ''}" required></div>
            <div class="form-group"><label>Sección</label><input type="text" id="edit-crs-section" class="form-input" value="${section || ''}" required></div>
            <button type="submit" class="btn-primary">Actualizar Curso</button>
        </form>
    `);
    document.getElementById('edit-course-form').onsubmit = async (e) => {
        e.preventDefault();
        const updatedName = document.getElementById('edit-crs-name').value;
        const updatedCode = document.getElementById('edit-crs-code').value;
        const updatedGrade = document.getElementById('edit-crs-grade').value;
        const updatedSection = document.getElementById('edit-crs-section').value;
        try {
            await fetch(`/api/v1/academic/courses/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ name: updatedName, code: updatedCode, grade: updatedGrade, section: updatedSection })
            });
            closeModal();
            showToast("Curso actualizado", "success");
            renderAcademicView();
        } catch (err) { showToast(err.message, "error"); }
    };
}

async function deleteCourse(id) {
    showConfirmModal("Eliminar Curso", "¿Deseas eliminar este curso?", async () => {
        try {
            await fetch(`/api/v1/academic/courses/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            showToast("Curso eliminado", "success");
            renderAcademicView();
        } catch (err) { showToast("Error al eliminar curso", "error"); }
    });
}

/* ================= GESTOR DE CLASES Y CONTENIDO DE CURSOS ================= */

async function deleteQuizItem(quizId, courseId, courseName) {
    showConfirmModal("Eliminar Quiz", "¿Deseas eliminar este quiz?", async () => {
        try {
            await fetch(`/api/v1/quizzes/${quizId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            showToast("Quiz eliminado", "success");
            openCourseLessonsModal(courseId, courseName);
        } catch(err) {
            showToast("Error al eliminar quiz", "error");
        }
    });
}

async function openCourseLessonsModal(courseId, courseName) {
    const isSuperAdmin = !currentUser || currentUser.email === 'daviex14@gmail.com' || currentUser.role_id === 'super_admin';
    const canEditAcademic = isSuperAdmin || (myRolePermissions && myRolePermissions.edit_academic !== false);

    showModal(`Aula Virtual, Clases & Quizzes: ${courseName}`, `
        <div style="display:flex; flex-direction:column; gap:1.25rem; width:100%; height:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; border-bottom:1px solid var(--bg-card-border); padding-bottom:0.75rem; flex-shrink:0;">
                <span style="font-size:0.9rem; color:var(--text-muted);">Clases y Quizzes interactivos publicados en esta materia:</span>
                <div style="display:flex; gap:0.5rem;">
                    <button class="role-chip" style="background:rgba(168,85,247,0.2); color:#c084fc; border:1px solid rgba(168,85,247,0.3); padding:0.4rem 0.8rem;" onclick="QuizLiveEngine.openPlayerJoinModal()">
                        <i data-lucide="gamepad-2" style="width:14px;"></i> Unirse a Quiz
                    </button>
                    ${canEditAcademic ? `
                        <button class="btn-primary" style="background:linear-gradient(135deg, #8b5cf6, #ec4899); padding:0.4rem 0.8rem; font-size:0.85rem;" onclick="QuizLiveEngine.openQuizWizard('${courseId}', '${courseName}')">
                            <i data-lucide="sparkles"></i> Añadir Quiz con IA
                        </button>
                        <button class="btn-primary" style="padding:0.4rem 0.8rem; font-size:0.85rem;" onclick="openNewLessonModal('${courseId}', '${courseName}')">
                            <i data-lucide="plus-circle"></i> Crear Nueva Clase
                        </button>
                    ` : ''}
                </div>
            </div>
            <div id="course-lessons-list" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:1.25rem; padding-right:0.3rem;">
                <p style="color:var(--text-muted); font-size:0.9rem;">Cargando contenido del curso...</p>
            </div>
        </div>
    `, 'full');

    try {
        const [resLessons, resQuizzes] = await Promise.all([
            fetch(`/api/v1/academic/courses/${courseId}/lessons`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
            fetch(`/api/v1/quizzes/courses/${courseId}`, { headers: { 'Authorization': `Bearer ${authToken}` } })
        ]);
        const lessons = await resLessons.json();
        const quizzes = resQuizzes.ok ? await resQuizzes.json() : [];
        renderCourseLessonsList(courseId, courseName, lessons, quizzes, canEditAcademic);
    } catch(e) {
        showToast("Error al cargar las clases del curso", "error");
    }
}

function getUniversalEmbedUrl(url) {
    if (!url) return null;
    let cleanUrl = url.trim();

    // Si el usuario ingresó directamente una etiqueta <iframe>
    if (cleanUrl.startsWith('<iframe')) {
        const match = cleanUrl.match(/src=["']([^"']+)["']/);
        if (match && match[1]) cleanUrl = match[1];
    }

    // 1. YouTube
    if (cleanUrl.includes('youtu.be/')) {
        const id = cleanUrl.split('youtu.be/')[1].split('?')[0].split('&')[0];
        return `https://www.youtube.com/embed/${id}`;
    }
    if (cleanUrl.includes('youtube.com/watch')) {
        const match = cleanUrl.match(/[?&]v=([^&]+)/);
        if (match && match[1]) return `https://www.youtube.com/embed/${match[1]}`;
    }
    if (cleanUrl.includes('youtube.com/embed/')) {
        return cleanUrl;
    }

    // 2. Vimeo
    if (cleanUrl.includes('vimeo.com/')) {
        const match = cleanUrl.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
        if (match && match[1]) return `https://player.vimeo.com/video/${match[1]}`;
    }

    // 3. Loom
    if (cleanUrl.includes('loom.com/share/')) {
        const id = cleanUrl.split('loom.com/share/')[1].split('?')[0];
        return `https://www.loom.com/embed/${id}`;
    }

    // 4. Google Drive Preview
    if (cleanUrl.includes('drive.google.com/file/d/')) {
        const id = cleanUrl.split('drive.google.com/file/d/')[1].split('/')[0];
        return `https://drive.google.com/file/d/${id}/preview`;
    }

    // 5. Dailymotion
    if (cleanUrl.includes('dailymotion.com/video/')) {
        const id = cleanUrl.split('dailymotion.com/video/')[1].split('?')[0];
        return `https://www.dailymotion.com/embed/video/${id}`;
    }

    // Fallback genérico para cualquier URL o iframe público
    return cleanUrl;
}

function renderCourseLessonsList(courseId, courseName, lessons = [], quizzes = [], canEditAcademic = false) {
    const listEl = document.getElementById('course-lessons-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if ((!lessons || lessons.length === 0) && (!quizzes || quizzes.length === 0)) {
        listEl.innerHTML = '<div style="padding:3rem; text-align:center; color:var(--text-muted);"><i data-lucide="sparkles" style="width:48px; height:48px; opacity:0.5;"></i><p style="margin-top:0.75rem; font-size:1rem;">No hay clases ni quizzes publicados aún para este curso.</p></div>';
        if (window.lucide) lucide.createIcons();
        return;
    }

    // 1. Renderizar Quizzes Interactivos
    quizzes.forEach(q => {
        const card = document.createElement('div');
        card.style.cssText = "background:linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.15)); border:1px solid rgba(168,85,247,0.3); border-radius:12px; padding:1.25rem; display:flex; flex-direction:column; gap:0.75rem;";
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.6rem;">
                <h4 style="color:var(--text-main); font-size:1.15rem; font-weight:700;"><i data-lucide="zap" style="width:20px; color:#facc15;"></i> QUIZ: ${q.title}</h4>
                <div style="display:flex; gap:0.5rem;">
                    ${canEditAcademic ? `
                        <button class="role-chip btn-edit" style="padding:0.4rem 0.8rem; font-size:0.85rem;" onclick="QuizLiveEngine.openEditQuizModal('${q.id}', '${courseId}', '${courseName}')">
                            <i data-lucide="pencil" style="width:14px;"></i> Editar
                        </button>
                        <button class="btn-primary" style="background:#10b981; padding:0.4rem 0.8rem; font-size:0.85rem;" onclick="QuizLiveEngine.startLiveSession('${q.id}')">
                            <i data-lucide="radio" style="width:14px;"></i> Transmitir en Vivo (QR)
                        </button>
                        <button class="role-chip btn-delete" onclick="deleteQuizItem('${q.id}', '${courseId}', '${courseName}')">
                            <i data-lucide="trash-2" style="width:14px;"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div style="display:flex; gap:1rem; font-size:0.85rem; color:var(--text-muted); flex-wrap:wrap;">
                <span><i data-lucide="help-circle" style="width:14px;"></i> ${q.questions.length} Preguntas</span>
                <span><i data-lucide="users" style="width:14px;"></i> Modo: ${q.mode === 'teams' ? 'Por Equipos' : 'Individual'}</span>
            </div>
        `;
        listEl.appendChild(card);
    });

    // 2. Renderizar Clases Teóricas
    lessons.forEach(l => {
        const embedUrl = getUniversalEmbedUrl(l.youtube_url);
        const card = document.createElement('div');
        card.style.cssText = "background:rgba(15,23,42,0.6); border:1px solid var(--bg-card-border); border-radius:12px; padding:1.5rem; display:flex; flex-direction:column; gap:1rem;";

        const editBtn = canEditAcademic ? `<button class="role-chip btn-edit" onclick="openEditLessonModal('${l.id}', '${courseId}', '${courseName}')"><i data-lucide="pencil" style="width:14px;"></i> Editar</button>` : '';
        const deleteBtn = canEditAcademic ? `<button class="role-chip btn-delete" onclick="deleteLesson('${l.id}', '${courseId}', '${courseName}')"><i data-lucide="trash-2" style="width:14px;"></i> Eliminar</button>` : '';

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.6rem;">
                <h4 style="color:var(--text-main); font-size:1.15rem; font-weight:600;"><i data-lucide="book-open-check" style="width:18px; color:var(--accent-blue);"></i> ${l.title}</h4>
                <div style="display:flex; gap:0.5rem;">
                    ${editBtn}
                    ${deleteBtn}
                </div>
            </div>
            ${embedUrl ? `
                <div style="position:relative; padding-bottom:50%; height:0; overflow:hidden; border-radius:10px; border:1px solid var(--bg-card-border);">
                    <iframe src="${embedUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" allowfullscreen></iframe>
                </div>
            ` : ''}
            ${l.content_html ? `
                <div style="font-size:0.95rem; color:var(--text-main); line-height:1.7; background:rgba(255,255,255,0.02); padding:1rem; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                    ${l.content_html}
                </div>
            ` : ''}
            <span style="font-size:0.75rem; color:var(--text-muted); align-self:flex-end;">Publicado: ${new Date(l.created_at || Date.now()).toLocaleDateString()}</span>
        `;
        listEl.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
}

async function deleteQuizItem(quizId, courseId, courseName) {
    showConfirmModal("Eliminar Quiz", "¿Deseas eliminar este quiz?", async () => {
        try {
            await fetch(`/api/v1/quizzes/${quizId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            showToast("Quiz eliminado", "success");
            openCourseLessonsModal(courseId, courseName);
        } catch(err) {
            showToast("Error al eliminar quiz", "error");
        }
    });
}

function openNewLessonModal(courseId, courseName) {
    showModal(`Crear Clase en: ${courseName}`, `
        <form id="new-lesson-form" style="display:flex; flex-direction:column; gap:1.25rem; width:100%; height:100%;">
            <div class="form-group" style="flex-shrink:0;">
                <label style="font-weight:600;">Título de la Clase / Tema</label>
                <input type="text" id="lsn-title" class="form-input" placeholder="Ej. Tema 1: Ecuaciones de Primer Grado" required>
            </div>
            <div class="form-group" style="flex-shrink:0;">
                <label style="font-weight:600;">URL o Código de Incrustación / Video (YouTube, Vimeo, Loom, Drive, etc.)</label>
                <input type="text" id="lsn-youtube" class="form-input" placeholder="Ej. https://youtube.com/watch?v=xxx, Vimeo, Loom o iframe">
            </div>
            
            <div class="form-group" style="flex:1; display:flex; flex-direction:column; min-height:0;">
                <label style="font-weight:600; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; margin-bottom:0.4rem;">
                    <span>Contenido Teórico de la Clase</span>
                    <span style="font-size:0.75rem; color:var(--text-muted);">Editor de Formato Rico</span>
                </label>
                <!-- Barra de Formato Editor HTML Integrada -->
                <div style="display:flex; gap:0.35rem; background:rgba(255,255,255,0.05); padding:0.5rem; border-radius:8px 8px 0 0; border:1px solid var(--bg-card-border); border-bottom:none; flex-wrap:wrap; flex-shrink:0;">
                    <button type="button" class="role-chip" onclick="execCmd('bold')"><b>B</b></button>
                    <button type="button" class="role-chip" onclick="execCmd('italic')"><i>I</i></button>
                    <button type="button" class="role-chip" onclick="execCmd('underline')"><u>U</u></button>
                    <button type="button" class="role-chip" onclick="execCmd('insertUnorderedList')">• Lista</button>
                    <button type="button" class="role-chip" onclick="execCmd('formatBlock', 'h3')">H3</button>
                    <button type="button" class="role-chip" onclick="execCmd('formatBlock', 'p')">Párrafo</button>
                </div>
                <div id="lsn-editor" contenteditable="true" style="flex:1; min-height:180px; overflow-y:auto; background:var(--bg-dark); color:var(--text-main); padding:1rem; border:1px solid var(--bg-card-border); border-radius:0 0 8px 8px; outline:none; font-size:0.95rem;">
                    Escribe aquí el contenido teórico, explicaciones o instrucciones de la clase...
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:0.75rem; flex-shrink:0; padding-top:0.5rem;">
                <button type="button" class="btn-primary" style="background:rgba(255,255,255,0.1); color:var(--text-muted);" onclick="openCourseLessonsModal('${courseId}', '${courseName}')">Volver</button>
                <button type="submit" class="btn-primary"><i data-lucide="save"></i> Publicar Clase</button>
            </div>
        </form>
    `, 'full');

    document.getElementById('new-lesson-form').onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('lsn-title').value;
        const youtube_url = document.getElementById('lsn-youtube').value;
        const content_html = document.getElementById('lsn-editor').innerHTML;

        try {
            const res = await fetch(`/api/v1/academic/courses/${courseId}/lessons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ title, youtube_url, content_html })
            });
            if (!res.ok) throw new Error("Error al publicar la clase");
            showToast("¡Clase publicada correctamente!", "success");
            openCourseLessonsModal(courseId, courseName);
        } catch(err) {
            showToast(err.message, "error");
        }
    };
}

function execCmd(command, value = null) {
    document.execCommand(command, false, value);
}

async function openEditLessonModal(lessonId, courseId, courseName) {
    let lesson = null;
    try {
        const res = await fetch(`/api/v1/academic/courses/${courseId}/lessons`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        const lessons = await res.json();
        lesson = lessons.find(l => l.id === lessonId);
    } catch(e) {}

    if (!lesson) return showToast("No se pudo cargar la clase", "error");

    showModal(`Editar Clase: ${lesson.title}`, `
        <form id="edit-lesson-form" style="display:flex; flex-direction:column; gap:1.25rem; width:100%; height:100%;">
            <div class="form-group" style="flex-shrink:0;">
                <label style="font-weight:600;">Título de la Clase</label>
                <input type="text" id="edit-lsn-title" class="form-input" value="${lesson.title}" required>
            </div>
            <div class="form-group" style="flex-shrink:0;">
                <label style="font-weight:600;">URL o Código de Incrustación / Video</label>
                <input type="text" id="edit-lsn-youtube" class="form-input" value="${lesson.youtube_url || ''}">
            </div>
            
            <div class="form-group" style="flex:1; display:flex; flex-direction:column; min-height:0;">
                <label style="font-weight:600; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; margin-bottom:0.4rem;">
                    <span>Contenido Teórico de la Clase</span>
                    <span style="font-size:0.75rem; color:var(--text-muted);">Editor de Formato Rico</span>
                </label>
                <div style="display:flex; gap:0.35rem; background:rgba(255,255,255,0.05); padding:0.5rem; border-radius:8px 8px 0 0; border:1px solid var(--bg-card-border); border-bottom:none; flex-wrap:wrap; flex-shrink:0;">
                    <button type="button" class="role-chip" onclick="execCmd('bold')"><b>B</b></button>
                    <button type="button" class="role-chip" onclick="execCmd('italic')"><i>I</i></button>
                    <button type="button" class="role-chip" onclick="execCmd('underline')"><u>U</u></button>
                    <button type="button" class="role-chip" onclick="execCmd('insertUnorderedList')">• Lista</button>
                    <button type="button" class="role-chip" onclick="execCmd('formatBlock', 'h3')">H3</button>
                    <button type="button" class="role-chip" onclick="execCmd('formatBlock', 'p')">Párrafo</button>
                </div>
                <div id="edit-lsn-editor" contenteditable="true" style="flex:1; min-height:180px; overflow-y:auto; background:var(--bg-dark); color:var(--text-main); padding:1rem; border:1px solid var(--bg-card-border); border-radius:0 0 8px 8px; outline:none; font-size:0.95rem;">
                    ${lesson.content_html || ''}
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:0.75rem; flex-shrink:0; padding-top:0.5rem;">
                <button type="button" class="btn-primary" style="background:rgba(255,255,255,0.1); color:var(--text-muted);" onclick="openCourseLessonsModal('${courseId}', '${courseName}')">Volver</button>
                <button type="submit" class="btn-primary"><i data-lucide="save"></i> Actualizar Clase</button>
            </div>
        </form>
    `, 'full');

    document.getElementById('edit-lesson-form').onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('edit-lsn-title').value;
        const youtube_url = document.getElementById('edit-lsn-youtube').value;
        const content_html = document.getElementById('edit-lsn-editor').innerHTML;

        try {
            const res = await fetch(`/api/v1/academic/lessons/${lessonId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ title, youtube_url, content_html })
            });
            if (!res.ok) throw new Error("Error al actualizar la clase");
            showToast("Clase actualizada correctamente", "success");
            openCourseLessonsModal(courseId, courseName);
        } catch(err) {
            showToast(err.message, "error");
        }
    };
}

async function deleteLesson(lessonId, courseId, courseName) {
    showConfirmModal("Eliminar Clase", "¿Deseas eliminar esta clase del curso?", async () => {
        try {
            await fetch(`/api/v1/academic/lessons/${lessonId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            showToast("Clase eliminada", "success");
            openCourseLessonsModal(courseId, courseName);
        } catch(err) {
            showToast("Error al eliminar clase", "error");
        }
    });
}

/* ================= 3. MÓDULO DE USUARIOS (EDITABLE, ELIMINABLE, BUSCABLE, EXPORTABLE XLSX) ================= */
async function renderUsersView() {
    const viewContainer = document.getElementById('dynamic-content-view');
    viewContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
            <h2>Directorio de Usuarios</h2>
            <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
                <input type="text" id="search-users" class="form-input" placeholder="Buscar por nombre o correo..." oninput="filterUsersView()" style="width:220px;">
                <button class="btn-primary" onclick="openNewUserModal()">
                    <i data-lucide="user-plus"></i> Registrar Usuario
                </button>
                <button class="btn-primary" style="background:linear-gradient(135deg, #10b981, #059669);" onclick="exportUsersToExcel()">
                    <i data-lucide="file-spreadsheet"></i> Exportar XLSX
                </button>
            </div>
        </div>
        <div class="glass-panel data-table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Correo Electrónico</th>
                        <th>Rol Asignado</th>
                        <th style="text-align:right;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="users-table-body">
                    <tr><td colspan="4" style="color:var(--text-muted);">Cargando usuarios...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    if (window.lucide) lucide.createIcons();

    try {
        const res = await fetch('/api/v1/users', { headers: { 'Authorization': `Bearer ${authToken}` } });
        globalUsers = await res.json();
        filterUsersView();
    } catch (err) {
        showToast("Error al cargar usuarios", "error");
    }
}

function exportUsersToExcel() {
    const exportData = globalUsers.map(u => ({
        "ID": u.id,
        "Nombre Completo": u.name,
        "Correo Electrónico": u.email,
        "Rol": u.role_name
    }));
    exportToExcel("Directorio_Usuarios", exportData);
}

function filterUsersView() {
    const query = (document.getElementById('search-users')?.value || '').toLowerCase();
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = globalUsers.filter(u => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query) || u.role_name.toLowerCase().includes(query));

    const isSuperAdmin = !currentUser || currentUser.email === 'daviex14@gmail.com' || currentUser.role_id === 'super_admin';
    const canEditUsers = isSuperAdmin || (myRolePermissions && myRolePermissions.edit_users !== false);
    const canDeleteUsers = isSuperAdmin || (myRolePermissions && myRolePermissions.delete_users !== false);
    const canAssignWorkload = isSuperAdmin || (myRolePermissions && myRolePermissions.assign_workload !== false);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);">No hay usuarios que coincidan con la búsqueda.</td></tr>';
        return;
    }

    filtered.forEach(u => {
        const tr = document.createElement('tr');
        
        let extraBtn = '';
        if (u.role_id === 'teacher' && canAssignWorkload) {
            extraBtn = `<button class="role-chip" style="background:rgba(59,130,246,0.25); color:#60a5fa;" onclick="openAssignTeacherCoursesModal('${u.id}', '${u.name}')"><i data-lucide="book-open" style="width:12px;"></i> Asignar Cursos</button>`;
        } else if (u.role_id === 'student' && canEditUsers) {
            extraBtn = `<button class="role-chip" style="background:rgba(139,92,246,0.25); color:#c084fc;" onclick="openAssignStudentAcademicModal('${u.id}', '${u.name}')"><i data-lucide="graduation-cap" style="width:12px;"></i> Asignar Ficha</button>`;
        } else if (u.role_id === 'parent' && canEditUsers) {
            extraBtn = `<button class="role-chip" style="background:rgba(16,185,129,0.25); color:#34d399;" onclick="openAssignParentStudentsModal('${u.id}', '${u.name}')"><i data-lucide="users" style="width:12px;"></i> Asignar Hijos</button>`;
        }


        let editBtn = canEditUsers ? `<button class="role-chip btn-edit" onclick="openEditUserModal('${u.id}', '${u.name}', '${u.email}', '${u.role_id}')"><i data-lucide="pencil" style="width:14px; height:14px;"></i> Editar</button>` : '';
        let deleteBtn = canDeleteUsers ? `<button class="role-chip btn-delete" onclick="deleteUser('${u.id}')"><i data-lucide="trash-2" style="width:14px; height:14px;"></i> Eliminar</button>` : '';

        let academicBadge = '';
        if (u.role_id === 'student' && (u.grade || u.section)) {
            academicBadge = `<br><span style="font-size:0.75rem; color:var(--text-muted);">${u.grade || ''} - ${u.section || ''}</span>`;
        }

        tr.innerHTML = `
            <td><strong>${u.name}</strong>${academicBadge}</td>
            <td>${u.email}</td>
            <td><span class="role-chip">${u.role_name}</span></td>
            <td style="text-align:right; display:flex; gap:0.35rem; justify-content:flex-end;">
                ${extraBtn}
                ${editBtn}
                ${deleteBtn}
            </td>
        `;
        tbody.appendChild(tr);
    });
    if (window.lucide) lucide.createIcons();
}


async function openAssignTeacherCoursesModal(teacherId, teacherName) {
    let coursesList = [];
    try {
        const res = await fetch('/api/v1/academic/levels', { headers: { 'Authorization': `Bearer ${authToken}` } });
        const levels = await res.json();
        levels.forEach(lvl => {
            if (lvl.courses) {
                lvl.courses.forEach(c => coursesList.push({ ...c, level_name: lvl.name }));
            }
        });
    } catch(e) {}

    const teacher = globalUsers.find(u => u.id === teacherId);
    const assignedIds = teacher ? (teacher.assigned_courses || []) : [];

    const checkboxes = coursesList.map(c => `
        <label style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem; border-bottom:1px solid var(--bg-card-border); cursor:pointer;">
            <input type="checkbox" class="teacher-course-cb" value="${c.id}" ${assignedIds.includes(c.id) ? 'checked' : ''}>
            <span><strong>${c.code}</strong> - ${c.name} (${c.level_name})</span>
        </label>
    `).join('');

    showModal(`Asignar Cursos a Docente: ${teacherName}`, `
        <div style="display:flex; flex-direction:column; gap:1rem;">
            <p style="font-size:0.85rem; color:var(--text-muted);">Selecciona los cursos/niveles que dictará este docente:</p>
            <div style="max-height:240px; overflow-y:auto; border:1px solid var(--bg-card-border); border-radius:8px; padding:0.5rem;">
                ${checkboxes || '<p style="padding:0.5rem; color:var(--text-muted);">No hay cursos creados.</p>'}
            </div>
            <button class="btn-primary" onclick="saveTeacherCourses('${teacherId}')">Guardar Asignación</button>
        </div>
    `);
}

async function saveTeacherCourses(teacherId) {
    const course_ids = Array.from(document.querySelectorAll('.teacher-course-cb:checked')).map(cb => cb.value);
    try {
        const res = await fetch('/api/v1/users/assign-teacher-courses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ teacher_id: teacherId, course_ids })
        });
        if (!res.ok) throw new Error("Error al asignar cursos");
        closeModal();
        showToast("Cursos asignados al docente correctamente", "success");
        renderUsersView();
    } catch (err) { showToast(err.message, "error"); }
}

let studentModalLevels = [];

async function openAssignStudentAcademicModal(studentId, studentName) {
    const student = globalUsers.find(u => u.id === studentId);
    const assignedCourses = student ? (student.student_courses || []) : [];

    try {
        const res = await fetch('/api/v1/academic/levels', { headers: { 'Authorization': `Bearer ${authToken}` } });
        studentModalLevels = await res.json();
    } catch (e) {
        studentModalLevels = [];
    }

    const levelOptions = studentModalLevels.map(lvl => `
        <option value="${lvl.id}" ${student && student.level_id === lvl.id ? 'selected' : ''}>${lvl.name}</option>
    `).join('');

    showModal(`Asignar Ficha Académica a Alumno: ${studentName}`, `
        <div style="display:flex; flex-direction:column; gap:1.2rem; width:100%;">
            <div class="form-group">
                <label style="font-weight:600; margin-bottom:0.35rem; display:block;">Nivel Académico</label>
                <select id="st-modal-level" class="form-select" style="width:100%;" onchange="onStudentModalLevelChange()">
                    <option value="">-- Seleccionar Nivel --</option>
                    ${levelOptions}
                </select>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                <div class="form-group">
                    <label style="font-weight:600; margin-bottom:0.35rem; display:block;">Grado</label>
                    <select id="st-modal-grade" class="form-select" style="width:100%;" onchange="updateStudentCoursesOptions()">
                        <option value="">-- Seleccionar Grado --</option>
                    </select>
                </div>
                <div class="form-group">
                    <label style="font-weight:600; margin-bottom:0.35rem; display:block;">Sección</label>
                    <select id="st-modal-section" class="form-select" style="width:100%;" onchange="updateStudentCoursesOptions()">
                        <option value="">-- Seleccionar Sección --</option>
                    </select>
                </div>
            </div>

            <div style="border-top:1px solid var(--bg-card-border); padding-top:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                    <label style="font-weight:600; font-size:0.95rem; color:var(--text-main);">Cursos a Dictar / Llevar por el Alumno:</label>
                    <span id="st-modal-course-count" style="font-size:0.75rem; color:var(--accent-blue); font-weight:600;">0 cursos</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">
                    Se filtran y marcan automáticamente según el Nivel, Grado y Sección seleccionados. Puedes ajustar libremente:
                </p>
                <div id="st-modal-courses-container" style="max-height:220px; overflow-y:auto; border:1px solid var(--bg-card-border); border-radius:10px; padding:0.75rem; background:rgba(15,23,42,0.5); display:flex; flex-direction:column; gap:0.5rem; width:100%;">
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:0.5rem;">
                <button type="button" class="btn-primary" style="background:rgba(255,255,255,0.1); color:var(--text-muted);" onclick="closeModal()">Cancelar</button>
                <button type="button" class="btn-primary" onclick="saveStudentAcademic('${studentId}')">Guardar Ficha del Alumno</button>
            </div>
        </div>
    `, true);

    // Guardar selección inicial de cursos asignados
    window._initialStudentCourses = assignedCourses;
    window._currentStudentData = student;
    onStudentModalLevelChange();
}

function onStudentModalLevelChange() {
    const levelId = document.getElementById('st-modal-level')?.value;
    const gradeSelect = document.getElementById('st-modal-grade');
    const sectionSelect = document.getElementById('st-modal-section');
    if (!gradeSelect || !sectionSelect) return;

    const student = window._currentStudentData;

    // Obtener los grados y secciones únicos existentes en los cursos de este nivel (o global si no hay nivel seleccionado)
    let availableCourses = [];
    studentModalLevels.forEach(lvl => {
        if (!levelId || lvl.id === levelId) {
            (lvl.courses || []).forEach(c => availableCourses.push(c));
        }
    });

    const uniqueGrades = Array.from(new Set(availableCourses.map(c => c.grade || 'General'))).sort();
    const uniqueSections = Array.from(new Set(availableCourses.map(c => c.section || 'Sección A'))).sort();

    gradeSelect.innerHTML = '<option value="">-- Todos los Grados --</option>' + uniqueGrades.map(g => `
        <option value="${g}" ${student && student.grade === g ? 'selected' : ''}>${g}</option>
    `).join('');

    sectionSelect.innerHTML = '<option value="">-- Todas las Secciones --</option>' + uniqueSections.map(s => `
        <option value="${s}" ${student && student.section === s ? 'selected' : ''}>${s}</option>
    `).join('');

    updateStudentCoursesOptions();
}

function updateStudentCoursesOptions() {
    const levelId = document.getElementById('st-modal-level')?.value;
    const grade = (document.getElementById('st-modal-grade')?.value || '').toLowerCase().trim();
    const section = (document.getElementById('st-modal-section')?.value || '').toLowerCase().trim();
    const container = document.getElementById('st-modal-courses-container');
    const countEl = document.getElementById('st-modal-course-count');
    if (!container) return;

    container.innerHTML = '';
    const initialAssigned = window._initialStudentCourses || [];

    let availableCourses = [];
    studentModalLevels.forEach(lvl => {
        if (!levelId || lvl.id === levelId) {
            (lvl.courses || []).forEach(c => {
                availableCourses.push({ ...c, level_name: lvl.name });
            });
        }
    });

    if (availableCourses.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem; text-align:center;">No hay cursos registrados en el nivel seleccionado.</p>';
        if (countEl) countEl.innerText = '0 cursos';
        return;
    }

    let displayedCount = 0;
    availableCourses.forEach(c => {
        const cGrade = (c.grade || '').toLowerCase().trim();
        const cSection = (c.section || '').toLowerCase().trim();

        // Coincidencia exacta o parcial si el usuario ha seleccionado filtro de grado o sección
        const matchesGrade = !grade || cGrade === grade;
        const matchesSection = !section || cSection === section;
        const matchesBothFilters = matchesGrade && matchesSection;

        const isChecked = initialAssigned.includes(c.id) || (matchesBothFilters && (grade !== '' || section !== ''));

        if (matchesBothFilters || initialAssigned.includes(c.id)) {
            displayedCount++;
            const label = document.createElement('label');
            label.style.cssText = "display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:0.6rem 0.85rem; background:rgba(255,255,255,0.03); border:1px solid var(--bg-card-border); border-radius:8px; cursor:pointer; width:100%; transition:background 0.2s ease;";
            label.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.75rem; flex:1; min-width:0;">
                    <input type="checkbox" class="student-course-cb" value="${c.id}" ${isChecked ? 'checked' : ''} style="transform:scale(1.2); flex-shrink:0;">
                    <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="font-weight:600; color:var(--text-main); font-size:0.9rem;">${c.name}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted); margin-left:0.5rem;">(${c.code})</span>
                    </div>
                </div>
                <div style="display:flex; gap:0.4rem; flex-shrink:0;">
                    <span class="role-chip" style="font-size:0.7rem; background:rgba(59,130,246,0.15); color:#60a5fa; border:none; padding:0.2rem 0.5rem;">${c.grade || 'General'}</span>
                    <span class="role-chip" style="font-size:0.7rem; background:rgba(16,185,129,0.15); color:#34d399; border:none; padding:0.2rem 0.5rem;">${c.section || 'Sección A'}</span>
                </div>
            `;
            container.appendChild(label);
        }
    });

    if (countEl) countEl.innerText = `${displayedCount} cursos disponibles`;
}

async function saveStudentAcademic(studentId) {
    const level_id = document.getElementById('st-modal-level').value;
    const grade = document.getElementById('st-modal-grade').value;
    const section = document.getElementById('st-modal-section').value;
    const course_ids = Array.from(document.querySelectorAll('.student-course-cb:checked')).map(cb => cb.value);

    try {
        const res = await fetch('/api/v1/users/assign-student-academic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ student_id: studentId, level_id, grade, section, course_ids })
        });
        if (!res.ok) throw new Error("Error actualizando la ficha del alumno");
        closeModal();
        showToast("Ficha académica del alumno guardada exitosamente", "success");
        renderUsersView();
    } catch (err) {
        showToast(err.message, "error");
    }
}

function openAssignParentStudentsModal(parentId, parentName) {
    const students = globalUsers.filter(u => u.role_id === 'student');
    const parent = globalUsers.find(u => u.id === parentId);
    const assignedIds = parent ? (parent.assigned_students || []) : [];

    const checkboxes = students.map(s => `
        <label style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem; border-bottom:1px solid var(--bg-card-border); cursor:pointer;">
            <input type="checkbox" class="parent-student-cb" value="${s.id}" ${assignedIds.includes(s.id) ? 'checked' : ''}>
            <span><strong>${s.name}</strong> (${s.email})</span>
        </label>
    `).join('');

    showModal(`Asignar Hijos a Apoderado: ${parentName}`, `
        <div style="display:flex; flex-direction:column; gap:1rem;">
            <p style="font-size:0.85rem; color:var(--text-muted);">Selecciona los alumnos a cargo de este apoderado:</p>
            <div style="max-height:240px; overflow-y:auto; border:1px solid var(--bg-card-border); border-radius:8px; padding:0.5rem;">
                ${checkboxes || '<p style="padding:0.5rem; color:var(--text-muted);">No hay alumnos registrados.</p>'}
            </div>
            <button class="btn-primary" onclick="saveParentStudents('${parentId}')">Guardar Asignación</button>
        </div>
    `);
}

async function saveParentStudents(parentId) {
    const student_ids = Array.from(document.querySelectorAll('.parent-student-cb:checked')).map(cb => cb.value);
    try {
        const res = await fetch('/api/v1/users/assign-parent-students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ parent_id: parentId, student_ids })
        });
        if (!res.ok) throw new Error("Error al asignar alumnos");
        closeModal();
        showToast("Hijos asignados al apoderado correctamente", "success");
        renderUsersView();
    } catch (err) { showToast(err.message, "error"); }
}


async function openNewUserModal() {
    let levels = [];
    try {
        const res = await fetch('/api/v1/academic/levels', { headers: { 'Authorization': `Bearer ${authToken}` } });
        levels = await res.json();
    } catch (e) {
        levels = [];
    }

    const levelOptions = levels.map(l => `<option value="${l.id}">${l.name}</option>`).join('');

    showModal("Registrar Nuevo Usuario", `
        <form id="new-user-form" style="display:flex; flex-direction:column; gap:1rem; width:100%;">
            <div class="form-group"><label>Nombre Completo</label><input type="text" id="usr-name" class="form-input" required></div>
            <div class="form-group"><label>Correo Electrónico</label><input type="email" id="usr-email" class="form-input" required></div>
            <div class="form-group"><label>Contraseña</label><input type="password" id="usr-password" class="form-input" required></div>
            <div class="form-group">
                <label>Rol de Usuario</label>
                <select id="usr-role" class="form-select" onchange="toggleStudentAcademicFields(this.value)">
                    <option value="student">Alumno</option>
                    <option value="teacher">Docente</option>
                    <option value="staff">Personal Administrativo</option>
                    <option value="parent">Apoderado</option>
                </select>
            </div>

            <!-- Campos Académicos Exclusivos para Registro de Alumno -->
            <div id="student-registration-fields" style="display:flex; flex-direction:column; gap:0.85rem; background:rgba(255,255,255,0.02); border:1px solid var(--bg-card-border); border-radius:10px; padding:1rem;">
                <span style="font-weight:600; font-size:0.85rem; color:var(--accent-blue);">Ficha de Matrícula (Para Alumnos)</span>
                <div class="form-group">
                    <label>Nivel Académico</label>
                    <select id="usr-student-level" class="form-select" onchange="onNewUserLevelChange()">
                        <option value="">-- Seleccionar Nivel --</option>
                        ${levelOptions}
                    </select>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
                    <div class="form-group">
                        <label>Grado</label>
                        <select id="usr-student-grade" class="form-select">
                            <option value="">-- Seleccionar Grado --</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Sección</label>
                        <select id="usr-student-section" class="form-select">
                            <option value="">-- Seleccionar Sección --</option>
                        </select>
                    </div>
                </div>
            </div>

            <button type="submit" class="btn-primary">Guardar Usuario</button>
        </form>
    `, true);

    window._newUserLevels = levels;
    toggleStudentAcademicFields('student');

    document.getElementById('new-user-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('usr-name').value;
        const email = document.getElementById('usr-email').value;
        const password = document.getElementById('usr-password').value;
        const role_id = document.getElementById('usr-role').value;
        
        let level_id = null;
        let grade = null;
        let section = null;

        if (role_id === 'student') {
            level_id = document.getElementById('usr-student-level').value;
            grade = document.getElementById('usr-student-grade').value;
            section = document.getElementById('usr-student-section').value;
        }

        try {
            await fetch('/api/v1/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ name, email, password, role_id, level_id, grade, section })
            });
            closeModal();
            showToast("¡Usuario registrado exitosamente con sus cursos cargados!", "success");
            renderUsersView();
        } catch (err) { showToast(err.message, "error"); }
    };
}

function toggleStudentAcademicFields(roleId) {
    const container = document.getElementById('student-registration-fields');
    if (!container) return;
    if (roleId === 'student') {
        container.style.display = 'flex';
        onNewUserLevelChange();
    } else {
        container.style.display = 'none';
    }
}

function onNewUserLevelChange() {
    const levelId = document.getElementById('usr-student-level')?.value;
    const gradeSelect = document.getElementById('usr-student-grade');
    const sectionSelect = document.getElementById('usr-student-section');
    if (!gradeSelect || !sectionSelect) return;

    const levels = window._newUserLevels || [];

    let availableCourses = [];
    levels.forEach(lvl => {
        if (!levelId || lvl.id === levelId) {
            (lvl.courses || []).forEach(c => availableCourses.push(c));
        }
    });

    const uniqueGrades = Array.from(new Set(availableCourses.map(c => c.grade || 'General'))).sort();
    const uniqueSections = Array.from(new Set(availableCourses.map(c => c.section || 'Sección A'))).sort();

    gradeSelect.innerHTML = '<option value="">-- Todos los Grados --</option>' + uniqueGrades.map(g => `
        <option value="${g}">${g}</option>
    `).join('');

    sectionSelect.innerHTML = '<option value="">-- Todas las Secciones --</option>' + uniqueSections.map(s => `
        <option value="${s}">${s}</option>
    `).join('');
}

function openEditUserModal(id, currentName, currentEmail, currentRole) {
    showModal("Editar Usuario", `
        <form id="edit-user-form" style="display:flex; flex-direction:column; gap:1rem;">
            <div class="form-group"><label>Nombre Completo</label><input type="text" id="edit-usr-name" class="form-input" value="${currentName}" required></div>
            <div class="form-group"><label>Correo Electrónico</label><input type="email" id="edit-usr-email" class="form-input" value="${currentEmail}" required></div>
            <div class="form-group"><label>Rol</label>
                <select id="edit-usr-role" class="form-select">
                    <option value="student" ${currentRole === 'student' ? 'selected' : ''}>Alumno</option>
                    <option value="teacher" ${currentRole === 'teacher' ? 'selected' : ''}>Docente</option>
                    <option value="staff" ${currentRole === 'staff' ? 'selected' : ''}>Personal Administrativo</option>
                    <option value="parent" ${currentRole === 'parent' ? 'selected' : ''}>Apoderado</option>
                    <option value="school_admin" ${currentRole === 'school_admin' ? 'selected' : ''}>Director Colegio</option>
                </select>
            </div>
            <button type="submit" class="btn-primary">Actualizar Usuario</button>
        </form>
    `);
    document.getElementById('edit-user-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('edit-usr-name').value;
        const email = document.getElementById('edit-usr-email').value;
        const role_id = document.getElementById('edit-usr-role').value;
        try {
            await fetch(`/api/v1/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ name, email, role_id })
            });
            closeModal();
            showToast("Usuario actualizado", "success");
            renderUsersView();
        } catch (err) { showToast(err.message, "error"); }
    };
}

async function deleteUser(id) {
    showConfirmModal("Eliminar Usuario", "¿Eliminar este usuario del sistema?", async () => {
        try {
            await fetch(`/api/v1/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            showToast("Usuario eliminado", "success");
            renderUsersView();
        } catch (err) { showToast("Error al eliminar usuario", "error"); }
    });
}

/* ================= 4. MÓDULO DE CALIFICACIONES Y LIBRETA DE NOTAS INDIVIDUAL / MASIVA (EXPORTABLE XLSX) ================= */

async function deleteGrade(id) {
    showConfirmModal("Eliminar Nota", "¿Eliminar este registro de nota?", async () => {
        try {
            await fetch(`/api/v1/grades/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            showToast("Nota eliminada", "success");
            renderGradesView();
        } catch (err) { showToast("Error al eliminar nota", "error"); }
    });
}

/* ================= 4. MÓDULO DE CALIFICACIONES Y LIBRETA DE NOTAS INDIVIDUAL / MASIVA (EXPORTABLE XLSX) ================= */
async function renderGradesView() {
    const viewContainer = document.getElementById('dynamic-content-view');

    const isSuperAdmin = !currentUser || currentUser.email === 'daviex14@gmail.com' || currentUser.role_id === 'super_admin';
    const canEditGrades = isSuperAdmin || (myRolePermissions && myRolePermissions.edit_grades !== false);
    const evalBtn = canEditGrades ? `<button class="btn-primary" onclick="openNewGradeModal()"><i data-lucide="edit-3"></i> Evaluar Alumno</button>` : '';

    viewContainer.innerHTML = `

        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
            <h2>Calificaciones & Libretas de Notas</h2>
            <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
                <input type="text" id="search-grades" class="form-input" placeholder="Buscar por Alumno o Curso..." oninput="filterGradesView()" style="width:200px;">
                ${evalBtn}
                <button class="btn-primary" style="background:linear-gradient(135deg, #10b981, #059669);" onclick="openBulkReportModal()">
                    <i data-lucide="file-text"></i> Generar Libretas (PDF)
                </button>
                <button class="btn-primary" style="background:linear-gradient(135deg, #059669, #047857);" onclick="exportGradesToExcel()">
                    <i data-lucide="file-spreadsheet"></i> Exportar XLSX
                </button>
            </div>
        </div>

        <div class="glass-panel data-table-container">
            <table class="data-table" id="printable-grades-table">
                <thead>
                    <tr>
                        <th>Alumno</th>
                        <th>Curso</th>
                        <th>Periodo</th>
                        <th>Nota</th>
                        <th>Observaciones</th>
                        <th style="text-align:right;">${canEditGrades ? 'Acciones' : 'Estado'}</th>
                    </tr>
                </thead>
                <tbody id="grades-table-body">
                    <tr><td colspan="6" style="color:var(--text-muted);">Cargando libreta de notas...</td></tr>
                </tbody>
            </table>
        </div>
        
        <!-- Área Oculta para Renderizado e Impresión Masiva de Libretas Individuales -->
        <div id="bulk-report-cards-print-area" class="print-only-area"></div>
    `;
    if (window.lucide) lucide.createIcons();

    try {
        const resUsers = await fetch('/api/v1/users', { headers: { 'Authorization': `Bearer ${authToken}` } });
        globalUsers = await resUsers.json();

        const resGrades = await fetch('/api/v1/grades', { headers: { 'Authorization': `Bearer ${authToken}` } });
        globalGrades = await resGrades.json();
        filterGradesView();
    } catch (err) {
        showToast("Error cargando calificaciones", "error");
    }
}

function exportGradesToExcel() {
    const exportData = globalGrades.map(g => ({
        "ID Nota": g.id,
        "Alumno": g.student_name,
        "Curso / Materia": g.course_name,
        "Docente": g.teacher_name,
        "Periodo": g.term,
        "Calificación": g.score,
        "Observaciones": g.comments || "-"
    }));
    exportToExcel("Registro_Calificaciones", exportData);
}

function filterGradesView() {
    const query = (document.getElementById('search-grades')?.value || '').toLowerCase();
    const tbody = document.getElementById('grades-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = globalGrades.filter(g => g.student_name.toLowerCase().includes(query) || g.course_name.toLowerCase().includes(query));
    
    const isSuperAdmin = !currentUser || currentUser.email === 'daviex14@gmail.com' || currentUser.role_id === 'super_admin';
    const canEditGrades = isSuperAdmin || (myRolePermissions && myRolePermissions.edit_grades !== false);
    const canDeleteGrades = isSuperAdmin || (myRolePermissions && myRolePermissions.delete_grades !== false);



    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);">No hay calificaciones que coincidan.</td></tr>';
        return;
    }

    filtered.forEach(g => {
        const tr = document.createElement('tr');
        
        let editBtn = canEditGrades ? `<button class="role-chip btn-edit" onclick="openEditGradeModal('${g.id}', ${g.score}, '${g.comments || ''}')"><i data-lucide="pencil" style="width:14px; height:14px;"></i> Editar</button>` : '';
        let deleteBtn = canDeleteGrades ? `<button class="role-chip btn-delete" onclick="deleteGrade('${g.id}')"><i data-lucide="trash-2" style="width:14px; height:14px;"></i> Eliminar</button>` : '';

        let actionCell = `${editBtn} ${deleteBtn}`;
        if (!canEditGrades && !canDeleteGrades) {
            actionCell = `<span style="color:var(--success); font-size:0.8rem;">● Registrado</span>`;
        }

        tr.innerHTML = `
            <td><strong>${g.student_name}</strong></td>
            <td>${g.course_name}</td>
            <td>${g.term}</td>
            <td><span style="font-weight:bold; color:${g.score >= 11 ? '#10b981' : '#ef4444'}">${g.score} / 20</span></td>
            <td style="color:var(--text-muted); font-size:0.85rem;">${g.comments || '-'}</td>
            <td style="text-align:right;">${actionCell}</td>
        `;
        tbody.appendChild(tr);
    });
    if (window.lucide) lucide.createIcons();
}


function openBulkReportModal() {
    const students = globalUsers.filter(u => u.role_id === 'student');
    const checkboxes = students.map(s => `
        <label style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem; border-bottom:1px solid var(--bg-card-border); cursor:pointer;">
            <input type="checkbox" class="student-checkbox" value="${s.id}" checked>
            <span><strong>${s.name}</strong> (${s.email})</span>
        </label>
    `).join('');

    showModal("Generador Masivo de Libretas de Notas", `
        <div style="display:flex; flex-direction:column; gap:1rem;">
            <p style="font-size:0.85rem; color:var(--text-muted);">Selecciona los alumnos para los cuales deseas generar la Libreta de Notas Individual:</p>
            <div style="max-height:220px; overflow-y:auto; border:1px solid var(--bg-card-border); border-radius:8px; padding:0.5rem;">
                ${checkboxes || '<p style="padding:0.5rem; color:var(--text-muted);">No hay alumnos registrados.</p>'}
            </div>
            <button class="btn-primary" onclick="generateSelectedReportCards()">
                <i data-lucide="printer"></i> Imprimir Libretas Seleccionadas
            </button>
        </div>
    `);
}

function generateSelectedReportCards() {
    const selectedIds = Array.from(document.querySelectorAll('.student-checkbox:checked')).map(cb => cb.value);
    if (selectedIds.length === 0) {
        showToast("Por favor selecciona al menos un alumno.", "error");
        return;
    }

    const printArea = document.getElementById('bulk-report-cards-print-area');
    printArea.innerHTML = '';

    selectedIds.forEach(studentId => {
        const student = globalUsers.find(u => u.id === studentId) || { name: 'Alumno' };
        const studentGrades = globalGrades.filter(g => g.student_id === studentId);
        
        let totalScore = 0;
        const rows = studentGrades.map(g => {
            totalScore += g.score;
            return `
                <tr>
                    <td style="padding:8px; border:1px solid #ddd;">${g.course_name}</td>
                    <td style="padding:8px; border:1px solid #ddd; text-align:center;">${g.term}</td>
                    <td style="padding:8px; border:1px solid #ddd; text-align:center; font-weight:bold;">${g.score}</td>
                    <td style="padding:8px; border:1px solid #ddd;">${g.comments || '-'}</td>
                </tr>
            `;
        }).join('');

        const avg = studentGrades.length > 0 ? (totalScore / studentGrades.length).toFixed(2) : '0.00';

        const reportHtml = `
            <div class="individual-report-page" style="page-break-after: always; padding:2rem; background:#fff; color:#000; font-family:sans-serif; margin-bottom:2rem; border:1px solid #ccc;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e3a8a; padding-bottom:1rem; margin-bottom:1.5rem;">
                    <div>
                        <h2 style="margin:0; color:#1e3a8a;">COLEGIO CENTRAL ACADEMICONTROL</h2>
                        <p style="margin:0.25rem 0 0 0; font-size:0.85rem; color:#475569;">FICHA DE INFORME ACADÉMICO / LIBRETA DE NOTAS INDIVIDUAL</p>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.8rem; color:#64748b;">Año Lectivo: 2026</span>
                    </div>
                </div>

                <div style="margin-bottom:1.5rem; background:#f8fafc; padding:1rem; border-radius:8px; border:1px solid #e2e8f0;">
                    <p style="margin:0.25rem 0;"><strong>Estudiante:</strong> ${student.name}</p>
                    <p style="margin:0.25rem 0;"><strong>Código ID:</strong> ${studentId}</p>
                    <p style="margin:0.25rem 0;"><strong>Promedio Ponderado:</strong> <span style="color:#1e40af; font-size:1.1rem; font-weight:bold;">${avg} / 20</span></p>
                </div>

                <table style="width:100%; border-collapse:collapse; margin-bottom:2rem;">
                    <thead>
                        <tr style="background:#f1f5f9; color:#1e293b;">
                            <th style="padding:8px; border:1px solid #ddd; text-align:left;">Asignatura / Curso</th>
                            <th style="padding:8px; border:1px solid #ddd;">Periodo</th>
                            <th style="padding:8px; border:1px solid #ddd;">Nota Final</th>
                            <th style="padding:8px; border:1px solid #ddd; text-align:left;">Observaciones Docente</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="4" style="padding:1rem; text-align:center; color:#64748b;">Sin calificaciones registradas para este periodo.</td></tr>'}</tbody>
                </table>

                <div style="display:flex; justify-content:space-between; margin-top:4rem; padding-top:1rem; font-size:0.8rem; color:#475569;">
                    <div style="text-align:center;"><span>__________________________________</span><br>Profesor Tutor / Asesor</div>
                    <div style="text-align:center;"><span>__________________________________</span><br>Firma Dirección Académica</div>
                </div>
            </div>
        `;
        printArea.innerHTML += reportHtml;
    });

    closeModal();
    window.print();
}

function openNewGradeModal() {
    const studentOptions = globalUsers.filter(u => u.role_id === 'student').map(s => `<option value="${s.id}">${s.name} (${s.email})</option>`).join('');

    showModal("Registrar Calificación", `
        <form id="new-grade-form" style="display:flex; flex-direction:column; gap:1rem;">
            <div class="form-group">
                <label>Seleccionar Alumno</label>
                <select id="grd-student" class="form-select">${studentOptions || '<option value="usr_student">Lucía Fernández</option>'}</select>
            </div>
            <div class="form-group">
                <label>Curso</label>
                <select id="grd-course" class="form-select">
                    <option value="crs_mat">Matemáticas Avanzadas</option>
                    <option value="crs_fis">Física Aplicada</option>
                    <option value="crs_qui">Química Orgánica</option>
                </select>
            </div>
            <div class="form-group">
                <label>Calificación (0 - 20)</label>
                <input type="number" step="0.5" id="grd-score" class="form-input" min="0" max="20" value="18" required>
            </div>
            <div class="form-group">
                <label>Comentario</label>
                <input type="text" id="grd-comments" class="form-input" placeholder="Observaciones del docente">
            </div>
            <button type="submit" class="btn-primary">Guardar Nota</button>
        </form>
    `);

    document.getElementById('new-grade-form').onsubmit = async (e) => {
        e.preventDefault();
        const student_id = document.getElementById('grd-student').value;
        const course_id = document.getElementById('grd-course').value;
        const score = document.getElementById('grd-score').value;
        const comments = document.getElementById('grd-comments').value;

        try {
            await fetch('/api/v1/grades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ student_id, course_id, score, comments })
            });
            closeModal();
            showToast("Calificación guardada correctamente", "success");
            renderGradesView();
        } catch (err) { showToast(err.message, "error"); }
    };
}

function openEditGradeModal(id, currentScore, currentComments) {
    showModal("Editar Calificación", `
        <form id="edit-grade-form" style="display:flex; flex-direction:column; gap:1rem;">
            <div class="form-group"><label>Nueva Nota (0-20)</label><input type="number" step="0.5" id="edit-grd-score" class="form-input" value="${currentScore}" required></div>
            <div class="form-group"><label>Observaciones</label><input type="text" id="edit-grd-comments" class="form-input" value="${currentComments}"></div>
            <button type="submit" class="btn-primary">Actualizar Nota</button>
        </form>
    `);

    document.getElementById('edit-grade-form').onsubmit = async (e) => {
        e.preventDefault();
        const score = document.getElementById('edit-grd-score').value;
        const comments = document.getElementById('edit-grd-comments').value;
        try {
            await fetch(`/api/v1/grades/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ score, comments })
            });
            closeModal();
            showToast("Nota actualizada", "success");
            renderGradesView();
        } catch (err) { showToast(err.message, "error"); }
    };
}

async function deleteGrade(id) {
    showConfirmModal("Eliminar Calificación", "¿Eliminar este registro de nota?", async () => {
        try {
            await fetch(`/api/v1/grades/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            showToast("Nota eliminada", "success");
            renderGradesView();
        } catch (err) { showToast("Error al eliminar nota", "error"); }
    });
}

/* ================= 5. MÓDULO DE CERTIFICADOS (EXPORTABLE XLSX) ================= */
async function renderCertificatesView() {
    const viewContainer = document.getElementById('dynamic-content-view');
    
    let studentOptions = '<option value="Lucía Fernández">Lucía Fernández</option>';
    try {
        const resUsers = await fetch('/api/v1/users', { headers: { 'Authorization': `Bearer ${authToken}` } });
        const users = await resUsers.json();
        const students = users.filter(u => u.role_id === 'student');
        if (students.length > 0) {
            studentOptions = students.map(s => `<option value="${s.name}">${s.name} (${s.email})</option>`).join('');
        }
    } catch (e) {}

    viewContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
            <h2>Generador de Certificados & Diplomas</h2>
            <button class="btn-primary" style="background:linear-gradient(135deg, #10b981, #059669);" onclick="exportCertificatesToExcel()">
                <i data-lucide="file-spreadsheet"></i> Exportar XLSX
            </button>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1.5rem; margin-top:1rem;">
            <div class="glass-panel" style="padding:1.5rem;">
                <h3>Configuración del Certificado</h3>
                <form id="cert-form" style="display:flex; flex-direction:column; gap:1rem; margin-top:1rem;">
                    <div class="form-group">
                        <label>Seleccionar Alumno</label>
                        <select id="cert-student" class="form-select" onchange="updateCertPreview()">
                            ${studentOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Nivel o Programa Aprobado</label>
                        <input type="text" id="cert-level" class="form-input" value="Secundaria Completa (Año Lectivo 2026)" required oninput="updateCertPreview()">
                    </div>
                    <div class="form-group">
                        <label>Mérito o Distinción</label>
                        <input type="text" id="cert-merit" class="form-input" value="Primer Puesto de la Promoción" required oninput="updateCertPreview()">
                    </div>
                    <button type="button" class="btn-primary" onclick="window.print()">
                        <i data-lucide="printer"></i> Imprimir Certificado PDF
                    </button>
                </form>
            </div>

            <!-- Preview Imprimible del Certificado -->
            <div class="glass-panel" style="padding:2rem; background:#fff; color:#0f172a; border-radius:16px; position:relative; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                <div style="border:6px double #3b82f6; padding:2rem; text-align:center; height:100%; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <h1 style="color:#1e3a8a; font-family:serif; font-size:1.8rem; margin:0;">DIPLOMA DE HONOR</h1>
                        <p style="color:#64748b; font-size:0.85rem; margin-top:0.25rem;">COLEGIO CENTRAL ACADEMICONTROL</p>
                    </div>
                    <div style="margin:1.5rem 0;">
                        <p style="font-size:0.9rem; color:#475569;">Otorgado orgullosamente a:</p>
                        <h2 id="prev-student" style="font-size:1.6rem; color:#1e40af; margin:0.5rem 0; font-family:serif;">Lucía Fernández</h2>
                        <p style="font-size:0.85rem; color:#475569;">Por haber culminado satisfactoriamente el nivel de:</p>
                        <p id="prev-level" style="font-weight:bold; color:#0f172a;">Secundaria Completa (Año Lectivo 2026)</p>
                        <p id="prev-merit" style="font-size:0.8rem; color:#059669; font-weight:bold; margin-top:0.5rem;">Primer Puesto de la Promoción</p>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top:2rem; border-top:1px solid #cbd5e1; padding-top:0.75rem; font-size:0.75rem; color:#64748b;">
                        <div><span>_______________________</span><br>Firma Dirección</div>
                        <div><span>_______________________</span><br>Sello Institucional</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
    updateCertPreview();
}

function exportCertificatesToExcel() {
    const student = document.getElementById('cert-student')?.value || 'Lucía Fernández';
    const level = document.getElementById('cert-level')?.value || 'Secundaria Completa';
    const merit = document.getElementById('cert-merit')?.value || 'Primer Puesto';

    exportToExcel("Certificados_Emitidos", [{
        "Alumno": student,
        "Programa / Nivel": level,
        "Mérito": merit,
        "Fecha de Emisión": new Date().toISOString().slice(0,10)
    }]);
}

function updateCertPreview() {
    const student = document.getElementById('cert-student')?.value || 'Alumno';
    const level = document.getElementById('cert-level')?.value || 'Secundaria Completa';
    const merit = document.getElementById('cert-merit')?.value || 'Excelencia Académica';

    if (document.getElementById('prev-student')) document.getElementById('prev-student').innerText = student;
    if (document.getElementById('prev-level')) document.getElementById('prev-level').innerText = level;
    if (document.getElementById('prev-merit')) document.getElementById('prev-merit').innerText = merit;
}

/* ================= 6. MÓDULO DE SINCRONIZACIÓN (EXPORTABLE XLSX) ================= */
function renderSyncView() {
    const viewContainer = document.getElementById('dynamic-content-view');
    viewContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
            <h2>Estado de Sincronización Offline</h2>
            <button class="btn-primary" style="background:linear-gradient(135deg, #10b981, #059669);" onclick="exportSyncToExcel()">
                <i data-lucide="file-spreadsheet"></i> Exportar Log XLSX
            </button>
        </div>
        <div class="glass-panel" style="padding:2rem; margin-top:1rem; display:flex; flex-direction:column; gap:1.25rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h4>Motor PWA & Queue Offline</h4>
                    <p style="color:var(--text-muted); font-size:0.85rem;">Todas las mutaciones registradas se sincronizan automáticamente.</p>
                </div>
                <button class="btn-primary" onclick="syncNow()">
                    <i data-lucide="refresh-cw"></i> Sincronizar Ahora
                </button>
            </div>
            <div style="border-top:1px solid var(--bg-card-border); padding-top:1rem;">
                <p style="font-size:0.9rem; font-weight:600; color:var(--success);">● Estado del Motor: 0 Pendientes de envío (Sincronizado)</p>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function exportSyncToExcel() {
    exportToExcel("Log_Sincronizacion", [{
        "Estado Conexión": "Online",
        "Eventos Pendientes": 0,
        "Última Sincronización": new Date().toLocaleString()
    }]);
}

async function syncNow() {
    showToast("Sincronizando eventos offline...", "info");
    try {
        const res = await fetch('/api/v1/sync/ping');
        if (res.ok) {
            showToast("Base de datos local perfectamente sincronizada", "success");
        }
    } catch (e) {
        showToast("Modo Offline activo.", "error");
    }
}

/* ================= 7. MÓDULO DE ASIGNACIÓN Y SELECCIÓN DE CARGA ACADÉMICA MULTIPLE (CON BÚSQUEDA) ================= */
let globalWorkloadLevels = [];
let globalWorkloadAssignedIds = [];

async function renderWorkloadView() {
    const viewContainer = document.getElementById('dynamic-content-view');
    viewContainer.innerHTML = `<div class="glass-panel" style="padding:2rem;"><p style="color:var(--text-muted);">Cargando cursos y estructura académica...</p></div>`;

    try {
        const [resLevels, resUsers] = await Promise.all([
            fetch('/api/v1/academic/levels', { headers: { 'Authorization': `Bearer ${authToken}` } }),
            fetch('/api/v1/users', { headers: { 'Authorization': `Bearer ${authToken}` } })
        ]);
        globalWorkloadLevels = await resLevels.json();
        const users = await resUsers.json();

        // Encontrar los cursos actualmente asignados a este usuario
        const me = users.find(u => u.id === currentUser.id);
        globalWorkloadAssignedIds = me ? (me.assigned_courses || []) : [];

        viewContainer.innerHTML = `
            <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; border-bottom:1px solid var(--bg-card-border); padding-bottom:1rem;">
                    <div>
                        <h3 class="gradient-text" style="font-size:1.2rem;"><i data-lucide="user-check"></i> Carga Académica Asignada a: ${currentUser.name}</h3>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">
                            Selecciona múltiples Niveles, Grados, Secciones y Cursos que te corresponden o vas a dictar.
                        </p>
                    </div>
                    <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
                        <input type="text" id="search-workload" class="form-input" placeholder="Buscar por nivel, curso, grado o sección..." oninput="filterWorkloadView()" style="width:280px;">
                        <button class="btn-primary" onclick="saveSelfWorkload()">
                            <i data-lucide="save"></i> Guardar mi Carga Académica
                        </button>
                    </div>
                </div>

                <div id="workload-container" style="margin-top:1.5rem; display:flex; flex-direction:column; gap:1.5rem;">
                </div>

                <div style="margin-top:1.5rem; text-align:right;">
                    <button class="btn-primary" onclick="saveSelfWorkload()">
                        <i data-lucide="save"></i> Guardar mi Carga Académica
                    </button>
                </div>
            </div>
        `;

        filterWorkloadView();

    } catch (err) {
        showToast("Error al cargar la estructura de carga académica", "error");
    }
}

function filterWorkloadView() {
    const query = (document.getElementById('search-workload')?.value || '').toLowerCase().trim();
    const container = document.getElementById('workload-container');
    if (!container) return;
    container.innerHTML = '';

    // Guardar selecciones actuales en memoria antes de re-renderizar por búsqueda
    const currentlyChecked = new Set(globalWorkloadAssignedIds);
    document.querySelectorAll('.self-workload-cb').forEach(cb => {
        if (cb.checked) {
            currentlyChecked.add(cb.value);
        } else {
            currentlyChecked.delete(cb.value);
        }
    });
    globalWorkloadAssignedIds = Array.from(currentlyChecked);

    let totalMatches = 0;

    globalWorkloadLevels.forEach(lvl => {
        const lvlNameMatch = lvl.name.toLowerCase().includes(query);

        // Filtrar cursos que coincidan con la búsqueda (por nombre, código, grado o sección)
        const matchingCourses = (lvl.courses || []).filter(c => {
            if (!query || lvlNameMatch) return true;
            const nameMatch = c.name.toLowerCase().includes(query);
            const codeMatch = c.code.toLowerCase().includes(query);
            const gradeMatch = (c.grade || '').toLowerCase().includes(query);
            const sectionMatch = (c.section || '').toLowerCase().includes(query);
            return nameMatch || codeMatch || gradeMatch || sectionMatch;
        });

        if (matchingCourses.length > 0) {
            totalMatches += matchingCourses.length;
            const levelCard = document.createElement('div');
            levelCard.style.cssText = "background:rgba(255,255,255,0.02); border:1px solid var(--bg-card-border); border-radius:12px; padding:1.25rem;";

            let courseBoxes = matchingCourses.map(c => {
                const isChecked = globalWorkloadAssignedIds.includes(c.id);
                return `
                    <label style="display:flex; align-items:flex-start; gap:0.75rem; padding:0.85rem; background:var(--bg-card); border:1px solid ${isChecked ? 'var(--accent-blue)' : 'var(--bg-card-border)'}; border-radius:10px; cursor:pointer; transition:all 0.2s ease;">
                        <input type="checkbox" class="self-workload-cb" value="${c.id}" ${isChecked ? 'checked' : ''} onchange="toggleWorkloadCheck('${c.id}', this.checked)" style="margin-top:0.2rem; transform:scale(1.2);">
                        <div style="display:flex; flex-direction:column; gap:0.25rem;">
                            <span style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${c.name}</span>
                            <span style="font-size:0.75rem; color:var(--text-muted);">Código: <strong>${c.code}</strong></span>
                            <div style="display:flex; gap:0.4rem; margin-top:0.35rem;">
                                <span class="role-chip" style="background:rgba(59,130,246,0.15); color:#60a5fa; font-size:0.7rem;">Grado: ${c.grade || 'General'}</span>
                                <span class="role-chip" style="background:rgba(16,185,129,0.15); color:#34d399; font-size:0.7rem;">${c.section || 'Sección A'}</span>
                            </div>
                        </div>
                    </label>
                `;
            }).join('');

            levelCard.innerHTML = `
                <h4 style="color:var(--accent-blue); display:flex; align-items:center; gap:0.5rem; font-size:1.05rem; margin-bottom:1rem;">
                    <i data-lucide="layers"></i> Nivel: ${lvl.name} (Orden: ${lvl.level_order})
                </h4>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:1rem;">
                    ${courseBoxes}
                </div>
            `;
            container.appendChild(levelCard);
        }
    });

    if (totalMatches === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); padding:1rem;">No se encontraron cursos, grados ni secciones coincidentes con la búsqueda.</p>';
    }

    if (window.lucide) lucide.createIcons();
}

function toggleWorkloadCheck(courseId, isChecked) {
    const set = new Set(globalWorkloadAssignedIds);
    if (isChecked) set.add(courseId);
    else set.delete(courseId);
    globalWorkloadAssignedIds = Array.from(set);
}

async function saveSelfWorkload() {
    try {
        const res = await fetch('/api/v1/users/assign-teacher-courses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ teacher_id: currentUser.id, course_ids: globalWorkloadAssignedIds })
        });
        if (!res.ok) throw new Error("Error guardando tu carga académica");
        showToast("¡Tu carga académica ha sido actualizada exitosamente!", "success");
        renderWorkloadView();
    } catch (err) {
        showToast(err.message, "error");
    }
}

