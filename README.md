# 🎓 AcademiControl - Sistema de Gestión Escolar SaaS (Offline-First)

**AcademiControl** es una plataforma de gestión académica integral desarrollada con arquitectura **Offline-First**, diseñada para colegios e instituciones educativas. Permite operar de forma ininterrumpida sin conexión a internet y sincronizar automáticamente al recuperar señal.

---

## 🌟 Características Principales

- **Quizzes Interactivos en Tiempo Real con IA (NUEVO)**:
  - **Generador de Quizzes con Inteligencia Artificial**: Integración directa con los modelos de alta velocidad **Google Gemini 3.5/3.6 Flash y Flash-Lite**.
  - **Gestor Privado de API Keys con Failover**: Cada usuario configura sus propias claves desde [Google AI Studio](https://aistudio.google.com/app/apikey). Si una clave agota su cuota, el motor conmuta automáticamente a la siguiente clave sin interrumpir la experiencia.
  - **Generación por Tema o Texto/Apunte**: Asistente con pestañas independientes para redactar una idea o pegar un fragmento extenso de texto.
  - **Número de Preguntas Personalizado**: Especifica libremente la cantidad exacta de preguntas a generar (ej: 4, 7, 10 preguntas).
  - **Salas Multijugador con Código QR y PIN**: Escaneo dinámico desde dispositivos móviles para que los alumnos ingresen al instante.
  - **Modos de Juego**: Modalidad **Individual** (Todos vs Todos) o **Por Equipos** con puntajes consolidados.
  - **Transmisión y Control en Vivo**: Panel del Host (Docente) con avance de preguntas, botones para **Detener** o **Reiniciar** la sala en cualquier momento y tabla de posiciones (Ranking) actualizada en tiempo real.
  - **Resiliencia & Reconexión Antidesconexión**: Persistencia total de la sala en base de datos local y almacenamiento de sesión en el navegador (`localStorage`) para reconectar automáticamente a los participantes tras recargar la pantalla o perder señal.
- **Arquitectura Monolítica Offline-First (PWA)**: Registra eventos locales y mutaciones cuando no hay conexión.
- **Sistema RBAC & Matriz de Permisos Dinámica**:
  - Matriz configurable por el Administrador (`daviex14@gmail.com`) en tiempo de ejecución.
  - Gestión granular de permisos por rol (`Ver`, `Editar`, `Eliminar` para Cursos, Usuarios, Notas y `Carga Académica`).
- **Control de Roles**:
  - **Super Admin**: Control absoluto del sistema y matriz de permisos.
  - **Director de Colegio**: Gestión integral de la sucursal académica.
  - **Personal Administrativo**: Registro de usuarios, matrículas y cobros.
  - **Docente**: Gestión de cursos, temas, evaluaciones con IA, notas y carga académica.
  - **Apoderado**: Vinculación de hijos y consulta de libretas de notas de sus representados.
  - **Alumno**: Consulta de calificaciones personales, ingreso a Quizzes y diplomas de honor.
- **Exportación en Lote**:
  - **Exportación a Excel (`.xlsx`)**: Disponible en todos los módulos (Académico, Usuarios, Notas, Certificados, Sync).
  - **Libretas de Notas en PDF**: Generación individual o masiva por alumno con diseño imprimible profesional.
- **Diseño Moderno & UI Premium**:
  - Estética Glassmorphism, scrollbars personalizadas y experiencia adaptada 100% a móviles.
  - Modales flotantes elegantes en lugar de diálogos nativos (`alert`/`confirm`) del navegador.

---

## ⚡ Guía de Uso del Módulo de Quizzes con IA

1. **Configurar tu API Key de Google Gemini**:
   - En la sección **Académico & Niveles**, haz clic en el botón de un curso **Clases / Contenido**.
   - Presiona **Añadir Quiz con IA** y haz clic en **Configurar API Keys**.
   - Haz clic en el enlace hacia [Google AI Studio](https://aistudio.google.com/app/apikey), genera tu clave gratuita, regístrala y guárdala. Puedes agregar más de una clave para activar el **Failover automático**.

2. **Crear o Generar un Quiz con IA**:
   - Selecciona si deseas generar el quiz a partir de un **Tema / Idea** (ej. *"Leyes de Newton"*) o pegando un **Texto / Apunte**.
   - Digita el número de preguntas deseado y selecciona el modo (*Individual* o *Por Equipos*).
   - Presiona **Generar Preguntas con IA**. Podrás editar preguntas, cambiar opciones, reordenar y ajustar los segundos por pregunta antes de guardar.

3. **Transmitir en Tiempo Real**:
   - En el panel de clases del curso, presiona **Transmitir en Vivo (QR)** en el Quiz guardado.
   - Proyecta el **Código QR** o comparte el PIN de 6 dígitos con los alumnos.
   - Al conectarse los participantes, presiona **Iniciar Quiz**. El sistema transmitirá las preguntas con cuenta regresiva, auto-avance y ranking en tiempo real.

---

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js, Express.js, JWT, Bcryptjs.
- **IA**: Google Gemini REST API (Gemini 3.5/3.6 Flash y Flash-Lite) con Failover Multi-Key.
- **Frontend**: Vanilla HTML5, CSS3 Glassmorphic, JavaScript ES6+ desacoplado (`quiz-live-engine.js`), Lucide Icons.
- **Librerías Integradas**: `qrcodejs` (Generación de QR) y SheetJS (`xlsx`).
- **Base de Datos**: Motor Relacional SQLite Puro sobre JSON Persistente (`academicontrol_db.json`).

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
