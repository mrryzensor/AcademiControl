const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../../database/connection');

const JWT_SECRET = 'academicontrol_secret_key_2026';

// Login Endpoint
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Correo y contraseña requeridos.' });
    }

    const user = db.data.users.find(u => u.email === email);
    if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const role = db.data.roles.find(r => r.id === user.role_id);
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
        return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, role_id: user.role_id, tenant_id: user.tenant_id },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({
        message: 'Autenticación exitosa',
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role_id: user.role_id,
            role_name: role ? role.name : user.role_id,
            tenant_id: user.tenant_id
        }
    });
});

// Middleware de verificación de Token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Acceso no autorizado' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
        req.user = user;
        next();
    });
}

module.exports = { router, authenticateToken };
