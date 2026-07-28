const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDb } = require('./src/database/connection');

const authController = require('./src/modules/auth/auth.controller');
const analyticsController = require('./src/modules/analytics/analytics.controller');
const syncController = require('./src/modules/sync/sync.controller');
const academicController = require('./src/modules/academic/academic.controller');
const usersController = require('./src/modules/users/users.controller');
const gradesController = require('./src/modules/grades/grades.controller');
const permissionsController = require('./src/modules/permissions/permissions.controller');
const quizController = require('./src/modules/quizzes/quiz.controller');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// API Routes
app.use('/api/v1/auth', authController.router);
app.use('/api/v1/analytics', analyticsController);
app.use('/api/v1/sync', syncController);
app.use('/api/v1/academic', academicController);
app.use('/api/v1/users', usersController);
app.use('/api/v1/grades', gradesController);
app.use('/api/v1/permissions', permissionsController.router);
app.use('/api/v1/quizzes', quizController);

// Single Page Application Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🚀 AcademiControl SaaS con Matriz de Permisos Dinámicos en puerto: ${PORT}`);
        console.log(`=======================================================`);
    });
});
