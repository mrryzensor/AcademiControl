/**
 * QuizLiveEngine - Módulo Cliente Independiente para Quizzes Interactivos en Tiempo Real con IA (Gemini 3.5/3.6 Flash/Lite), QR y Ranking.
 */
const QuizLiveEngine = (() => {
    let pollingInterval = null;
    let currentSessionPin = null;

    // Helper fetch con token
    async function apiFetch(url, options = {}) {
        const token = localStorage.getItem('ac_token');
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(url, { ...options, headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error en la petición');
        return data;
    }

    /* ================= 1. GESTOR DE API KEYS DE GEMINI (POR USUARIO) ================= */
    async function openApiKeysModal() {
        showModal("🔑 Configurar API Keys de Google Gemini (Por Usuario)", `
            <div style="display:flex; flex-direction:column; gap:1.25rem; width:100%;">
                <div style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.25); padding:1rem; border-radius:10px;">
                    <p style="font-size:0.88rem; color:var(--text-main); margin-bottom:0.5rem; line-height:1.5;">
                        Cada usuario puede registrar sus propias claves de API de Google Gemini. El sistema almacenará tus claves de forma privada en tu perfil y utilizará un algoritmo de <strong>Failover automático</strong>: si una clave se agota o supera la cuota gratuita, cambiará automáticamente a la siguiente.
                    </p>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="color:#60a5fa; font-weight:600; text-decoration:underline; font-size:0.9rem; display:inline-flex; align-items:center; gap:0.3rem;">
                        👉 Obtener API Key Gratuita en Google AI Studio <i data-lucide="external-link" style="width:14px; height:14px;"></i>
                    </a>
                </div>

                <form id="api-keys-form" style="display:flex; flex-direction:column; gap:1rem;">
                    <div id="keys-input-list" style="display:flex; flex-direction:column; gap:0.75rem;">
                        <p style="color:var(--text-muted); font-size:0.85rem;">Cargando tus claves...</p>
                    </div>

                    <button type="button" class="role-chip" style="align-self:flex-start; background:rgba(255,255,255,0.08); color:var(--text-main); border:1px solid var(--bg-card-border);" onclick="QuizLiveEngine.addKeyInputRow()">
                        <i data-lucide="plus"></i> Añadir otra API Key (Failover)
                    </button>

                    <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid var(--bg-card-border); padding-top:1rem;">
                        <button type="button" class="btn-primary" style="background:rgba(255,255,255,0.1); color:var(--text-muted);" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn-primary"><i data-lucide="save"></i> Guardar API Keys</button>
                    </div>
                </form>
            </div>
        `, true);

        if (window.lucide) lucide.createIcons();

        try {
            const data = await apiFetch('/api/v1/quizzes/api-keys');
            const keys = data.keys || [];
            const listEl = document.getElementById('keys-input-list');
            listEl.innerHTML = '';

            if (keys.length === 0) {
                addKeyInputRow('');
            } else {
                keys.forEach(k => addKeyInputRow(k));
            }
        } catch(e) {
            showToast(e.message, "error");
        }

        document.getElementById('api-keys-form').onsubmit = async (e) => {
            e.preventDefault();
            const inputs = document.querySelectorAll('.user-gemini-key-input');
            const keys = Array.from(inputs).map(inp => inp.value.trim()).filter(val => val.length > 0);

            try {
                await apiFetch('/api/v1/quizzes/api-keys', {
                    method: 'POST',
                    body: JSON.stringify({ keys })
                });
                showToast("¡API Keys guardadas exitosamente!", "success");
                closeModal();
            } catch(err) {
                showToast(err.message, "error");
            }
        };
    }

    function addKeyInputRow(val = '') {
        const listEl = document.getElementById('keys-input-list');
        if (!listEl) return;
        const row = document.createElement('div');
        row.style.cssText = "display:flex; gap:0.5rem; align-items:center;";
        row.innerHTML = `
            <input type="password" class="form-input user-gemini-key-input" placeholder="AIzaSy..." value="${val}" style="flex:1;" required>
            <button type="button" class="role-chip btn-delete" style="padding:0.6rem;" onclick="this.parentElement.remove()">
                <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
        `;
        listEl.appendChild(row);
        if (window.lucide) lucide.createIcons();
    }

    /* ================= 2. ASISTENTE WIZARD: AÑADIR / GENERAR QUIZ CON IA ================= */
    function openQuizWizard(courseId, courseName) {
        showModal(`Añadir Quiz con Inteligencia Artificial - ${courseName}`, `
            <div style="display:flex; flex-direction:column; gap:1.25rem; width:100%; height:100%;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--bg-card-border); padding-bottom:0.75rem;">
                    <span style="font-size:0.9rem; color:var(--text-muted);">Generador IA Gemini 3.5/3.6 Flash / Flash-Lite</span>
                    <button class="role-chip" style="background:rgba(234,179,8,0.15); color:#facc15; border:1px solid rgba(234,179,8,0.3);" onclick="QuizLiveEngine.openApiKeysModal()">
                        <i data-lucide="key" style="width:14px; height:14px;"></i> Configurar API Keys
                    </button>
                </div>

                <!-- Tabs de Modo: Por Tema o Por Texto -->
                <div style="display:flex; gap:0.5rem; background:rgba(255,255,255,0.05); padding:0.35rem; border-radius:8px;">
                    <button id="tab-mode-topic" class="role-chip" style="flex:1; text-align:center; padding:0.5rem; background:var(--accent-blue); color:white;" onclick="QuizLiveEngine.switchGeneratorMode('topic')">
                        <i data-lucide="sparkles"></i> Por Tema / Idea
                    </button>
                    <button id="tab-mode-text" class="role-chip" style="flex:1; text-align:center; padding:0.5rem; background:transparent; color:var(--text-muted);" onclick="QuizLiveEngine.switchGeneratorMode('text')">
                        <i data-lucide="file-text"></i> Pegar Texto / Apunte
                    </button>
                </div>

                <form id="ai-quiz-generator-form" style="display:flex; flex-direction:column; gap:1rem; flex:1; width:100%;">
                    <div id="field-topic-container" class="form-group" style="width:100%; flex:none;">
                        <label style="font-weight:600;">Escribe el Tema sobre el cual generarás las preguntas</label>
                        <input type="text" id="ai-topic-input" class="form-input" style="width:100%;" placeholder="Ej. Las Leyes de Newton y Mecánica Clásica">
                    </div>

                    <div id="field-text-container" class="form-group" style="display:none; width:100%; flex:none;">
                        <label style="font-weight:600;">Pega el contenido teórico o resumen del tema</label>
                        <textarea id="ai-text-input" class="form-input" style="width:100%; min-height:140px; resize:vertical;" placeholder="Pega aquí el texto completo de tu clase o libro..."></textarea>
                    </div>

                    <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                        <div class="form-group" style="flex:1; min-width:140px;">
                            <label style="font-weight:600;">Cantidad de Preguntas (Personalizado)</label>
                            <input type="number" id="ai-count-input" class="form-input" value="5" min="1" max="25" placeholder="Ej. 7" required>
                        </div>
                        <div class="form-group" style="flex:1; min-width:140px;">
                            <label style="font-weight:600;">Modo por Defecto</label>
                            <select id="quiz-mode-input" class="form-input">
                                <option value="individual" selected>Individual (Todos vs Todos)</option>
                                <option value="teams">Por Equipos (Puntaje Consolidado)</option>
                            </select>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:0.75rem; padding-top:0.5rem;">
                        <button type="button" class="btn-primary" style="background:rgba(255,255,255,0.1); color:var(--text-muted);" onclick="openCourseLessonsModal('${courseId}', '${courseName}')">Volver</button>
                        <button type="submit" id="btn-generate-ai" class="btn-primary" style="background:linear-gradient(135deg, #8b5cf6, #ec4899);">
                            <i data-lucide="wand-2"></i> Generar Preguntas con IA
                        </button>
                    </div>
                </form>

                <!-- Vista Previa / Editor del Quiz Generado -->
                <div id="quiz-preview-editor" style="display:none; flex-direction:column; gap:1rem; flex:1; overflow-y:auto; border-top:1px solid var(--bg-card-border); padding-top:1rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h4 style="font-size:1.1rem; color:var(--text-main); font-weight:600;">Borrador Generado (Puedes editar u reordenar)</h4>
                        <button class="role-chip" style="background:rgba(16,185,129,0.2); color:#34d399;" onclick="QuizLiveEngine.addNewCustomQuestion()">
                            <i data-lucide="plus"></i> Añadir Pregunta Manual
                        </button>
                    </div>
                    <div class="form-group">
                        <label style="font-weight:600;">Título del Quiz</label>
                        <input type="text" id="preview-quiz-title" class="form-input" required>
                    </div>
                    <div id="preview-questions-list" style="display:flex; flex-direction:column; gap:1rem;"></div>

                    <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1rem;">
                        <button type="button" class="btn-primary" style="background:rgba(255,255,255,0.1);" onclick="document.getElementById('quiz-preview-editor').style.display='none'; document.getElementById('ai-quiz-generator-form').style.display='flex';">Regenerar</button>
                        <button type="button" class="btn-primary" onclick="QuizLiveEngine.saveCreatedQuiz('${courseId}', '${courseName}')">
                            <i data-lucide="check-circle"></i> Guardar Quiz en el Curso
                        </button>
                    </div>
                </div>
            </div>
        `, 'full');

        if (window.lucide) lucide.createIcons();

        let currentActiveMode = 'topic';

        document.getElementById('ai-quiz-generator-form').onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-generate-ai');
            const originalText = btn.innerHTML;

            const topicVal = document.getElementById('ai-topic-input').value.trim();
            const textVal = document.getElementById('ai-text-input').value.trim();
            const questionCount = document.getElementById('ai-count-input').value;

            const isTopicMode = document.getElementById('field-topic-container').style.display !== 'none';

            const topic = isTopicMode ? topicVal : '';
            const textContent = !isTopicMode ? textVal : '';

            if (isTopicMode && !topic) {
                return showToast("Ingresa un Tema o Idea para generar el Quiz", "error");
            }
            if (!isTopicMode && !textContent) {
                return showToast("Pega el texto o apunte para generar el Quiz", "error");
            }

            btn.disabled = true;
            btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Procesando con Gemini...`;
            if (window.lucide) lucide.createIcons();

            try {
                const data = await apiFetch('/api/v1/quizzes/generate-ai', {
                    method: 'POST',
                    body: JSON.stringify({ topic, textContent, questionCount })
                });

                showToast(`¡Quiz generado exitosamente con ${data.modelUsed}!`, "success");
                renderQuizPreview(data.quiz);

                document.getElementById('ai-quiz-generator-form').style.display = 'none';
                document.getElementById('quiz-preview-editor').style.display = 'flex';
            } catch(err) {
                showToast(err.message, "error");
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
                if (window.lucide) lucide.createIcons();
            }
        };
    }

    function switchGeneratorMode(mode) {
        const tabTopic = document.getElementById('tab-mode-topic');
        const tabText = document.getElementById('tab-mode-text');
        const topicCont = document.getElementById('field-topic-container');
        const textCont = document.getElementById('field-text-container');

        if (mode === 'topic') {
            tabTopic.style.background = 'var(--accent-blue)';
            tabTopic.style.color = 'white';
            tabText.style.background = 'transparent';
            tabText.style.color = 'var(--text-muted)';
            topicCont.style.display = 'flex';
            textCont.style.display = 'none';
        } else {
            tabText.style.background = 'var(--accent-blue)';
            tabText.style.color = 'white';
            tabTopic.style.background = 'transparent';
            tabTopic.style.color = 'var(--text-muted)';
            textCont.style.display = 'flex';
            topicCont.style.display = 'none';
        }
    }

    function renderQuizPreview(quizData) {
        document.getElementById('preview-quiz-title').value = quizData.title || 'Quiz de Evaluación en Vivo';
        const listEl = document.getElementById('preview-questions-list');
        listEl.innerHTML = '';

        const questions = quizData.questions || [];
        questions.forEach((q, idx) => {
            listEl.appendChild(createQuestionCardElement(q, idx));
        });
        if (window.lucide) lucide.createIcons();
    }

    function createQuestionCardElement(q, idx) {
        const card = document.createElement('div');
        card.className = 'q-preview-card';
        card.style.cssText = "background:rgba(15,23,42,0.7); border:1px solid var(--bg-card-border); border-radius:10px; padding:1.25rem; display:flex; flex-direction:column; gap:0.75rem;";
        
        const optionsHtml = (q.options || ["", "", "", ""]).map((opt, oIdx) => `
            <div style="display:flex; gap:0.5rem; align-items:center;">
                <input type="radio" name="correct_${idx}" value="${oIdx}" ${q.correct_index === oIdx ? 'checked' : ''}>
                <input type="text" class="form-input q-option-input" value="${opt}" placeholder="Opción ${oIdx + 1}" required style="padding:0.4rem 0.6rem; font-size:0.85rem;">
            </div>
        `).join('');

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; color:var(--accent-purple);">Pregunta #${idx + 1}</span>
                <div style="display:flex; gap:0.35rem; align-items:center;">
                    <label style="font-size:0.75rem; color:var(--text-muted);">Tiempo:</label>
                    <select class="form-input q-time-input" style="padding:0.2rem 0.4rem; font-size:0.8rem; width:80px;">
                        <option value="15" ${q.time_seconds == 15 ? 'selected' : ''}>15s</option>
                        <option value="20" ${q.time_seconds == 20 || !q.time_seconds ? 'selected' : ''}>20s</option>
                        <option value="30" ${q.time_seconds == 30 ? 'selected' : ''}>30s</option>
                        <option value="60" ${q.time_seconds == 60 ? 'selected' : ''}>60s</option>
                    </select>
                    <button type="button" class="role-chip" onclick="QuizLiveEngine.moveQuestionUp(this)"><i data-lucide="arrow-up" style="width:14px;"></i></button>
                    <button type="button" class="role-chip" onclick="QuizLiveEngine.moveQuestionDown(this)"><i data-lucide="arrow-down" style="width:14px;"></i></button>
                    <button type="button" class="role-chip btn-delete" onclick="this.closest('.q-preview-card').remove()"><i data-lucide="trash-2" style="width:14px;"></i></button>
                </div>
            </div>

            <input type="text" class="form-input q-text-input" value="${q.question || ''}" placeholder="Texto de la pregunta" required style="font-weight:600;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.3rem;">
                ${optionsHtml}
            </div>
            <input type="text" class="form-input q-exp-input" value="${q.explanation || ''}" placeholder="Explicación / Retroalimentación breve" style="font-size:0.8rem; color:var(--text-muted);">
        `;
        return card;
    }

    function moveQuestionUp(btn) {
        const card = btn.closest('.q-preview-card');
        if (card.previousElementSibling) {
            card.parentNode.insertBefore(card, card.previousElementSibling);
        }
    }

    function moveQuestionDown(btn) {
        const card = btn.closest('.q-preview-card');
        if (card.nextElementSibling) {
            card.parentNode.insertBefore(card.nextElementSibling, card);
        }
    }

    function addNewCustomQuestion() {
        const listEl = document.getElementById('preview-questions-list');
        const count = listEl.children.length;
        const newCard = createQuestionCardElement({
            question: '',
            options: ['', '', '', ''],
            correct_index: 0,
            time_seconds: 20,
            explanation: ''
        }, count);
        listEl.appendChild(newCard);
        if (window.lucide) lucide.createIcons();
    }

    let editingQuizId = null;

    async function openEditQuizModal(quizId, courseId, courseName) {
        editingQuizId = quizId;
        try {
            const quizzes = await apiFetch(`/api/v1/quizzes/courses/${courseId}`);
            const quiz = quizzes.find(q => q.id === quizId);
            if (!quiz) return showToast("Quiz no encontrado", "error");

            showModal(`Editar Quiz - ${quiz.title}`, `
                <div style="display:flex; flex-direction:column; gap:1.25rem; width:100%; height:100%;">
                    <div id="quiz-preview-editor" style="display:flex; flex-direction:column; gap:1rem; flex:1; overflow-y:auto;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h4 style="font-size:1.1rem; color:var(--text-main); font-weight:600;">Editar Preguntas y Duraciones</h4>
                            <button class="role-chip" style="background:rgba(16,185,129,0.2); color:#34d399;" onclick="QuizLiveEngine.addNewCustomQuestion()">
                                <i data-lucide="plus"></i> Añadir Pregunta Manual
                            </button>
                        </div>
                        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                            <div class="form-group" style="flex:2;">
                                <label style="font-weight:600;">Título del Quiz</label>
                                <input type="text" id="preview-quiz-title" class="form-input" value="${quiz.title}" required>
                            </div>
                            <div class="form-group" style="flex:1;">
                                <label style="font-weight:600;">Modo de Juego</label>
                                <select id="quiz-mode-input" class="form-input">
                                    <option value="individual" ${quiz.mode === 'individual' ? 'selected' : ''}>Individual</option>
                                    <option value="teams" ${quiz.mode === 'teams' ? 'selected' : ''}>Por Equipos</option>
                                </select>
                            </div>
                        </div>

                        <div id="preview-questions-list" style="display:flex; flex-direction:column; gap:1rem;"></div>

                        <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1rem;">
                            <button type="button" class="btn-primary" style="background:rgba(255,255,255,0.1);" onclick="openCourseLessonsModal('${courseId}', '${courseName}')">Cancelar</button>
                            <button type="button" class="btn-primary" onclick="QuizLiveEngine.saveCreatedQuiz('${courseId}', '${courseName}')">
                                <i data-lucide="save"></i> Actualizar Quiz
                            </button>
                        </div>
                    </div>
                </div>
            `, 'full');

            renderQuizPreview(quiz);
        } catch(err) {
            showToast(err.message, "error");
        }
    }

    async function saveCreatedQuiz(courseId, courseName) {
        const title = document.getElementById('preview-quiz-title').value.trim();
        const mode = document.getElementById('quiz-mode-input').value;
        const cardEls = document.querySelectorAll('.q-preview-card');

        if (!title) return showToast("Ingresa un título para el Quiz", "error");
        if (cardEls.length === 0) return showToast("Debes incluir al menos 1 pregunta", "error");

        const questions = [];
        let hasError = false;

        cardEls.forEach((card, idx) => {
            const qText = card.querySelector('.q-text-input').value.trim();
            const timeSec = parseInt(card.querySelector('.q-time-input').value) || 20;
            const expText = card.querySelector('.q-exp-input').value.trim();
            const optionInps = card.querySelectorAll('.q-option-input');
            const radioChecked = card.querySelector(`input[name="correct_${idx}"]:checked`);

            const options = Array.from(optionInps).map(inp => inp.value.trim());
            const correctIndex = radioChecked ? parseInt(radioChecked.value) : 0;

            if (!qText || options.some(o => !o)) {
                hasError = true;
            }

            questions.push({
                id: `q_${idx + 1}`,
                question: qText,
                options,
                correct_index: correctIndex,
                time_seconds: timeSec,
                explanation: expText
            });
        });

        if (hasError) return showToast("Por favor completa el texto y todas las opciones de las preguntas", "error");

        try {
            if (editingQuizId) {
                await apiFetch(`/api/v1/quizzes/${editingQuizId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ title, questions, mode })
                });
                editingQuizId = null;
                showToast("¡Quiz actualizado correctamente!", "success");
            } else {
                await apiFetch(`/api/v1/quizzes/courses/${courseId}`, {
                    method: 'POST',
                    body: JSON.stringify({ title, questions, mode })
                });
                showToast("¡Quiz guardado correctamente en la materia!", "success");
            }
            openCourseLessonsModal(courseId, courseName);
        } catch(err) {
            showToast(err.message, "error");
        }
    }

    /* ================= 3. TRANSMISIÓN EN TIEMPO REAL (LIVE SESSION HOST & PARTICIPANTE) ================= */
    async function startLiveSession(quizId) {
        try {
            const res = await apiFetch(`/api/v1/quizzes/${quizId}/start-live`, { method: 'POST' });
            openHostLiveControlRoom(res.pin);
        } catch(err) {
            showToast(err.message, "error");
        }
    }

    function openHostLiveControlRoom(pin) {
        currentSessionPin = pin;
        if (pollingInterval) clearInterval(pollingInterval);

        const joinUrl = `${window.location.origin}/#quiz-${pin}`;

        showModal(`🎮 Sala en Vivo PIN: <span style="letter-spacing:2px; color:var(--accent-purple);">${pin}</span>`, `
            <div style="display:flex; flex-direction:column; gap:1.25rem; width:100%; height:100%;">
                <!-- Banner Superior Host -->
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:1rem; border-radius:12px; border:1px solid var(--bg-card-border);">
                    <div>
                        <h3 id="host-quiz-title" style="font-size:1.2rem;" class="gradient-text">Cargando datos...</h3>
                        <p style="font-size:0.85rem; color:var(--text-muted);">Comparte el código PIN o permite que escaneen el QR para unirse</p>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.75rem; color:var(--text-muted);">PIN de Conexión:</span>
                        <div style="font-size:1.6rem; font-weight:800; color:#38bdf8; letter-spacing:2px;">${pin}</div>
                    </div>
                </div>

                <!-- Contenido Dinámico de la Sala (Esperando / Pregunta / Final) -->
                <div id="host-live-main-content" style="flex:1; display:flex; gap:1.5rem; min-height:0; overflow-y:auto;">
                    <!-- Columna Izquierda: QR y Estado -->
                    <div style="width:280px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; background:rgba(0,0,0,0.3); padding:1.25rem; border-radius:12px; border:1px solid var(--bg-card-border); justify-content:center; text-align:center;">
                        <div id="qrcode-container" style="background:white; padding:12px; border-radius:12px; margin-bottom:1rem;"></div>
                        <span style="font-size:0.8rem; color:var(--text-muted); word-break:break-all;">${joinUrl}</span>
                    </div>

                    <!-- Columna Derecha: Participantes / Pregunta Activa / Ranking -->
                    <div style="flex:1; display:flex; flex-direction:column; gap:1rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h4 style="font-size:1.1rem; color:var(--text-main);"><i data-lucide="users"></i> Participantes Conectados: <span id="host-connected-count" style="color:#34d399;">0</span></h4>
                            <div id="host-action-buttons">
                                <button class="btn-primary" style="background:#10b981;" onclick="QuizLiveEngine.controlHostAction('start')">
                                    <i data-lucide="play"></i> Iniciar Quiz Ahora
                                </button>
                            </div>
                        </div>

                        <div id="host-dynamic-panel" style="flex:1; background:rgba(255,255,255,0.02); border-radius:12px; padding:1.25rem; border:1px solid var(--bg-card-border); overflow-y:auto;">
                            <!-- Se renderiza por polling -->
                        </div>
                    </div>
                </div>
            </div>
        `, 'full');

        // Generar Código QR con librería qrcode.js
        setTimeout(() => {
            const qrBox = document.getElementById('qrcode-container');
            if (qrBox && window.QRCode) {
                qrBox.innerHTML = '';
                new QRCode(qrBox, {
                    text: joinUrl,
                    width: 180,
                    height: 180,
                    colorDark : "#0f172a",
                    colorLight : "#ffffff"
                });
            }
        }, 300);

        // Iniciar Polling de Estado (cada 1.5 segundos)
        pollHostStatus(pin);
    }

    async function pollHostStatus(pin) {
        const fetchStatus = async () => {
            try {
                const data = await apiFetch(`/api/v1/quizzes/session/${pin}/status`);
                updateHostUI(data);
            } catch(e) {
                if (pollingInterval) clearInterval(pollingInterval);
            }
        };

        await fetchStatus();
        pollingInterval = setInterval(fetchStatus, 1500);
    }

    function updateHostUI(data) {
        const titleEl = document.getElementById('host-quiz-title');
        const countEl = document.getElementById('host-connected-count');
        const panelEl = document.getElementById('host-dynamic-panel');
        const btnBox = document.getElementById('host-action-buttons');

        if (titleEl) titleEl.innerText = data.title;
        if (countEl) countEl.innerText = data.participants_count;

        if (!panelEl) return;

        if (data.status === 'waiting') {
            if (btnBox) {
                btnBox.innerHTML = `
                    <button class="btn-primary" style="background:#10b981;" onclick="QuizLiveEngine.controlHostAction('start')">
                        <i data-lucide="play"></i> Iniciar Quiz
                    </button>
                `;
            }

            const list = data.ranking || [];
            panelEl.innerHTML = `
                <h5 style="color:var(--text-muted); font-size:0.9rem; margin-bottom:0.75rem;">Esperando a que los jugadores escaneen el QR o ingresen el PIN...</h5>
                <div style="display:flex; flex-wrap:wrap; gap:0.75rem;">
                    ${list.map(p => `
                        <div style="background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); padding:0.5rem 1rem; border-radius:20px; color:#60a5fa; font-weight:600; font-size:0.9rem; display:flex; align-items:center; gap:0.5rem;">
                            <i data-lucide="user" style="width:14px;"></i> ${p.name} ${data.mode === 'teams' ? `<span style="font-size:0.75rem; opacity:0.8;">(${p.team})</span>` : ''}
                        </div>
                    `).join('') || '<p style="color:var(--text-muted);">Sin jugadores conectados aún.</p>'}
                </div>
            `;
        } else if (data.status === 'question_active') {
            const q = data.current_question;
            const elapsed = Math.round((Date.now() - (data.question_start_time || Date.now())) / 1000);
            const remaining = Math.max(0, (q.time_seconds || 20) - elapsed);

            if (btnBox) {
                btnBox.innerHTML = `
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn-primary" style="background:#f59e0b;" onclick="QuizLiveEngine.controlHostAction('next')">
                            <i data-lucide="skip-forward"></i> Siguiente (${data.current_question_index + 1}/${data.total_questions})
                        </button>
                        <button class="role-chip" style="background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.3);" onclick="QuizLiveEngine.controlHostAction('stop')">
                            <i data-lucide="square"></i> Detener
                        </button>
                        <button class="role-chip" style="background:rgba(59,130,246,0.2); color:#60a5fa; border:1px solid rgba(59,130,246,0.3);" onclick="QuizLiveEngine.controlHostAction('restart')">
                            <i data-lucide="rotate-ccw"></i> Reiniciar
                        </button>
                    </div>
                `;
            }

            panelEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--bg-card-border); padding-bottom:0.75rem; margin-bottom:1rem;">
                    <span style="color:var(--accent-purple); font-weight:700;">Pregunta ${data.current_question_index + 1} de ${data.total_questions}</span>
                    <div class="role-chip" style="background:rgba(239,68,68,0.2); color:#f87171; font-size:1.1rem; padding:0.4rem 1rem;">
                        ⏱️ Tiempo: <strong>${remaining}s</strong>
                    </div>
                </div>

                <h3 style="font-size:1.3rem; color:var(--text-main); margin-bottom:1.25rem;">${q.question}</h3>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    ${q.options.map((opt, i) => `
                        <div style="background:rgba(255,255,255,0.04); border:1px solid var(--bg-card-border); padding:1rem; border-radius:10px; font-weight:600; color:var(--text-main);">
                            ${String.fromCharCode(65 + i)}: ${opt}
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (data.status === 'finished') {
            if (btnBox) {
                btnBox.innerHTML = `
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <span class="role-chip" style="background:#10b981; color:white; font-weight:700;">QUIZ FINALIZADO</span>
                        <button class="role-chip" style="background:rgba(59,130,246,0.2); color:#60a5fa; border:1px solid rgba(59,130,246,0.3);" onclick="QuizLiveEngine.controlHostAction('restart')">
                            <i data-lucide="rotate-ccw"></i> Reiniciar Quiz
                        </button>
                    </div>
                `;
            }

            const ranking = data.ranking || [];
            panelEl.innerHTML = `
                <div style="text-align:center; margin-bottom:1.5rem;">
                    <h2 class="gradient-text" style="font-size:1.8rem;"><i data-lucide="trophy" style="color:#facc15;"></i> Ranking Final en Tiempo Real</h2>
                    <p style="color:var(--text-muted); font-size:0.9rem;">Tabla de Posiciones y Puntajes Consolidados</p>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.75rem;">
                    ${ranking.map((p, index) => {
                        let trophy = '';
                        if (index === 0) trophy = '🥇 ';
                        if (index === 1) trophy = '🥈 ';
                        if (index === 2) trophy = '🥉 ';
                        return `
                            <div style="display:flex; justify-content:space-between; align-items:center; background:${index === 0 ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${index === 0 ? '#facc15' : 'var(--bg-card-border)'}; padding:0.88rem 1.25rem; border-radius:12px;">
                                <div style="display:flex; align-items:center; gap:0.75rem;">
                                    <span style="font-weight:800; font-size:1.1rem; width:30px;">${trophy || `#${index + 1}`}</span>
                                    <span style="font-weight:600; color:var(--text-main); font-size:1.05rem;">${p.name}</span>
                                    ${data.mode === 'teams' ? `<span class="role-chip">${p.team}</span>` : ''}
                                </div>
                                <span style="font-size:1.2rem; font-weight:800; color:#38bdf8;">${p.score} pts</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (window.lucide) lucide.createIcons();
    }

    async function controlHostAction(action) {
        if (!currentSessionPin) return;
        try {
            await apiFetch(`/api/v1/quizzes/session/${currentSessionPin}/next-question`, {
                method: 'POST',
                body: JSON.stringify({ action })
            });
            pollHostStatus(currentSessionPin);
        } catch(err) {
            showToast(err.message, "error");
        }
    }

    /* ================= 4. SALA DEL JUGADOR / ALUMNO (MOBILE FIRST) ================= */
    function openPlayerJoinModal(pinParam = '') {
        showModal("🎮 Unirse a Quiz en Tiempo Real", `
            <div style="display:flex; flex-direction:column; gap:1.25rem; width:100%;">
                <form id="player-join-form" style="display:flex; flex-direction:column; gap:1rem;">
                    <div class="form-group">
                        <label style="font-weight:600;">PIN del Quiz</label>
                        <input type="text" id="player-pin-input" class="form-input" value="${pinParam}" placeholder="Ej. 654321" required style="font-size:1.2rem; text-align:center; letter-spacing:2px;">
                    </div>
                    <div class="form-group">
                        <label style="font-weight:600;">Tu Nombre o Nickname</label>
                        <input type="text" id="player-name-input" class="form-input" placeholder="Ej. María López" required>
                    </div>
                    <div class="form-group">
                        <label style="font-weight:600;">Selecciona tu Equipo</label>
                        <select id="player-team-input" class="form-input">
                            <option value="Equipo Azul" selected>🔵 Equipo Azul</option>
                            <option value="Equipo Rojo">🔴 Equipo Rojo</option>
                            <option value="Equipo Verde">🟢 Equipo Verde</option>
                            <option value="Equipo Amarillo">🟡 Equipo Amarillo</option>
                        </select>
                    </div>

                    <button type="submit" class="btn-primary" style="margin-top:0.5rem; padding:0.8rem; font-size:1rem;">
                        <i data-lucide="log-in"></i> Conectarse a la Sala
                    </button>
                </form>
            </div>
        `, true);

        if (window.lucide) lucide.createIcons();

        document.getElementById('player-join-form').onsubmit = async (e) => {
            e.preventDefault();
            const pin = document.getElementById('player-pin-input').value.trim();
            const name = document.getElementById('player-name-input').value.trim();
            const team = document.getElementById('player-team-input').value;

            try {
                const res = await apiFetch(`/api/v1/quizzes/session/${pin}/join`, {
                    method: 'POST',
                    body: JSON.stringify({ name, team })
                });

                showToast(res.message, "success");
                openPlayerScreen(pin, res.participant_id, name);
            } catch(err) {
                showToast(err.message, "error");
            }
        };
    }

    function openPlayerScreen(pin, participantId, playerName) {
        if (pollingInterval) clearInterval(pollingInterval);

        // Persistir sesión activa localmente para reconexión antidesconexión
        localStorage.setItem('ac_quiz_pin', pin);
        localStorage.setItem('ac_quiz_pid', participantId);
        localStorage.setItem('ac_quiz_name', playerName);

        showModal(`🎮 Sala en Vivo: ${playerName}`, `
            <div id="player-live-screen" style="display:flex; flex-direction:column; gap:1.25rem; width:100%; height:100%; text-align:center;">
                <div style="background:rgba(255,255,255,0.03); padding:0.75rem; border-radius:10px; border:1px solid var(--bg-card-border); display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:600; color:var(--accent-purple);">${playerName}</span>
                    <span id="player-my-score" style="font-size:1.1rem; font-weight:800; color:#38bdf8;">0 pts</span>
                </div>

                <div id="player-content-area" style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:0; overflow-y:auto;">
                    <p style="color:var(--text-muted);">Conectando con la transmisión...</p>
                </div>
            </div>
        `, 'full');

        const pollPlayerStatus = async () => {
            try {
                const data = await apiFetch(`/api/v1/quizzes/session/${pin}/status`);
                const me = (data.ranking || []).find(p => p.id === participantId);

                const scoreEl = document.getElementById('player-my-score');
                if (scoreEl && me) scoreEl.innerText = `${me.score} pts`;

                const area = document.getElementById('player-content-area');
                if (!area) return;

                if (data.status === 'waiting') {
                    area.innerHTML = `
                        <div style="padding:2rem;">
                            <i data-lucide="hourglass" class="spin" style="width:48px; height:48px; color:var(--accent-blue);"></i>
                            <h3 style="margin-top:1rem; font-size:1.2rem;">¡Estás dentro!</h3>
                            <p style="color:var(--text-muted); font-size:0.9rem;">El docente iniciará la primera pregunta en breve...</p>
                        </div>
                    `;
                } else if (data.status === 'question_active') {
                    const q = data.current_question;
                    const currentIdx = data.current_question_index;
                    const myAnswer = (me && me.answers) ? me.answers[currentIdx] : null;

                    if (myAnswer) {
                        // El participante ya respondió esta pregunta
                        if (myAnswer.is_correct) {
                            area.innerHTML = `
                                <div style="padding:2rem; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:16px; width:100%; max-width:500px;">
                                    <i data-lucide="party-popper" style="width:64px; height:64px; color:#34d399; margin-bottom:1rem;"></i>
                                    <h2 style="color:#34d399; font-size:1.6rem; font-weight:800;">¡FELICITACIONES! 🎉</h2>
                                    <p style="font-size:1.1rem; color:var(--text-main); margin-top:0.5rem;">¡Respuesta Correcta!</p>
                                    <span style="display:inline-block; margin-top:0.75rem; background:rgba(16,185,129,0.2); color:#34d399; font-weight:800; padding:0.4rem 1rem; border-radius:20px;">+${myAnswer.points} pts</span>
                                    <p style="font-size:0.85rem; color:var(--text-muted); margin-top:1rem;">Esperando a que avance la siguiente pregunta...</p>
                                </div>
                            `;
                        } else {
                            area.innerHTML = `
                                <div style="padding:2rem; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:16px; width:100%; max-width:500px;">
                                    <i data-lucide="x-circle" style="width:64px; height:64px; color:#f87171; margin-bottom:1rem;"></i>
                                    <h2 style="color:#f87171; font-size:1.6rem; font-weight:800;">RESPUESTA INCORRECTA ❌</h2>
                                    <p style="font-size:1rem; color:var(--text-main); margin-top:0.5rem;">¡Sigue intentando en la próxima!</p>
                                    <p style="font-size:0.85rem; color:var(--text-muted); margin-top:1rem;">Esperando a que avance la siguiente pregunta...</p>
                                </div>
                            `;
                        }
                    } else {
                        // El participante aún no ha respondido la pregunta actual
                        const elapsed = Math.round((Date.now() - (data.question_start_time || Date.now())) / 1000);
                        const remaining = Math.max(0, (q.time_seconds || 20) - elapsed);

                        area.innerHTML = `
                            <div style="width:100%; max-width:600px; display:flex; flex-direction:column; gap:1rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-size:0.85rem; color:var(--text-muted);">Pregunta ${currentIdx + 1} de ${data.total_questions}</span>
                                    <span class="role-chip" style="background:rgba(239,68,68,0.2); color:#f87171;">⏱️ ${remaining}s</span>
                                </div>
                                <h3 style="font-size:1.2rem; color:var(--text-main); font-weight:700; text-align:left;">${q.question}</h3>
                                
                                <div style="display:flex; flex-direction:column; gap:0.75rem; margin-top:0.5rem;">
                                    ${q.options.map((opt, i) => `
                                        <button type="button" class="btn-primary btn-opt-answer" style="text-align:left; justify-content:flex-start; padding:1rem; font-size:1rem;" onclick="QuizLiveEngine.submitPlayerAnswer('${pin}', '${participantId}', ${currentIdx}, ${i}, this)">
                                            <strong>${String.fromCharCode(65 + i)}:</strong> ${opt}
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }
                } else if (data.status === 'finished') {
                    localStorage.removeItem('ac_quiz_pin');
                    localStorage.removeItem('ac_quiz_pid');

                    area.innerHTML = `
                        <div style="padding:2rem;">
                            <i data-lucide="trophy" style="width:56px; height:56px; color:#facc15;"></i>
                            <h2 class="gradient-text" style="font-size:1.5rem; margin-top:0.75rem;">¡Quiz Finalizado!</h2>
                            <p style="font-size:1.1rem; color:var(--text-main); margin-top:0.5rem;">Tu Puntaje Final: <strong>${me ? me.score : 0} pts</strong></p>
                        </div>
                    `;
                }
                if (window.lucide) lucide.createIcons();
            } catch(e) {}
        };

        pollPlayerStatus();
        pollingInterval = setInterval(pollPlayerStatus, 1500);
    }

    async function submitPlayerAnswer(pin, participantId, questionIndex, optionIndex, btnEl) {
        // Bloquear todas las opciones inmediatamente en el cliente (marcar 1 única vez)
        document.querySelectorAll('.btn-opt-answer').forEach(b => {
            b.disabled = true;
            b.style.opacity = '0.5';
        });

        if (btnEl) {
            btnEl.style.opacity = '1';
            btnEl.style.border = '2px solid var(--accent-purple)';
        }

        try {
            const res = await apiFetch(`/api/v1/quizzes/session/${pin}/answer`, {
                method: 'POST',
                body: JSON.stringify({
                    participant_id: participantId,
                    question_index: questionIndex,
                    option_index: optionIndex
                })
            });

            if (res.is_correct) {
                showToast(`¡Respuesta Correcta! +${res.points_earned} pts`, "success");
            } else {
                showToast(`Respuesta Incorrecta.`, "error");
            }
        } catch(err) {
            showToast(err.message, "error");
        }
    }

    // Auto-detección de Hash en la URL para entrar vía QR directamente (ej: #quiz-123456)
    window.addEventListener('load', () => {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#quiz-')) {
            const pin = hash.replace('#quiz-', '');
            openPlayerJoinModal(pin);
        } else {
            // Auto-reconectar si existía una sesión de juego activa antes de recargar la página
            const savedPin = localStorage.getItem('ac_quiz_pin');
            const savedPid = localStorage.getItem('ac_quiz_pid');
            const savedName = localStorage.getItem('ac_quiz_name');
            if (savedPin && savedPid && savedName) {
                openPlayerScreen(savedPin, savedPid, savedName);
            }
        }
    });

    return {
        openApiKeysModal,
        addKeyInputRow,
        openQuizWizard,
        openEditQuizModal,
        switchGeneratorMode,
        addNewCustomQuestion,
        moveQuestionUp,
        moveQuestionDown,
        saveCreatedQuiz,
        startLiveSession,
        controlHostAction,
        openPlayerJoinModal,
        submitPlayerAnswer
    };
})();
