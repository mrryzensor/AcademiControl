const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../auth/auth.controller');
const { checkPermission } = require('../permissions/permissions.controller');
const { db } = require('../../database/connection');

// Listar usuarios
router.get('/', authenticateToken, checkPermission('view_users'), (req, res) => {
    let users = db.data.users;

    // Filtros de visibilidad contextual
    if (req.user.role_id === 'teacher') {
        users = users.filter(u => u.role_id === 'student');
    } else if (req.user.role_id === 'parent') {
        const assignedStudentIds = db.data.parent_student
            .filter(ps => ps.parent_id === req.user.id)
            .map(ps => ps.student_id);
        users = users.filter(u => assignedStudentIds.includes(u.id));
    } else if (req.user.role_id === 'student') {
        users = users.filter(u => u.id === req.user.id);
    }

    const mapped = users.map(u => {
        const role = db.data.roles.find(r => r.id === u.role_id);
        const assignedCourses = db.data.teacher_courses
            .filter(tc => tc.teacher_id === u.id)
            .map(tc => tc.course_id);
        const studentCourses = (db.data.student_courses || [])
            .filter(sc => sc.student_id === u.id)
            .map(sc => sc.course_id);
        const assignedStudents = db.data.parent_student
            .filter(ps => ps.parent_id === u.id)
            .map(ps => ps.student_id);

        return {
            id: u.id,
            name: u.name,
            email: u.email,
            role_id: u.role_id,
            role_name: role ? role.name : u.role_id,
            tenant_id: u.tenant_id,
            level_id: u.level_id || null,
            grade: u.grade || null,
            section: u.section || null,
            assigned_courses: assignedCourses,
            student_courses: studentCourses,
            assigned_students: assignedStudents
        };
    });
    res.json(mapped);
});

// Crear usuario
router.post('/', authenticateToken, checkPermission('edit_users'), async (req, res) => {
    const { name, email, password, role_id, level_id, grade, section } = req.body;
    if (!name || !email || !password || !role_id) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Regla contextual: Docentes registran alumnos
    if (req.user.role_id === 'teacher' && role_id !== 'student') {
        return res.status(403).json({ error: 'Los docentes sólo pueden registrar alumnos' });
    }

    if (db.data.users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'El correo electrónico ya existe' });
    }

    const hashedPwd = await bcrypt.hash(password, 10);
    const newUser = {
        id: `usr_${Date.now()}`,
        tenant_id: req.user.tenant_id || 'tenant_main_01',
        name,
        email,
        password: hashedPwd,
        role_id,
        level_id: level_id || null,
        grade: grade || null,
        section: section || null
    };

    db.data.users.push(newUser);

    // Auto-asignación de cursos para alumnos según su nivel, grado y sección
    if (role_id === 'student' && level_id) {
        if (!db.data.student_courses) db.data.student_courses = [];
        
        const cleanStr = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const normGrade = cleanStr(grade);
        const normSection = cleanStr(section);

        const matchingCourses = (db.data.courses || []).filter(c => {
            if (c.level_id !== level_id) return false;
            const cGrade = cleanStr(c.grade);
            const cSection = cleanStr(c.section);

            const matchesGrade = !normGrade || cGrade === normGrade || (normGrade && cGrade.includes(normGrade)) || (cGrade && normGrade.includes(cGrade));
            const matchesSection = !normSection || cSection === normSection || (normSection && cSection.includes(normSection)) || (cSection && normSection.includes(cSection));
            return matchesGrade && matchesSection;
        });

        matchingCourses.forEach(c => {
            db.data.student_courses.push({ student_id: newUser.id, course_id: c.id });
        });
    }

    db.save();

    res.json({ message: 'Usuario creado exitosamente', user: { id: newUser.id, name, email, role_id } });
});

// Asignar Cursos / Carga Académica a Docente (Configurable por Matriz de Permisos)
router.post('/assign-teacher-courses', authenticateToken, checkPermission('assign_workload'), (req, res) => {
    const { teacher_id, course_ids } = req.body;
    const targetId = teacher_id || req.user.id;

    if (!Array.isArray(course_ids)) {
        return res.status(400).json({ error: 'Lista de cursos requeridos' });
    }

    db.data.teacher_courses = db.data.teacher_courses.filter(tc => tc.teacher_id !== targetId);
    course_ids.forEach(course_id => {
        db.data.teacher_courses.push({ teacher_id: targetId, course_id });
    });

    db.save();
    res.json({ message: 'Carga académica asignada correctamente', course_ids });
});

// Asignar Nivel, Grado, Sección y Cursos a Alumno
router.post('/assign-student-academic', authenticateToken, checkPermission('edit_users'), (req, res) => {
    const { student_id, level_id, grade, section, course_ids } = req.body;
    const student = db.data.users.find(u => u.id === student_id && u.role_id === 'student');
    if (!student) {
        return res.status(404).json({ error: 'Alumno no encontrado' });
    }

    student.level_id = level_id || null;
    student.grade = grade || null;
    student.section = section || null;

    if (!db.data.student_courses) db.data.student_courses = [];
    db.data.student_courses = db.data.student_courses.filter(sc => sc.student_id !== student_id);

    if (Array.isArray(course_ids)) {
        course_ids.forEach(course_id => {
            db.data.student_courses.push({ student_id, course_id });
        });
    }

    db.save();
    res.json({ message: 'Ficha académica del alumno actualizada correctamente', student });
});


// Asignar Hijos a Apoderado
router.post('/assign-parent-students', authenticateToken, checkPermission('edit_users'), (req, res) => {
    const { parent_id, student_ids } = req.body;
    const targetId = parent_id || req.user.id;

    if (!Array.isArray(student_ids)) {
        return res.status(400).json({ error: 'Lista de alumnos requeridos' });
    }

    db.data.parent_student = db.data.parent_student.filter(ps => ps.parent_id !== targetId);
    student_ids.forEach(student_id => {
        db.data.parent_student.push({ parent_id: targetId, student_id });
    });

    db.save();
    res.json({ message: 'Hijos asignados al apoderado correctamente', student_ids });
});

// Editar usuario
router.put('/:id', authenticateToken, checkPermission('edit_users'), async (req, res) => {
    const { name, email, role_id, password } = req.body;
    const user = db.data.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (role_id && ['super_admin', 'school_admin'].includes(req.user.role_id)) user.role_id = role_id;
    if (password) user.password = await bcrypt.hash(password, 10);

    db.save();
    res.json({ message: 'Usuario actualizado correctamente', user: { id: user.id, name: user.name, email: user.email, role_id: user.role_id } });
});

// Eliminar usuario
router.delete('/:id', authenticateToken, checkPermission('delete_users'), (req, res) => {
    db.data.users = db.data.users.filter(u => u.id !== req.params.id);
    db.data.teacher_courses = db.data.teacher_courses.filter(tc => tc.teacher_id !== req.params.id);
    db.data.parent_student = db.data.parent_student.filter(ps => ps.parent_id !== req.params.id && ps.student_id !== req.params.id);
    db.save();
    res.json({ message: 'Usuario eliminado' });
});

module.exports = router;
