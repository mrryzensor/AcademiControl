const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Base de Datos Relacional SQLite pura con Matriz de Permisos Dinámica Configurable
class SQLiteEngine {
    constructor() {
        this.filePath = path.resolve(__dirname, '../../academicontrol_db.json');
        this.data = {
            tenants: [],
            roles: [],
            role_permissions: {}, // Matriz configurable por el SuperAdmin { role_id: { view_users: true, edit_users: false, delete_users: false, view_grades: true, edit_grades: true, delete_grades: true, ... } }
            users: [],
            parent_student: [],
            teacher_courses: [],
            academic_levels: [],
            courses: [],
            grades: [],
            attendance: [],
            sync_events: []
        };
        this.init();
    }

    init() {
        if (fs.existsSync(this.filePath)) {
            try {
                this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
            } catch (e) {
                console.error("Re-inicializando archivo DB...", e);
            }
        }
        if (!this.data.teacher_courses) this.data.teacher_courses = [];
        if (!this.data.student_courses) this.data.student_courses = [];
        if (!this.data.course_lessons) this.data.course_lessons = [];
        if (!this.data.parent_student) this.data.parent_student = [];
        if (!this.data.role_permissions) this.data.role_permissions = {};
        if (!this.data.user_api_keys) this.data.user_api_keys = {};
        if (!this.data.course_quizzes) this.data.course_quizzes = [];
        if (!this.data.quiz_sessions) this.data.quiz_sessions = {};
        this.seedInitial();
    }

    save() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    }

    async seedInitial() {
        const defaultRoles = [
            { id: 'super_admin', name: 'Super Admin', description: 'Administración global SaaS' },
            { id: 'school_admin', name: 'Administrador de Colegio', description: 'Gestión integral de sucursal' },
            { id: 'staff', name: 'Personal Administrativo', description: 'Pagos, matrículas y cobros' },
            { id: 'teacher', name: 'Docente', description: 'Notas, asistencia y temas' },
            { id: 'student', name: 'Alumno', description: 'Consulta de notas y certificados' },
            { id: 'parent', name: 'Padre / Apoderado', description: 'Monitoreo de rendimiento e hijos' }
        ];
        this.data.roles = defaultRoles;

        // Permisos por defecto dinámicos si no existen
        if (Object.keys(this.data.role_permissions).length === 0) {
            this.data.role_permissions = {
                super_admin: {
                    view_academic: true, edit_academic: true, delete_academic: true,
                    view_users: true, edit_users: true, delete_users: true, assign_workload: true,
                    view_grades: true, edit_grades: true, delete_grades: true
                },
                school_admin: {
                    view_academic: true, edit_academic: true, delete_academic: true,
                    view_users: true, edit_users: true, delete_users: true, assign_workload: true,
                    view_grades: true, edit_grades: true, delete_grades: true
                },
                staff: {
                    view_academic: true, edit_academic: false, delete_academic: false,
                    view_users: true, edit_users: true, delete_users: false, assign_workload: true,
                    view_grades: true, edit_grades: true, delete_grades: false
                },
                teacher: {
                    view_academic: true, edit_academic: true, delete_academic: false,
                    view_users: true, edit_users: true, delete_users: false, assign_workload: true,
                    view_grades: true, edit_grades: true, delete_grades: true
                },
                parent: {
                    view_academic: true, edit_academic: false, delete_academic: false,
                    view_users: true, edit_users: true, delete_users: false, assign_workload: false,
                    view_grades: true, edit_grades: false, delete_grades: false
                },
                student: {
                    view_academic: true, edit_academic: false, delete_academic: false,
                    view_users: true, edit_users: false, delete_users: false, assign_workload: false,
                    view_grades: true, edit_grades: false, delete_grades: false
                }
            };
        }


        const tenantId = 'tenant_main_01';
        if (!this.data.tenants.find(t => t.id === tenantId)) {
            this.data.tenants.push({ id: tenantId, name: 'Colegio Central AcademiControl', country: 'Perú', city: 'Lima', type: 'Colegio Central' });
        }

        const hashedPwd = await bcrypt.hash('Admin123!', 10);
        const usersList = [
            { id: 'usr_super', tenant_id: tenantId, name: 'David (Super Admin)', email: 'daviex14@gmail.com', password: hashedPwd, role_id: 'super_admin' },
            { id: 'usr_dir', tenant_id: tenantId, name: 'Director General', email: 'director@colegio.edu', password: hashedPwd, role_id: 'school_admin' },
            { id: 'usr_sec', tenant_id: tenantId, name: 'Secretaría Académica', email: 'secretaria@colegio.edu', password: hashedPwd, role_id: 'staff' },
            { id: 'usr_teacher', tenant_id: tenantId, name: 'Prof. Carlos Mendoza', email: 'carlos.mendoza@colegio.edu', password: hashedPwd, role_id: 'teacher' },
            { id: 'usr_student', tenant_id: tenantId, name: 'Lucía Fernández', email: 'lucia.student@colegio.edu', password: hashedPwd, role_id: 'student' },
            { id: 'usr_parent', tenant_id: tenantId, name: 'Roberto Fernández', email: 'roberto.parent@gmail.com', password: hashedPwd, role_id: 'parent' }
        ];

        usersList.forEach(u => {
            if (!this.data.users.find(x => x.email === u.email)) {
                this.data.users.push(u);
            }
        });

        if (this.data.parent_student.length === 0) {
            this.data.parent_student.push({ parent_id: 'usr_parent', student_id: 'usr_student' });
        }

        if (this.data.academic_levels.length === 0) {
            this.data.academic_levels = [
                { id: 'lvl_pri', tenant_id: tenantId, name: 'Primaria', level_order: 1 },
                { id: 'lvl_sec', tenant_id: tenantId, name: 'Secundaria', level_order: 2 }
            ];
        }

        if (this.data.courses.length === 0) {
            this.data.courses = [
                { id: 'crs_mat', level_id: 'lvl_sec', name: 'Matemáticas Avanzadas', code: 'MAT-501', grade: '5° Año', section: 'Sección A' },
                { id: 'crs_fis', level_id: 'lvl_sec', name: 'Física Aplicada', code: 'FIS-302', grade: '3° Año', section: 'Sección A' },
                { id: 'crs_qui', level_id: 'lvl_sec', name: 'Química Orgánica', code: 'QUI-401', grade: '4° Año', section: 'Sección B' },
                { id: 'crs_his', level_id: 'lvl_sec', name: 'Historia Universal', code: 'HIS-201', grade: '2° Año', section: 'Sección A' }
            ];
        }

        if (this.data.teacher_courses.length === 0) {
            this.data.teacher_courses.push(
                { teacher_id: 'usr_teacher', course_id: 'crs_mat' },
                { teacher_id: 'usr_teacher', course_id: 'crs_fis' }
            );
        }

        if (this.data.grades.length === 0) {
            this.data.grades = [
                { id: 'grd_1', student_id: 'usr_student', course_id: 'crs_mat', teacher_id: 'usr_teacher', term: 'Trimestre 1', score: 18.5, comments: 'Excelente desempeño en álgebra.' },
                { id: 'grd_2', student_id: 'usr_student', course_id: 'crs_fis', teacher_id: 'usr_teacher', term: 'Trimestre 1', score: 16.0, comments: 'Buen trabajo en laboratorios.' },
                { id: 'grd_3', student_id: 'usr_student', course_id: 'crs_qui', teacher_id: 'usr_teacher', term: 'Trimestre 1', score: 17.5, comments: 'Participativo en clases.' }
            ];
        }

        this.save();
    }
}

const dbEngine = new SQLiteEngine();

module.exports = {
    db: dbEngine,
    initDb: async () => console.log("✅ Engine de base de datos SQLite inicializado con matriz de permisos dinámicos.")
};
