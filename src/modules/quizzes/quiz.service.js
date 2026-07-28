const https = require('https');

/**
 * Servicio de IA Gemini con soporte para Failover de múltiples API Keys.
 * Intenta secuencialmente cada API key disponible hasta obtener respuesta exitosa.
 */
async function generateQuizWithGemini({ keys, topic, textContent, questionCount = 5 }) {
    if (!keys || !Array.isArray(keys) || keys.length === 0) {
        throw new Error('No se han configurado API Keys de Google Gemini. Registra al menos una clave en el gestor.');
    }

    const count = parseInt(questionCount) || 5;

    const systemPrompt = `Eres un asistente educativo experto en generación de evaluaciones y quizzes interactivos en tiempo real.
Tu tarea es generar exactamente ${count} preguntas tipo opción múltiple en idioma ESPAÑOL basadas en la entrada del usuario.

REGLAS DE FORMATO:
Debes responder ÚNICAMENTE con un objeto JSON válido (sin texto antes o después, sin markdown triple backticks adicional si no es necesario, pero si usas json asegúrate de que sea parseable).
El JSON debe seguir estrictamente esta estructura:
{
  "title": "Título sugerido para el Quiz",
  "questions": [
    {
      "id": "q_1",
      "question": "¿Texto de la pregunta?",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correct_index": 0,
      "time_seconds": 20,
      "explanation": "Breve explicación de por qué es la respuesta correcta."
    }
  ]
}

- "correct_index" debe ser el índice 0, 1, 2 o 3 que indica cuál de las 4 opciones es la correcta.
- "time_seconds" debe ser 15, 20 o 30 según la dificultad.
- Garantiza que las 4 opciones sean plausibles e interesantes.`;

    let userInput = '';
    if (textContent && textContent.trim()) {
        userInput = `Genera un quiz de ${count} preguntas a partir del siguiente texto/contenido:\n\n${textContent.trim()}`;
    } else if (topic && topic.trim()) {
        userInput = `Genera un quiz de ${count} preguntas sobre el siguiente tema académico:\n\n${topic.trim()}`;
    } else {
        throw new Error('Debes proporcionar un Tema o un Texto para generar el Quiz.');
    }

    const payload = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: systemPrompt + '\n\nENTRADA DEL USUARIO:\n' + userInput }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
        }
    };

    const modelsToTry = [
        'gemini-3.5-flash-lite',
        'gemini-3.6-flash',
        'gemini-3.5-flash'
    ];

    let lastError = null;

    // Recorremos las API Keys del usuario (Failover)
    for (let kIndex = 0; kIndex < keys.length; kIndex++) {
        const apiKey = keys[kIndex];
        if (!apiKey || !apiKey.trim()) continue;

        for (const model of modelsToTry) {
            try {
                console.log(`🤖 Intentando generación de Quiz con Gemini [Key #${kIndex + 1}] usando modelo ${model}...`);
                const responseData = await makeGeminiApiCall(model, apiKey.trim(), payload);
                const generatedText = extractTextFromGeminiResponse(responseData);

                if (generatedText) {
                    const parsedJson = parseQuizJson(generatedText);
                    if (parsedJson && parsedJson.questions && Array.isArray(parsedJson.questions)) {
                        console.log(`✅ Quiz generado exitosamente con Key #${kIndex + 1} (${model})`);
                        return {
                            success: true,
                            keyUsedIndex: kIndex,
                            modelUsed: model,
                            quiz: parsedJson
                        };
                    }
                }
            } catch (err) {
                console.warn(`⚠️ Falló generación con Key #${kIndex + 1} (${model}):`, err.message);
                lastError = err;
            }
        }
    }

    throw new Error(`No se pudo generar el quiz con ninguna de las API Keys configuradas. Último error: ${lastError ? lastError.message : 'Respuesta inválida de IA'}`);
}

function makeGeminiApiCall(model, apiKey, payload) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload);
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 25000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const json = JSON.parse(body);
                        resolve(json);
                    } catch (e) {
                        reject(new Error('Respuesta de Gemini no es un JSON válido'));
                    }
                } else {
                    let msg = `HTTP Status ${res.statusCode}`;
                    try {
                        const errJson = JSON.parse(body);
                        if (errJson.error && errJson.error.message) {
                            msg = errJson.error.message;
                        }
                    } catch (e) {}
                    reject(new Error(msg));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Tiempo de espera agotado al conectar con Google Gemini API'));
        });

        req.write(postData);
        req.end();
    });
}

function extractTextFromGeminiResponse(data) {
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        return null;
    }
    const parts = data.candidates[0].content.parts;
    if (!parts || !parts[0] || !parts[0].text) return null;
    return parts[0].text;
}

function parseQuizJson(text) {
    let clean = text.trim();
    if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```/, '').replace(/```$/, '').trim();
    }
    return JSON.parse(clean);
}

module.exports = {
    generateQuizWithGemini
};
