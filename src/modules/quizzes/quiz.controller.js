const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth/auth.controller');
const { checkPermission } = require('../permissions/permissions.controller');
const { db } = require('../../database/connection');
const { generateQuizWithGemini } = require('./quiz.service');

// 1. Obtener API Keys de Gemini del usuario logueado
router.get('/api-keys', authenticateToken, (req, res) => {
    const userId = req.user.id;
    if (!db.data.user_api_keys) db.data.user_api_keys = {};
    const keys = db.data.user_api_keys[userId] || [];
    res.json({ keys });
});

// 2. Guardar API Keys de Gemini para el usuario logueado
router.post('/api-keys', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { keys } = req.body;

    if (!Array.isArray(keys)) {
        return res.status(400).json({ error: 'Formato de claves inválido' });
    }

    // Filtrar claves no vacías y limpiar espacios
    const cleanKeys = keys.map(k => (typeof k === 'string' ? k.trim() : '')).filter(k => k.length > 0);

    if (!db.data.user_api_keys) db.data.user_api_keys = {};
    db.data.user_api_keys[userId] = cleanKeys;
    db.save();

    res.json({ message: 'API Keys de Gemini guardadas correctamente', keys: cleanKeys });
});

// 3. Generar Quiz con IA (Gemini 3.5/3.6 Flash / Flash-Lite con Failover)
router.post('/generate-ai', authenticateToken, checkPermission('edit_academic'), async (req, res) => {
    const userId = req.user.id;
    const { topic, textContent, questionCount } = req.body;

    if (!db.data.user_api_keys) db.data.user_api_keys = {};
    const keys = db.data.user_api_keys[userId] || [];

    if (!keys || keys.length === 0) {
        return res.status(400).json({
            error: 'No tienes API Keys de Gemini registradas. Haz clic en "Configurar API Keys" e ingresa al menos una clave gratuita de Google AI Studio.'
        });
    }

    try {
        const result = await generateQuizWithGemini({
            keys,
            topic,
            textContent,
            questionCount
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Guardar Quiz creado en un Curso
router.post('/courses/:courseId', authenticateToken, checkPermission('edit_academic'), (req, res) => {
    const courseId = req.params.courseId;
    const { title, questions, mode, default_time } = req.body;

    if (!title || !questions || !Array.isArray(questions)) {
        return res.status(400).json({ error: 'Título y preguntas son requeridos' });
    }

    if (!db.data.course_quizzes) db.data.course_quizzes = [];

    const newQuiz = {
        id: `qz_${Date.now()}`,
        course_id: courseId,
        title,
        questions,
        mode: mode || 'individual', // 'individual' o 'teams'
        default_time: default_time || 20,
        created_by: req.user.id,
        created_at: new Date().toISOString()
    };

    db.data.course_quizzes.push(newQuiz);
    db.save();

    res.json({ message: 'Quiz creado e instalado en la materia', quiz: newQuiz });
});

// 4.1. Editar Quiz existente
router.put('/:id', authenticateToken, checkPermission('edit_academic'), (req, res) => {
    const quizId = req.params.id;
    const { title, questions, mode, default_time } = req.body;

    if (!db.data.course_quizzes) db.data.course_quizzes = [];
    const quiz = db.data.course_quizzes.find(q => q.id === quizId);

    if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });

    if (title) quiz.title = title;
    if (questions && Array.isArray(questions)) quiz.questions = questions;
    if (mode) quiz.mode = mode;
    if (default_time) quiz.default_time = default_time;

    db.save();
    res.json({ message: 'Quiz actualizado correctamente', quiz });
});

// 5. Listar Quizzes de un curso (Filtrado por creador/propiedad del usuario)
router.get('/courses/:courseId', authenticateToken, checkPermission('view_academic'), (req, res) => {
    const courseId = req.params.courseId;
    const userId = req.user.id;
    const isSuperAdmin = req.user.email === 'daviex14@gmail.com' || req.user.role_id === 'super_admin';

    if (!db.data.course_quizzes) db.data.course_quizzes = [];

    // Si es SuperAdmin ve todos; si no, ve únicamente los quizzes creados por su cuenta
    const list = db.data.course_quizzes.filter(q => q.course_id === courseId && (isSuperAdmin || q.created_by === userId));
    res.json(list);
});

// 6. Eliminar un Quiz (Propiedad del usuario)
router.delete('/:id', authenticateToken, checkPermission('edit_academic'), (req, res) => {
    const userId = req.user.id;
    const isSuperAdmin = req.user.email === 'daviex14@gmail.com' || req.user.role_id === 'super_admin';

    if (!db.data.course_quizzes) db.data.course_quizzes = [];
    const quiz = db.data.course_quizzes.find(q => q.id === req.params.id);

    if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });
    if (!isSuperAdmin && quiz.created_by !== userId) {
        return res.status(403).json({ error: 'No tienes permisos para administrar o eliminar este quiz' });
    }

    db.data.course_quizzes = db.data.course_quizzes.filter(q => q.id !== req.params.id);
    db.save();
    res.json({ message: 'Quiz eliminado' });
});

/* ================= SALAS DE JUEGO EN TIEMPO REAL (LIVE QUIZ ENGINE) ================= */

// A. Crear / Retomar una Sesión en Vivo (Host)
router.post('/:id/start-live', authenticateToken, checkPermission('edit_academic'), (req, res) => {
    const quizId = req.params.id;
    const userId = req.user.id;
    const isSuperAdmin = req.user.email === 'daviex14@gmail.com' || req.user.role_id === 'super_admin';

    if (!db.data.course_quizzes) db.data.course_quizzes = [];
    const quiz = db.data.course_quizzes.find(q => q.id === quizId);

    if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });
    if (!isSuperAdmin && quiz.created_by !== userId) {
        return res.status(403).json({ error: 'No tienes permisos para transmitir este quiz' });
    }

    if (!db.data.quiz_sessions) db.data.quiz_sessions = {};

    // RETOMAR SALA EXISTENTE: Verificar si ya hay una sala activa o en espera para este Quiz
    const existingPin = Object.keys(db.data.quiz_sessions).find(pin => {
        const s = db.data.quiz_sessions[pin];
        return s.quiz_id === quizId && (s.status === 'waiting' || s.status === 'question_active');
    });

    if (existingPin) {
        const session = db.data.quiz_sessions[existingPin];
        return res.json({ message: 'Retomando sala activa existente', pin: existingPin, session });
    }

    // Si no existe o terminó, generar PIN numérico único de 6 dígitos
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    const session = {
        pin,
        quiz_id: quiz.id,
        course_id: quiz.course_id,
        title: quiz.title,
        questions: quiz.questions,
        mode: quiz.mode || 'individual',
        status: 'waiting', // 'waiting', 'question_active', 'finished'
        current_question_index: 0,
        question_start_time: null,
        participants: {}, // { participant_id: { name, team, score, answers: {} } }
        created_at: new Date().toISOString()
    };

    db.data.quiz_sessions[pin] = session;
    db.save();

    res.json({ message: 'Sala en vivo iniciada', pin, session });
});

// B. Unirse a una Sala como Jugador/Alumno (Reconexión Automática si ya existe el nombre)
router.post('/session/:pin/join', (req, res) => {
    const pin = req.params.pin;
    const { name, team } = req.body;

    if (!db.data.quiz_sessions || !db.data.quiz_sessions[pin]) {
        return res.status(404).json({ error: 'La sala de juego no existe o ya ha finalizado' });
    }

    const session = db.data.quiz_sessions[pin];

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Ingresa un nombre para conectarte' });
    }

    const cleanName = name.trim();
    const existingEntry = Object.values(session.participants).find(p => p.name.toLowerCase() === cleanName.toLowerCase());

    let participantId;
    if (existingEntry) {
        // Reconexión: Mantener el mismo ID y estado
        participantId = existingEntry.id;
        if (team) existingEntry.team = team;
    } else {
        // Nuevo participante
        participantId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        session.participants[participantId] = {
            id: participantId,
            name: cleanName,
            team: team || 'Equipo Azul',
            score: 0,
            answers: {}
        };
    }

    db.save();

    res.json({
        message: existingEntry ? '¡Reconectado exitosamente!' : '¡Conectado exitosamente!',
        participant_id: participantId,
        pin,
        session_title: session.title,
        mode: session.mode
    });
});

// C. Obtener Estado Actual de la Sala (Con Avance Automático por Tiempo)
router.get('/session/:pin/status', (req, res) => {
    const pin = req.params.pin;
    if (!db.data.quiz_sessions || !db.data.quiz_sessions[pin]) {
        return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    const session = db.data.quiz_sessions[pin];
    let currentQIndex = session.current_question_index;
    let currentQ = session.questions[currentQIndex] || null;

    // AUTO-AVANCE AUTOMÁTICO DE PREGUNTAS POR TIEMPO
    if (session.status === 'question_active' && currentQ && session.question_start_time) {
        const timeLimitSec = (currentQ.time_seconds || 20);
        const elapsedSec = (Date.now() - session.question_start_time) / 1000;

        // Si expiró el tiempo + 3s de gracia para ver respuestas/explicación
        if (elapsedSec >= timeLimitSec + 3) {
            if (currentQIndex < session.questions.length - 1) {
                session.current_question_index += 1;
                session.question_start_time = Date.now();
                currentQIndex = session.current_question_index;
                currentQ = session.questions[currentQIndex];
            } else {
                session.status = 'finished';
            }
            db.save();
        }
    }

    // Calcular ranking individual
    const participantsList = Object.values(session.participants);
    const ranking = [...participantsList].sort((a, b) => b.score - a.score);

    // Calcular ranking por equipos si es modo equipos
    const teamScores = {};
    if (session.mode === 'teams') {
        participantsList.forEach(p => {
            const t = p.team || 'Sin Equipo';
            teamScores[t] = (teamScores[t] || 0) + p.score;
        });
    }

    res.json({
        pin: session.pin,
        title: session.title,
        status: session.status,
        mode: session.mode,
        total_questions: session.questions.length,
        current_question_index: currentQIndex,
        current_question: currentQ ? {
            id: currentQ.id,
            question: currentQ.question,
            options: currentQ.options,
            correct_index: session.status === 'finished' ? currentQ.correct_index : undefined,
            time_seconds: currentQ.time_seconds || 20
        } : null,
        question_start_time: session.question_start_time,
        participants_count: participantsList.length,
        ranking,
        team_scores: teamScores
    });
});

// D. Avanzar Pregunta o Iniciar Quiz (Host)
router.post('/session/:pin/next-question', authenticateToken, checkPermission('edit_academic'), (req, res) => {
    const pin = req.params.pin;
    if (!db.data.quiz_sessions || !db.data.quiz_sessions[pin]) {
        return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    const session = db.data.quiz_sessions[pin];
    const { action } = req.body; // 'start', 'next', 'finish'

    if (action === 'start') {
        session.status = 'question_active';
        session.current_question_index = 0;
        session.question_start_time = Date.now();
    } else if (action === 'next') {
        if (session.current_question_index < session.questions.length - 1) {
            session.current_question_index += 1;
            session.status = 'question_active';
            session.question_start_time = Date.now();
        } else {
            session.status = 'finished';
        }
    } else if (action === 'finish') {
        session.status = 'finished';
    }

    db.save();
    res.json({ message: 'Estado actualizado', session_status: session.status, current_index: session.current_question_index });
});

// E. Responder Pregunta (Participante)
router.post('/session/:pin/answer', (req, res) => {
    const pin = req.params.pin;
    const { participant_id, question_index, option_index } = req.body;

    if (!db.data.quiz_sessions || !db.data.quiz_sessions[pin]) {
        return res.status(404).json({ error: 'Sesión finalizada o no encontrada' });
    }

    const session = db.data.quiz_sessions[pin];

    if (session.status !== 'question_active') {
        return res.status(400).json({ error: 'La pregunta no está activa en este momento' });
    }

    const participant = session.participants[participant_id];
    if (!participant) {
        return res.status(404).json({ error: 'Participante no registrado' });
    }

    // Prevenir doble respuesta a la misma pregunta
    if (participant.answers[question_index] !== undefined) {
        return res.json({ message: 'Ya has respondido esta pregunta', score: participant.score });
    }

    const question = session.questions[question_index];
    if (!question) {
        return res.status(404).json({ error: 'Pregunta no válida' });
    }

    const isCorrect = (parseInt(option_index) === parseInt(question.correct_index));
    let pointsEarned = 0;

    if (isCorrect) {
        // Bonificación por rapidez (máx 1000 pts)
        const elapsed = (Date.now() - (session.question_start_time || Date.now())) / 1000;
        const totalTime = question.time_seconds || 20;
        const timeFactor = Math.max(0.4, 1 - (elapsed / totalTime));
        pointsEarned = Math.round(1000 * timeFactor);
        participant.score += pointsEarned;
    }

    participant.answers[question_index] = {
        option_index,
        is_correct: isCorrect,
        points: pointsEarned,
        timestamp: Date.now()
    };

    db.save();

    res.json({
        is_correct: isCorrect,
        points_earned: pointsEarned,
        total_score: participant.score,
        explanation: question.explanation || ''
    });
});

module.exports = router;
