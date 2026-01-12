// ========== CONFIGURACIÓN GLOBAL ==========
let PREGUNTAS_COMPLETAS = [];
const TEMAS = ['L1', 'L21', 'L31', 'L41', 'L51'];
const TOTAL_PREGUNTAS_EXAMEN = 50;
const PREGUNTAS_POR_TEMA_EXAMEN = 10;

// ========== OBJETO PRINCIPAL ==========
const app = {
    preguntas: [],
    indiceActual: 0,
    modo: '',
    timerInterval: null,
    tiempoInicio: 0,
    respuestas: {},
    fallos: JSON.parse(localStorage.getItem('fallos')) || {},
    keyboardHandler: null,
    config: {
        practica: {
            ordenarPorTema: false,
            temasSeleccionados: [1, 2, 3, 4, 5]
        }
    },

    // ========== INICIALIZACIÓN ==========
    async init() {
        try {
            const response = await fetch('preguntas.json');
            PREGUNTAS_COMPLETAS = await response.json();
            console.log(`✅ ${PREGUNTAS_COMPLETAS.length} preguntas cargadas`);
            document.getElementById('totalPreguntasInfo').textContent = `Base: ${PREGUNTAS_COMPLETAS.length} ✓`;
            this.actualizarUI();
        } catch (error) {
            console.error('Error al cargar preguntas:', error);
            alert('Error al cargar preguntas. Intenta recargar la página.');
        }
    },

    // ========== MODOS DE INICIO ==========
    iniciarModo(modo) {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.modo = modo;
        this.respuestas = {};
        
        if (modo === 'examen') {
            this.preguntas = this.obtenerPreguntasExamen();
            document.getElementById('modoActual').textContent = 'Examen';
        } else if (modo === 'practica') {
            this.preguntas = this.obtenerPreguntasPractica();
            document.getElementById('modoActual').textContent = 'Práctica';
        } else if (modo === 'fallos') {
            this.preguntas = Object.keys(this.fallos)
                .map(id => PREGUNTAS_COMPLETAS.find(p => p.cuestion === id))
                .filter(p => p);
            if (this.preguntas.length === 0) {
                alert('No hay preguntas falladas guardadas');
                return;
            }
            document.getElementById('modoActual').textContent = 'Test de Fallos';
        }
        
        this.indiceActual = 0;
        this.tiempoInicio = Date.now();
        this.mostrarPregunta();
        this.iniciarTimer();
        this.iniciarNavegacionTeclado();
        document.getElementById('seleccionModo').classList.add('oculto');
        document.getElementById('examen').classList.remove('oculto');
        document.getElementById('resultados').classList.add('oculto');
    },

    // ========== SELECCIÓN DE PREGUNTAS ==========
    obtenerPreguntasExamen() {
        const pool = PREGUNTAS_COMPLETAS.filter(p => !this.esGaitero(p));
        const grupos = new Map();
        
        pool.forEach(p => {
            const tema = this.extraerTema(p);
            if (tema === null) return;
            if (!grupos.has(tema)) grupos.set(tema, []);
            grupos.get(tema).push(p);
        });
        
        const seleccion = [];
        const seleccionSet = new Set();
        
        for (const tema of [1, 2, 3, 4, 5]) {
            const preguntasTema = grupos.get(tema) ?? [];
            const elegidas = this.sample(preguntasTema, PREGUNTAS_POR_TEMA_EXAMEN);
            elegidas.forEach(p => {
                seleccion.push(p);
                seleccionSet.add(p);
            });
        }
        
        if (seleccion.length < TOTAL_PREGUNTAS_EXAMEN) {
            const restantes = pool.filter(p => !seleccionSet.has(p));
            const faltan = TOTAL_PREGUNTAS_EXAMEN - seleccion.length;
            seleccion.push(...this.sample(restantes, faltan));
        }
        
        return this.barajar(seleccion).slice(0, TOTAL_PREGUNTAS_EXAMEN);
    },

    obtenerPreguntasPractica() {
        const pool = PREGUNTAS_COMPLETAS.filter(p => !this.esGaitero(p));
        const temasSeleccionados = this.config.practica.temasSeleccionados;
        const ordenarPorTema = this.config.practica.ordenarPorTema;
        const totalPreguntas = 50;
        
        const grupos = new Map();
        pool.forEach(p => {
            const tema = this.extraerTema(p);
            if (tema === null) return;
            if (!grupos.has(tema)) grupos.set(tema, []);
            grupos.get(tema).push(p);
        });
        
        const numTemas = temasSeleccionados.length;
        const preguntasPorTema = Math.floor(totalPreguntas / numTemas);
        const preguntasExtras = totalPreguntas % numTemas;
        
        const seleccion = [];
        
        if (ordenarPorTema) {
            temasSeleccionados.forEach((tema, index) => {
                const preguntasTema = grupos.get(tema) || [];
                const cantidad = preguntasPorTema + (index < preguntasExtras ? 1 : 0);
                const preguntasMezcladas = this.barajar(preguntasTema);
                seleccion.push(...preguntasMezcladas.slice(0, cantidad));
            });
        } else {
            const preguntasPorTemaTemporal = [];
            temasSeleccionados.forEach((tema, index) => {
                const preguntasTema = grupos.get(tema) || [];
                const cantidad = preguntasPorTema + (index < preguntasExtras ? 1 : 0);
                const preguntasMezcladas = this.barajar(preguntasTema);
                preguntasPorTemaTemporal.push(...preguntasMezcladas.slice(0, cantidad));
            });
            seleccion.push(...this.barajar(preguntasPorTemaTemporal));
        }
        
        return seleccion.slice(0, totalPreguntas);
    },

    // ========== MOSTRAR PREGUNTA ==========
    mostrarPregunta() {
        const pregunta = this.preguntas[this.indiceActual];
        if (!pregunta) return;

        if (this.modo === 'examen') {
            const bloque = Math.floor(this.indiceActual / 10) + 1;
            const totalBloques = Math.ceil(this.preguntas.length / 10);
            const enBloque = (this.indiceActual % 10) + 1;
            document.getElementById('preguntaNumero').textContent = 
                `Bloque ${bloque}/${totalBloques} — Pregunta ${enBloque}/10 (global ${this.indiceActual + 1}/${this.preguntas.length})`;
        } else {
            document.getElementById('preguntaNumero').textContent = 
                `Pregunta ${this.indiceActual + 1} de ${this.preguntas.length}`;
        }
        
        document.getElementById('preguntaTexto').textContent = pregunta.cuestion;
        
        const contenedor = document.getElementById('opcionesContenedor');
        contenedor.innerHTML = '';
        
        const yaRespondida = this.respuestas.hasOwnProperty(this.indiceActual);
        
        pregunta.opciones.forEach((opcion, idx) => {
            const boton = document.createElement('button');
            boton.className = 'opcion';
            
            const numeroTecla = document.createElement('span');
            numeroTecla.style.cssText = 'display: inline-block; background: #3a3a3a; padding: 2px 6px; border-radius: 3px; margin-right: 8px; font-size: 11px; color: #00d4ff;';
            numeroTecla.textContent = (idx + 1);
            
            const textoOpcion = document.createElement('span');
            textoOpcion.textContent = opcion;
            
            boton.appendChild(numeroTecla);
            boton.appendChild(textoOpcion);
            
            const respuestaGuardada = this.respuestas[this.indiceActual];
            if (respuestaGuardada === idx) boton.classList.add('seleccionada');
            
            if (this.modo === 'practica' && yaRespondida) {
                boton.disabled = true;
                boton.style.cursor = 'not-allowed';
                boton.style.opacity = '0.8';
            } else {
                boton.onclick = () => this.responderPregunta(idx);
            }
            
            contenedor.appendChild(boton);
        });
        
        if (this.modo === 'practica' && yaRespondida) {
            this.aplicarFeedback();
        }

        this.actualizarBotones();
        document.getElementById('barraProgreso').style.width = 
            ((this.indiceActual + 1) / this.preguntas.length * 100) + '%';
    },

    responderPregunta(idx) {
        this.respuestas[this.indiceActual] = idx;
        this.mostrarPregunta();
    },

    // ========== NAVEGACIÓN ==========
    siguiente() {
        if (this.indiceActual < this.preguntas.length - 1) {
            this.indiceActual++;
            this.mostrarPregunta();
        }
    },

    anterior() {
        if (this.modo === 'examen') return;
        if (this.indiceActual > 0) {
            this.indiceActual--;
            this.mostrarPregunta();
        }
    },

    // ========== BOTONES ==========
    actualizarBotones() {
        const btnAnterior = document.getElementById('btnAnterior');
        const btnSiguiente = document.getElementById('btnSiguiente');
        
        if (this.modo === 'examen') {
            btnAnterior.disabled = true;
            btnAnterior.classList.add('oculto');
        } else {
            btnAnterior.classList.remove('oculto');
            btnAnterior.disabled = this.indiceActual === 0;
        }
        
        btnSiguiente.disabled = this.indiceActual >= this.preguntas.length - 1;
    },

    // ========== TERMINAR ==========
    terminar() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        const contestadas = Object.keys(this.respuestas).length;
        const sinResponder = this.preguntas.length - contestadas;
        
        const mensaje = sinResponder > 0
            ? `¿Seguro que quieres terminar el examen?\n\nTe quedan ${sinResponder} preguntas sin responder.`
            : '¿Seguro que quieres terminar el examen?';
        
        if (!confirm(mensaje)) return;
        
        this.mostrarResultados();
    },

    mostrarResultados() {
        let correctas = 0;
        const erroresDelTest = [];
        
        this.preguntas.forEach((pregunta, idx) => {
            if (this.respuestas.hasOwnProperty(idx)) {
                const indiceRespuesta = this.respuestas[idx];
                const respuestaUsuario = pregunta.opciones[indiceRespuesta].charAt(0);
                const esCorrecta = respuestaUsuario === pregunta.solucion;
                
                if (esCorrecta) {
                    correctas++;
                } else {
                    const indiceCorrecto = this.obtenerIndiceCorrecto(pregunta);
                    erroresDelTest.push({
                        pregunta: pregunta.cuestion,
                        respuestaUsuario: pregunta.opciones[indiceRespuesta],
                        respuestaCorrecta: pregunta.opciones[indiceCorrecto]
                    });
                    
                    this.fallos[pregunta.cuestion] = true;
                }
            } else {
                this.fallos[pregunta.cuestion] = true;
            }
        });
        
        localStorage.setItem('fallos', JSON.stringify(this.fallos));
        
        const incorrectas = Object.keys(this.respuestas).length - correctas;
        const sinResponder = this.preguntas.length - Object.keys(this.respuestas).length;
        
        const puntuacionRaw = correctas - (incorrectas / 3);
        const puntuacionFinal = Math.max(0, Math.min(10, (puntuacionRaw / this.preguntas.length) * 10));
        
        document.getElementById('respuestasCorrectas').textContent = correctas;
        document.getElementById('respuestasIncorrectas').textContent = incorrectas;
        document.getElementById('sinResponder').textContent = sinResponder;
        document.getElementById('puntuacionFinal').textContent = puntuacionFinal.toFixed(2) + '/10';
        
        this.mostrarDetalleErrores(erroresDelTest);
        
        document.getElementById('examen').classList.add('oculto');
        document.getElementById('resultados').classList.remove('oculto');
    },
    
    obtenerIndiceCorrecto(pregunta) {
        const objetivo = `${pregunta.solucion}.`;
        return pregunta.opciones.findIndex(op => op.trim().startsWith(objetivo) || op.trim().charAt(0) === pregunta.solucion);
    },
    
    aplicarFeedback() {
        const pregunta = this.preguntas[this.indiceActual];
        const correcto = this.obtenerIndiceCorrecto(pregunta);
        const elegido = this.respuestas[this.indiceActual];
        
        const botones = document.querySelectorAll('#opcionesContenedor .opcion');
        botones.forEach((boton, indice) => {
            boton.classList.remove('correcta', 'incorrecta');
            if (indice === correcto) {
                boton.classList.add('correcta');
            }
            if (indice === elegido && elegido !== correcto) {
                boton.classList.add('incorrecta');
            }
        });
    },
    
    mostrarDetalleErrores(erroresDelTest) {
        const contenedor = document.getElementById('erroresDetalle');
        
        if (erroresDelTest.length === 0) {
            contenedor.classList.add('oculto');
            return;
        }
        
        contenedor.classList.remove('oculto');
        let html = '<h3 style="color: #ef4444; margin-bottom: 15px;">📋 Preguntas Falladas</h3>';
        
        erroresDelTest.forEach((error, index) => {
            html += `
                <div class="error-item">
                    <div class="error-pregunta">${index + 1}. ${error.pregunta}</div>
                    <div class="error-respuesta respuesta-tu">
                        ❌ Tu respuesta: ${error.respuestaUsuario}
                    </div>
                    <div class="error-respuesta respuesta-correcta">
                        ✓ Respuesta correcta: ${error.respuestaCorrecta}
                    </div>
                </div>
            `;
        });
        
        contenedor.innerHTML = html;
    },

    reiniciar() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        this.indiceActual = 0;
        this.respuestas = {};
        document.getElementById('seleccionModo').classList.remove('oculto');
        document.getElementById('examen').classList.add('oculto');
        document.getElementById('resultados').classList.add('oculto');
        document.getElementById('modoActual').textContent = '-';
        document.getElementById('tiempoRestante').textContent = 'Tiempo: 0:00';
        this.actualizarUI();
    },

    // ========== TIMER ==========
    iniciarTimer() {
        this.timerInterval = setInterval(() => {
            const ahora = Date.now();
            const transcurridoMs = ahora - this.tiempoInicio;
            
            if (this.modo === 'examen') {
                const tiempoLimiteMs = 50 * 60 * 1000;
                const restanteMs = Math.max(0, tiempoLimiteMs - transcurridoMs);
                const restanteSec = Math.floor(restanteMs / 1000);
                const minutos = Math.floor(restanteSec / 60);
                const segundos = restanteSec % 60;
                document.getElementById('tiempoRestante').textContent =
                    `Tiempo restante: ${minutos}:${segundos.toString().padStart(2, '0')}`;
                
                if (restanteMs <= 0) {
                    clearInterval(this.timerInterval);
                    alert('Se acabó el tiempo. El examen se finalizará automáticamente.');
                    this.mostrarResultados();
                }
                return;
            }
            
            const tiempoTranscurrido = Math.floor(transcurridoMs / 1000);
            const minutos = Math.floor(tiempoTranscurrido / 60);
            const segundos = tiempoTranscurrido % 60;
            document.getElementById('tiempoRestante').textContent =
                `Tiempo: ${minutos}:${segundos.toString().padStart(2, '0')}`;
        }, 1000);
    },

    // ========== CONFIGURACIÓN ==========
    toggleConfig(key) {
        const config = this.config.practica;
        config[key] = !config[key];
        this.actualizarConfigUI();
    },
    
    actualizarConfigUI() {
        const ordenarPorTema = this.config.practica.ordenarPorTema;
        const toggle = document.getElementById('toggleOrdenTema');
        if (ordenarPorTema) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    },

    toggleTema(numeroTema) {
        let temasSeleccionados = this.config.practica.temasSeleccionados;
        
        if (temasSeleccionados.includes(numeroTema)) {
            temasSeleccionados = temasSeleccionados.filter(t => t !== numeroTema);
            if (temasSeleccionados.length === 0) {
                alert('Debes seleccionar al menos un tema');
                const checkbox = document.querySelector(`input[type="checkbox"][value="${numeroTema}"]`);
                if (checkbox) checkbox.checked = true;
                return;
            }
        } else {
            temasSeleccionados.push(numeroTema);
            temasSeleccionados.sort((a, b) => a - b);
        }
        
        this.config.practica.temasSeleccionados = temasSeleccionados;
        this.actualizarDistribucion();
    },
    
    actualizarDistribucion() {
        const temasSeleccionados = this.config.practica.temasSeleccionados;
        const totalPreguntas = 50;
        const numTemas = temasSeleccionados.length;
        const preguntasPorTema = Math.floor(totalPreguntas / numTemas);
        const preguntasExtras = totalPreguntas % numTemas;
        
        let texto = '📊 Distribución: ';
        const distribucionPorTema = [];
        
        temasSeleccionados.forEach((tema, index) => {
            const cantidad = preguntasPorTema + (index < preguntasExtras ? 1 : 0);
            distribucionPorTema.push(`Tema ${tema}: ${cantidad}`);
        });
        
        texto += distribucionPorTema.join(' | ');
        
        const infoDiv = document.getElementById('infoDistribucion');
        if (infoDiv) {
            infoDiv.textContent = texto;
        }
    },

    limpiarFallos() {
        if (Object.keys(this.fallos).length === 0) return;
        
        if (confirm('¿Estás seguro de que quieres eliminar todas las preguntas falladas guardadas?')) {
            this.fallos = {};
            localStorage.removeItem('fallos');
            this.actualizarUI();
            alert('Preguntas falladas eliminadas correctamente');
        }
    },

    // ========== UI ==========
    actualizarUI() {
        const fallosCount = Object.keys(this.fallos).length;
        document.getElementById('contadorFallos').textContent = fallosCount;
        document.getElementById('badgeFallos').textContent = fallosCount;
        
        const btnTestFallos = document.getElementById('btnTestFallos');
        const btnLimpiarFallos = document.getElementById('btnLimpiarFallos');
        
        if (fallosCount > 0) {
            btnTestFallos.disabled = false;
            if (btnLimpiarFallos) btnLimpiarFallos.disabled = false;
        } else {
            btnTestFallos.disabled = true;
            if (btnLimpiarFallos) btnLimpiarFallos.disabled = true;
        }
        
        this.actualizarDistribucion();
        this.actualizarConfigUI();
    },
    
    barajar(array) {
        const copia = [...array];
        for (let i = copia.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copia[i], copia[j]] = [copia[j], copia[i]];
        }
        return copia;
    },
    
    sample(array, n) {
        return this.barajar(array).slice(0, n);
    },
    
    esGaitero(pregunta) {
        return /gaitero/i.test(pregunta.cuestion);
    },
    
    extraerTema(pregunta) {
        const match = pregunta.cuestion.match(/-L(\d+)-/i);
        if (match && match[1]) {
            const numeroTema = match[1];
            if (numeroTema === '11' || numeroTema === '12' || numeroTema === '1') {
                return 1;
            } else if (numeroTema === '21') {
                return 2;
            } else if (numeroTema === '31') {
                return 3;
            } else if (numeroTema === '41') {
                return 4;
            } else if (numeroTema === '51') {
                return 5;
            }
        }
        return null;
    },
    
    iniciarNavegacionTeclado() {
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }
        
        this.keyboardHandler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.anterior();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (this.indiceActual >= this.preguntas.length - 1) {
                        this.terminar();
                    } else {
                        this.siguiente();
                    }
                    break;
                case '1':
                    e.preventDefault();
                    this.responderPregunta(0);
                    break;
                case '2':
                    e.preventDefault();
                    this.responderPregunta(1);
                    break;
                case '3':
                    e.preventDefault();
                    this.responderPregunta(2);
                    break;
                case '4':
                    e.preventDefault();
                    this.responderPregunta(3);
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.terminar();
                    break;
            }
        };
        
        document.addEventListener('keydown', this.keyboardHandler);
    },

    mostrarDetalleErrores(errores) {
        const contenedor = document.getElementById('erroresDetalle');
        if (!contenedor) return;
        
        contenedor.innerHTML = '';
        contenedor.classList.remove('oculto');
        
        if (errores.length === 0) {
            contenedor.innerHTML = '<p style="color: #4ade80; font-weight: bold;">¡Todas las respuestas son correctas! 🎉</p>';
            return;
        }
        
        const titulo = document.createElement('h3');
        titulo.textContent = `Detalles de respuestas incorrectas (${errores.length})`;
        titulo.style.color = '#f87171';
        titulo.style.marginTop = '20px';
        contenedor.appendChild(titulo);
        
        errores.forEach((error, idx) => {
            const div = document.createElement('div');
            div.style.marginBottom = '15px';
            div.style.padding = '10px';
            div.style.border = '1px solid #ef4444';
            div.style.borderRadius = '5px';
            
            const numPregunta = document.createElement('p');
            numPregunta.textContent = `Pregunta ${idx + 1}: ${error.pregunta}`;
            numPregunta.style.color = '#fbbf24';
            numPregunta.style.marginBottom = '5px';
            
            const respuesta = document.createElement('p');
            respuesta.innerHTML = `<span style="color: #f87171;">Tu respuesta:</span> ${error.respuestaUsuario}`;
            respuesta.style.marginBottom = '5px';
            
            const correcta = document.createElement('p');
            correcta.innerHTML = `<span style="color: #4ade80;">Respuesta correcta:</span> ${error.respuestaCorrecta}`;
            
            div.appendChild(numPregunta);
            div.appendChild(respuesta);
            div.appendChild(correcta);
            contenedor.appendChild(div);
        });
    },

    obtenerIndiceCorrecto(pregunta) {
        const letraSolucion = pregunta.solucion;
        const mapeo = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
        return mapeo[letraSolucion] || 0;
    }
};

// ========== INICIO ==========
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('examen').classList.add('oculto');
    document.getElementById('resultados').classList.add('oculto');
    document.getElementById('seleccionModo').classList.remove('oculto');
    document.getElementById('modoActual').textContent = '-';
    document.getElementById('tiempoRestante').textContent = 'Tiempo: 0:00';
    app.actualizarUI();
    app.actualizarConfigUI();
    actualizarTemasUI();
});

function actualizarTemasUI() {
    const temasSeleccionados = app.config.practica.temasSeleccionados;
    for (let i = 1; i <= 5; i++) {
        const checkbox = document.querySelector(`input[type="checkbox"][value="${i}"]`);
        if (checkbox) {
            checkbox.checked = temasSeleccionados.includes(i);
        }
    }
    app.actualizarDistribucion();
}

window.addEventListener('load', () => app.init());
