const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth/auth.controller');
const { db } = require('../../database/connection');

// Sync mutations endpoint
router.post('/push', authenticateToken, (req, res) => {
    const { events } = req.body;
    if (!Array.isArray(events)) {
        return res.status(400).json({ error: 'Payload de sincronización inválido' });
    }

    events.forEach(ev => {
        db.insert('sync_events', {
            id: ev.id || `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            user_id: req.user.id,
            action: ev.action,
            payload: JSON.stringify(ev.payload),
            status: 'processed',
            timestamp: new Date().toISOString()
        });
    });

    res.json({ message: 'Eventos de sincronización procesados correctamente', syncedCount: events.length });
});

// Endpoint de prueba de salud de conexión
router.get('/ping', (req, res) => {
    res.json({ status: 'online', timestamp: new Date().toISOString() });
});

module.exports = router;
