# 🎓 AcademiControl - Sistema de Gestión Escolar SaaS (Offline-First)

**AcademiControl** es una plataforma de gestión académica integral desarrollada con arquitectura **Offline-First**, diseñada para colegios e instituciones educativas. Permite operar de forma ininterrumpida sin conexión a internet y sincronizar automáticamente al recuperar señal.

---

## 🌟 Características Principales

- **Arquitectura Monolítica Offline-First (PWA)**: Registra eventos locales y mutaciones cuando no hay conexión.
- **Sistema RBAC & Matriz de Permisos Dinámica**:
  - Matriz configurable por el Administrador (`daviex14@gmail.com`) en tiempo de ejecución.
  - Gestión granular de permisos por rol (`Ver`, `Editar`, `Eliminar` para Cursos, Usuarios, Notas y `Carga Académica`).
- **Control de Roles**:
  - **Super Admin**: Control absoluto del sistema y matriz de permisos.
  - **Director de Colegio**: Gestión integral de la sucursal académica.
  - **Personal Administrativo**: Registro de usuarios, matrículas y cobros.
  - **Docente**: Gestión de notas, asistencia y elección/asignación de carga académica.
  - **Apoderado**: Vinculación de hijos y consulta de libretas de notas de sus representados.
  - **Alumno**: Consulta de calificaciones personales y diplomas de honor.
- **Exportación en Lote**:
  - **Exportación a Excel (`.xlsx`)**: Disponible en todos los módulos (Académico, Usuarios, Notas, Certificados, Sync).
  - **Libretas de Notas en PDF**: Generación individual o masiva por alumno con diseño imprimible profesional.
- **Diseño Moderno & UI Premium**:
  - Estética Glassmorphism, íconos vectoriales SVG centrándose verticalmente (Lucide Icons).
  - Sistema de modales animados y notificaciones Toast interactivos.

---

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js, Express.js, JWT, Bcryptjs.
- **Frontend**: Vanilla HTML5, CSS3 Glassmorphism, JavaScript (ES6+), Lucide Icons.
- **Base de Datos**: Motor Relacional SQLite Puro sobre JSON Persistente (`academicontrol_db.json`).
- **Librerías Integradas**: SheetJS (`xlsx`) para exportación a Excel.

---

## 🚀 Instrucciones de Instalación y Uso

### 1. Requisitos Previos

- [Node.js](https://nodejs.org/) (Versión 18 o superior).
- Gestor de paquetes `pnpm` (o `npm`).

### 2. Instalación de Dependencias

Clona el repositorio e instala los paquetes necesarios:

```bash
git clone https://github.com/mrryzensor/AcademiControl.git
cd AcademiControl
pnpm install
```

### 3. Ejecutar la Aplicación

Para iniciar el servidor localmente:

```bash
node server.js
```

El sistema iniciará en **`http://localhost:3000`**.

---

## 🔑 Credenciales por Defecto (Demo)

| Rol | Correo Electrónico | Contraseña |
|---|---|---|
| **Super Admin** | `daviex14@gmail.com` | `Admin123!` |
| **Director Colegio** | `director@colegio.edu` | `Admin123!` |
| **Staff Admin** | `secretaria@colegio.edu` | `Admin123!` |
| **Docente** | `carlos.mendoza@colegio.edu` | `Admin123!` |
| **Alumno** | `lucia.student@colegio.edu` | `Admin123!` |
| **Apoderado** | `roberto.parent@gmail.com` | `Admin123!` |

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**.
