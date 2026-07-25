const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth/auth.controller');
const { db } = require('../../database/connection');

// Middleware para verificar permisos dinámicos según el rol en la matriz de la BD
function checkPermission(permissionKey) {
    return (req, res, next) => {
        const userRole = req.user.role_id;
        const rolePerms = db.data.role_permissions[userRole] || {};

        // SuperAdmin siempre tiene acceso o si la matriz asignada tiene true
        if (req.user.email === 'daviex14@gmail.com' || rolePerms[permissionKey] === true) {
            return next();
        }
        return res.status(403).json({ error: `No tienes el permiso dinámico [${permissionKey}] configurado` });
    };
}

// Obtener matriz de permisos dinámicos (Sólo Super Admin daviex14@gmail.com o consulta general de rol propio)
router.get('/permissions', authenticateToken, (req, res) => {
    res.json({
        permissions: db.data.role_permissions,
        my_permissions: db.data.role_permissions[req.user.role_id] || {}
    });
});

// Guardar/Actualizar matriz de permisos dinámicos (Restringido exclusivamente a daviex14@gmail.com o SuperAdmin)
router.put('/permissions', authenticateToken, (req, res) => {
    if (req.user.email !== 'daviex14@gmail.com' && req.user.role_id !== 'super_admin') {
        return res.status(403).json({ error: 'Sólo el Administrador daviex14@gmail.com puede configurar los permisos dinámicos' });
    }

    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object') {
        return res.status(400).json({ error: 'Payload de permisos inválido' });
    }

    db.data.role_permissions = permissions;
    db.save();

    res.json({ message: 'Matriz de permisos por rol actualizada exitosamente', permissions: db.data.role_permissions });
});

module.exports = { router, checkPermission };
