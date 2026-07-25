-- Schema para AcademiControl SaaS (Offline-first / Multi-tenant)

CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    city TEXT NOT NULL,
    type TEXT DEFAULT 'Colegio',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

INSERT OR IGNORE INTO roles (id, name, description) VALUES
('super_admin', 'Super Admin', 'Administración global SaaS'),
('school_admin', 'Administrador de Colegio', 'Gestión integral de sucursal/colegio'),
('staff', 'Personal Administrativo', 'Pagos, matrículas y cobros'),
('teacher', 'Docente', 'Notas, asistencia y temas'),
('student', 'Alumno', 'Consulta de notas y certificados'),
('parent', 'Padre / Apoderado', 'Monitoreo de rendimiento e hijos');

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS parent_student (
    parent_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    PRIMARY KEY(parent_id, student_id),
    FOREIGN KEY(parent_id) REFERENCES users(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS academic_levels (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    level_order INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    level_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    FOREIGN KEY(level_id) REFERENCES academic_levels(id)
);

CREATE TABLE IF NOT EXISTS grades (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    term TEXT NOT NULL,
    score REAL NOT NULL,
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL, -- 'Presente', 'Tardanza', 'Falta'
    remarks TEXT
);

CREATE TABLE IF NOT EXISTS sync_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
