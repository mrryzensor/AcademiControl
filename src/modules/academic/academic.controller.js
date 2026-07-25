const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth/auth.controller');
const { checkPermission } = require('../permissions/permissions.controller');
const { db } = require('../../database/connection');

// Listar Niveles y Cursos
router.get('/levels', authenticateToken, checkPermission('view_academic'), (req, res) => {
    const levels = db.data.academic_levels;
    const courses = db.data.courses;

    const fullLevels = levels.map(lvl => ({
        ...lvl,
        courses: courses.filter(c => c.level_id === lvl.id)
    }));

    res.json(fullLevels);
});

// Crear nuevo Nivel
router.post('/levels', authenticateToken, checkPermission('edit_academic'), (req, res) => {
    const { name, level_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre de nivel requerido' });

    const newLevel = {
        id: `lvl_${Date.now()}`,
        tenant_id: req.user.tenant_id || 'tenant_main_01',
        name,
        level_order: level_order || 1
    };

    db.data.academic_levels.push(newLevel);
    db.save();
    res.json({ message: 'Nivel académico creado', level: newLevel });
});

// Editar Nivel
router.put('/levels/:id', authenticateToken, checkPermission('edit_academic'), (req, res) => {
    const { name, level_order } = req.body;
    const level = db.data.academic_levels.find(l => l.id === req.params.id);
    if (!level) return res.status(404).json({ error: 'Nivel no encontrado' });

    if (name) level.name = name;
    if (level_order) level.level_order = level_order;
    db.save();
    res.json({ message: 'Nivel actualizado', level });
});

// Eliminar Nivel
router.delete('/levels/:id', authenticateToken, checkPermission('delete_academic'), (req, res) => {
    db.data.academic_levels = db.data.academic_levels.filter(l => l.id !== req.params.id);
    db.data.courses = db.data.courses.filter(c => c.level_id !== req.params.id);
    db.save();
    res.json({ message: 'Nivel y sus cursos asociados eliminados' });
});

// Crear nuevo Curso
router.post('/courses', authenticateToken, checkPermission('edit_academic'), (req, res) => {
    const { level_id, name, code, grade, section } = req.body;
    if (!level_id || !name) return res.status(400).json({ error: 'Nivel y nombre de curso requeridos' });

    const newCourse = {
        id: `crs_${Date.now()}`,
        level_id,
        name,
        code: code || 'GEN-100',
        grade: grade || 'General',
        section: section || 'Sección A'
    };

    db.data.courses.push(newCourse);
    
    // Auto-asignación si es docente creando su curso
    if (req.user.role_id === 'teacher') {
        db.data.teacher_courses.push({ teacher_id: req.user.id, course_id: newCourse.id });
    }

    db.save();
    res.json({ message: 'Curso creado e inscrito en carga académica', course: newCourse });
});

// Editar Curso
router.put('/courses/:id', authenticateToken, checkPermission('edit_academic'), (req, res) => {
    const { name, code, grade, section } = req.body;
    const course = db.data.courses.find(c => c.id === req.params.id);
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

    if (name) course.name = name;
    if (code) course.code = code;
    if (grade) course.grade = grade;
    if (section) course.section = section;
    db.save();
    res.json({ message: 'Curso actualizado', course });
});

// Eliminar Curso
router.delete('/courses/:id', authenticateToken, checkPermission('delete_academic'), (req, res) => {
    db.data.courses = db.data.courses.filter(c => c.id !== req.params.id);
    db.data.teacher_courses = db.data.teacher_courses.filter(tc => tc.course_id !== req.params.id);
    db.data.course_lessons = (db.data.course_lessons || []).filter(cl => cl.course_id !== req.params.id);
    db.save();
    res.json({ message: 'Curso eliminado' });
});

/* ================= CLASES / AULAS VIRTUALES DENTRO DE CURSOS ================= */

// Listar clases de un curso
router.get('/courses/:courseId/lessons', authenticateToken, checkPermission('view_academic'), (req, res) => {
    const courseId = req.params.courseId;
    if (!db.data.course_lessons) db.data.course_lessons = [];

    const lessons = db.data.course_lessons.filter(l => l.course_id === courseId);
    res.json(lessons);
});

// Crear nueva clase en un curso (Requiere edit_academic)
router.post('/courses/:courseId/lessons', authenticateToken, checkPermission('edit_academic'), (req, res) => {
    const courseId = req.params.courseId;
    const { title, content_html, youtube_url } = req.body;
    if (!title) return res.status(400).json({ error: 'El título de la clase es obligatorio' });

    if (!db.data.course_lessons) db.data.course_lessons = [];

    const newLesson = {
        id: `lsn_${Date.now()}`,
        course_id: courseId,
        title,
        content_html: content_html || '',
        youtube_url: youtube_url || '',
        created_at: new Date().toISOString()
    };

    db.data.course_lessons.push(newLesson);
    db.save();

    res.json({ message: 'Clase creada correctamente', lesson: newLesson });
});

// Editar clase (Requiere edit_academic)
router.put('/lessons/:id', authenticateToken, checkPermission('edit_academic'), (req, res) => {
    const { title, content_html, youtube_url } = req.body;
    if (!db.data.course_lessons) db.data.course_lessons = [];

    const lesson = db.data.course_lessons.find(l => l.id === req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Clase no encontrada' });

    if (title) lesson.title = title;
    if (content_html !== undefined) lesson.content_html = content_html;
    if (youtube_url !== undefined) lesson.youtube_url = youtube_url;

    db.save();
    res.json({ message: 'Clase actualizada correctamente', lesson });
});

// Eliminar clase (Requiere edit_academic)
router.delete('/lessons/:id', authenticateToken, checkPermission('edit_academic'), (req, res) => {
    if (!db.data.course_lessons) db.data.course_lessons = [];
    db.data.course_lessons = db.data.course_lessons.filter(l => l.id !== req.params.id);
    db.save();
    res.json({ message: 'Clase eliminada correctamente' });
});

module.exports = router;
