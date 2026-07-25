const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth/auth.controller');
const { db } = require('../../database/connection');

// Endpoint para estadísticas dinámicas por rol calculadas con datos reales de la BD
router.get('/metrics', authenticateToken, (req, res) => {
    const roleId = req.user.role_id;
    const userId = req.user.id;

    const users = db.data.users || [];
    const grades = db.data.grades || [];
    const levels = db.data.academic_levels || [];
    const courses = db.data.courses || [];
    const parentStudent = db.data.parent_student || [];

    switch (roleId) {
        case 'super_admin': {
            const totalUsers = users.length;
            const schoolAdmins = users.filter(u => u.role_id === 'school_admin').length;
            const totalTeachers = users.filter(u => u.role_id === 'teacher').length;
            const totalStudents = users.filter(u => u.role_id === 'student').length;
            const totalParents = users.filter(u => u.role_id === 'parent').length;
            const totalStaff = users.filter(u => u.role_id === 'staff').length;
            const totalLevels = levels.length;
            const totalCourses = courses.length;

            return res.json({
                role: 'Super Admin',
                kpis: [
                    { title: 'Usuarios Totales', value: `${totalUsers}`, icon: '👥', change: 'Registrados en el Sistema' },
                    { title: 'Niveles Académicos', value: `${totalLevels}`, icon: '🏫', change: `${totalCourses} cursos configurados` },
                    { title: 'Docentes Activos', value: `${totalTeachers}`, icon: '👨‍🏫', change: 'Plana docente' },
                    { title: 'Estudiantes Inscritos', value: `${totalStudents}`, icon: '🎓', change: 'Matrícula total' }
                ],
                charts: {
                    mainChart: {
                        title: 'Estructura por Niveles y Cursos',
                        labels: levels.map(l => l.name),
                        data: levels.map(l => (l.courses ? l.courses.length : courses.filter(c => c.level_id === l.id).length))
                    },
                    secondaryChart: {
                        title: 'Distribución de Usuarios por Rol',
                        labels: ['Alumnos', 'Docentes', 'Apoderados', 'Administrativos', 'Directores'],
                        data: [totalStudents, totalTeachers, totalParents, totalStaff, schoolAdmins]
                    }
                }
            });
        }

        case 'school_admin': {
            const totalUsers = users.length;
            const totalStudents = users.filter(u => u.role_id === 'student').length;
            const totalTeachers = users.filter(u => u.role_id === 'teacher').length;
            const totalGrades = grades.length;
            const avgGrade = totalGrades > 0 ? (grades.reduce((acc, g) => acc + Number(g.score), 0) / totalGrades).toFixed(2) : '0';

            return res.json({
                role: 'Administrador de Colegio',
                kpis: [
                    { title: 'Total Usuarios', value: `${totalUsers}`, icon: '🎒', change: 'Comunidad Educativa' },
                    { title: 'Alumnos Matriculados', value: `${totalStudents}`, icon: '👨‍🎓', change: 'Activos en sistema' },
                    { title: 'Promedio Institucional', value: `${avgGrade} / 20`, icon: '📊', change: `${totalGrades} notas registradas` },
                    { title: 'Docentes Activos', value: `${totalTeachers}`, icon: '👨‍🏫', change: 'Asignados a cursos' }
                ],
                charts: {
                    mainChart: {
                        title: 'Cursos por Nivel Académico',
                        labels: levels.map(l => l.name),
                        data: levels.map(l => (l.courses ? l.courses.length : courses.filter(c => c.level_id === l.id).length))
                    },
                    secondaryChart: {
                        title: 'Rendimiento por Rango de Notas',
                        labels: ['Excelentes (18-20)', 'Aprobados (11-17)', 'Desaprobados (<11)'],
                        data: [
                            grades.filter(g => g.score >= 18).length,
                            grades.filter(g => g.score >= 11 && g.score < 18).length,
                            grades.filter(g => g.score < 11).length
                        ]
                    }
                }
            });
        }

        case 'staff': {
            const totalStudents = users.filter(u => u.role_id === 'student').length;
            const totalParents = users.filter(u => u.role_id === 'parent').length;
            const totalGrades = grades.length;
            const totalCourses = courses.length;

            return res.json({
                role: 'Personal Administrativo',
                kpis: [
                    { title: 'Alumnos Registrados', value: `${totalStudents}`, icon: '🎓', change: 'En padrón actual' },
                    { title: 'Apoderados Vinculados', value: `${totalParents}`, icon: '👨‍👩‍👧', change: 'Contactos directos' },
                    { title: 'Cursos Habilitados', value: `${totalCourses}`, icon: '📘', change: 'Malla curricular' },
                    { title: 'Calificaciones Ingresadas', value: `${totalGrades}`, icon: '🧾', change: 'Registros procesados' }
                ],
                charts: {
                    mainChart: {
                        title: 'Cantidad de Cursos por Nivel',
                        labels: levels.map(l => l.name),
                        data: levels.map(l => (l.courses ? l.courses.length : courses.filter(c => c.level_id === l.id).length))
                    },
                    secondaryChart: {
                        title: 'Composición de Usuarios',
                        labels: ['Alumnos', 'Apoderados', 'Docentes'],
                        data: [
                            totalStudents,
                            totalParents,
                            users.filter(u => u.role_id === 'teacher').length
                        ]
                    }
                }
            });
        }

        case 'teacher': {
            const myTeacherObj = users.find(u => u.id === userId);
            const teacherName = myTeacherObj ? myTeacherObj.name : '';
            const myGrades = grades.filter(g => g.teacher_id === userId || g.teacher_name === teacherName);
            const totalEval = myGrades.length;
            const avgGrade = totalEval > 0 ? (myGrades.reduce((acc, g) => acc + Number(g.score), 0) / totalEval).toFixed(2) : '0';

            const courseGradesMap = {};
            myGrades.forEach(g => {
                const cName = g.course_name || 'General';
                if (!courseGradesMap[cName]) courseGradesMap[cName] = { sum: 0, count: 0 };
                courseGradesMap[cName].sum += Number(g.score);
                courseGradesMap[cName].count++;
            });

            const courseLabels = Object.keys(courseGradesMap);
            const courseAvgs = courseLabels.map(c => (courseGradesMap[c].sum / courseGradesMap[c].count).toFixed(2));

            return res.json({
                role: 'Docente',
                kpis: [
                    { title: 'Promedio de mis Notas', value: `${avgGrade} / 20`, icon: '📊', change: `Basado en ${totalEval} evaluaciones` },
                    { title: 'Evaluaciones Registradas', value: `${totalEval}`, icon: '✏️', change: 'Total histórico' },
                    { title: 'Cursos Evaluados', value: `${courseLabels.length || 1}`, icon: '📘', change: 'Materias activas' },
                    { title: 'Alumnos Evaluados', value: `${new Set(myGrades.map(g => g.student_id)).size}`, icon: '👥', change: 'Alumnos únicos' }
                ],
                charts: {
                    mainChart: {
                        title: 'Promedio por Curso Evaluado',
                        labels: courseLabels.length > 0 ? courseLabels : ['Sin cursos registrados'],
                        data: courseAvgs.length > 0 ? courseAvgs : [0]
                    },
                    secondaryChart: {
                        title: 'Distribución de Calificaciones',
                        labels: ['Aprobados (>=11)', 'Desaprobados (<11)'],
                        data: [
                            myGrades.filter(g => g.score >= 11).length,
                            myGrades.filter(g => g.score < 11).length
                        ]
                    }
                }
            });
        }

        case 'student': {
            const studentGrades = grades.filter(g => g.student_id === userId);
            const totalCount = studentGrades.length;
            const avgScore = totalCount > 0 ? (studentGrades.reduce((acc, g) => acc + Number(g.score), 0) / totalCount).toFixed(2) : 'N/A';

            return res.json({
                role: 'Alumno',
                kpis: [
                    { title: 'Promedio General', value: `${avgScore}`, icon: '🏆', change: totalCount > 0 ? `De ${totalCount} cursos/periodos` : 'Sin notas registradas' },
                    { title: 'Cursos Evaluados', value: `${totalCount}`, icon: '📚', change: 'Calificaciones recibidas' },
                    { title: 'Notas Aprobadas', value: `${studentGrades.filter(g => g.score >= 11).length}`, icon: '✅', change: 'Nota >= 11' },
                    { title: 'Notas Desaprobadas', value: `${studentGrades.filter(g => g.score < 11).length}`, icon: '⚠️', change: 'Nota < 11' }
                ],
                charts: {
                    mainChart: {
                        title: 'Mis Notas por Curso',
                        labels: studentGrades.length > 0 ? studentGrades.map(g => `${g.course_name} (${g.term})`) : ['Sin evaluaciones'],
                        data: studentGrades.length > 0 ? studentGrades.map(g => g.score) : [0]
                    },
                    secondaryChart: {
                        title: 'Estado de Cursos',
                        labels: ['Aprobados', 'Por Mejorar'],
                        data: [
                            studentGrades.filter(g => g.score >= 11).length,
                            studentGrades.filter(g => g.score < 11).length
                        ]
                    }
                }
            });
        }

        case 'parent': {
            const parentRel = parentStudent.filter(ps => ps.parent_id === userId);
            const childIds = parentRel.map(ps => ps.student_id);
            
            // Si el padre no tiene relación directa explícita en parent_student, buscar el alumno 'Lucía Fernández' por defecto
            let targetChildGrades = grades.filter(g => childIds.includes(g.student_id));
            if (targetChildGrades.length === 0 && childIds.length === 0) {
                targetChildGrades = grades.filter(g => g.student_id === 'usr_student');
            }

            const totalCount = targetChildGrades.length;
            const avgScore = totalCount > 0 ? (targetChildGrades.reduce((acc, g) => acc + Number(g.score), 0) / totalCount).toFixed(2) : 'N/A';
            const childName = targetChildGrades.length > 0 ? targetChildGrades[0].student_name : 'Hijo(a)';

            return res.json({
                role: 'Padre / Apoderado',
                kpis: [
                    { title: 'Estudiante Monitoreado', value: childName, icon: '👨‍👩‍👧', change: 'Verificación en línea' },
                    { title: 'Promedio del Alumno', value: `${avgScore} / 20`, icon: '⭐', change: `${totalCount} materias evaluadas` },
                    { title: 'Materias Aprobadas', value: `${targetChildGrades.filter(g => g.score >= 11).length}`, icon: '✅', change: 'Rendimiento positivo' },
                    { title: 'Materias Desaprobadas', value: `${targetChildGrades.filter(g => g.score < 11).length}`, icon: '🔔', change: 'Atención requerida' }
                ],
                charts: {
                    mainChart: {
                        title: `Calificaciones de ${childName}`,
                        labels: targetChildGrades.length > 0 ? targetChildGrades.map(g => `${g.course_name} (${g.term})`) : ['Sin evaluaciones'],
                        data: targetChildGrades.length > 0 ? targetChildGrades.map(g => g.score) : [0]
                    },
                    secondaryChart: {
                        title: 'Balance de Notas',
                        labels: ['Aprobados', 'Desaprobados'],
                        data: [
                            targetChildGrades.filter(g => g.score >= 11).length,
                            targetChildGrades.filter(g => g.score < 11).length
                        ]
                    }
                }
            });
        }

        default:
            return res.status(400).json({ error: 'Rol desconocido' });
    }
});

module.exports = router;
