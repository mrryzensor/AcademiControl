const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth/auth.controller');
const { checkPermission } = require('../permissions/permissions.controller');
const { db } = require('../../database/connection');

// Obtener calificaciones
router.get('/', authenticateToken, checkPermission('view_grades'), (req, res) => {
    let grades = db.data.grades;

    if (req.user.role_id === 'student') {
        grades = grades.filter(g => g.student_id === req.user.id);
    } else if (req.user.role_id === 'parent') {
        const myStudentIds = db.data.parent_student
            .filter(ps => ps.parent_id === req.user.id)
            .map(ps => ps.student_id);
        grades = grades.filter(g => myStudentIds.includes(g.student_id));
    } else if (req.user.role_id === 'teacher') {
        const myCourseIds = db.data.teacher_courses
            .filter(tc => tc.teacher_id === req.user.id)
            .map(tc => tc.course_id);
        grades = grades.filter(g => g.teacher_id === req.user.id || myCourseIds.includes(g.course_id));
    }

    const mapped = grades.map(g => {
        const student = db.data.users.find(u => u.id === g.student_id);
        const course = db.data.courses.find(c => c.id === g.course_id);
        const teacher = db.data.users.find(u => u.id === g.teacher_id);
        return {
            ...g,
            student_name: student ? student.name : g.student_id,
            course_name: course ? course.name : g.course_id,
            teacher_name: teacher ? teacher.name : g.teacher_id
        };
    });
    res.json(mapped);
});

// Registrar nueva calificación
router.post('/', authenticateToken, checkPermission('edit_grades'), (req, res) => {
    const { student_id, course_id, term, score, comments } = req.body;
    if (!student_id || !course_id || score === undefined) {
        return res.status(400).json({ error: 'Alumno, Curso y Nota son obligatorios' });
    }

    const newGrade = {
        id: `grd_${Date.now()}`,
        student_id,
        course_id,
        teacher_id: req.user.id,
        term: term || 'Trimestre 1',
        score: parseFloat(score),
        comments: comments || ''
    };

    db.data.grades.push(newGrade);
    db.save();

    res.json({ message: 'Calificación registrada correctamente', grade: newGrade });
});

// Editar calificación
router.put('/:id', authenticateToken, checkPermission('edit_grades'), (req, res) => {
    const { score, comments, term } = req.body;
    const grade = db.data.grades.find(g => g.id === req.params.id);
    if (!grade) return res.status(404).json({ error: 'Calificación no encontrada' });

    if (score !== undefined) grade.score = parseFloat(score);
    if (comments !== undefined) grade.comments = comments;
    if (term) grade.term = term;

    db.save();
    res.json({ message: 'Calificación actualizada', grade });
});

// Eliminar calificación
router.delete('/:id', authenticateToken, checkPermission('delete_grades'), (req, res) => {
    db.data.grades = db.data.grades.filter(g => g.id !== req.params.id);
    db.save();
    res.json({ message: 'Calificación eliminada' });
});

module.exports = router;
