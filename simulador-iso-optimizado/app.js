// ========== CONFIGURACIÓN GLOBAL ==========
let PREGUNTAS_COMPLETAS = [];
const TEMAS = ['L1', 'L21', 'L31', 'L41', 'L51'];

// ========== OBJETO PRINCIPAL ==========
const app = {
    preguntas: [],
    indiceActual: 0,
    modo: '',
    timerInterval: null,
    tiempoRestante: 0,
    respuestas: {},
    fallos: JSON.parse(localStorage.getItem('fallos')) || {},
    config: {
        practica: {
            ordenarPorTema: false,
            temasSeleccionados: [1, 2, 3, 4, 5]
        },
        examen: {
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
            this.actualizarUI();
        } catch (error) {
            console.error('Error al cargar preguntas:', error);
        }
    },

    // ========== MODOS DE INICIO ==========
    iniciarModo(modo) {
        this.modo = modo;
        this.respuestas = {};
        
        if (modo === 'examen') {
            this.preguntas = this.obtenerPreguntasExamen();
            this.tiempoRestante = 50 * 60;
            this.iniciarTimer();
        } else if (modo === 'practica') {
            this.preguntas = this.obtenerPreguntasPractica();
        } else if (modo === 'fallos') {
            this.preguntas = Object.keys(this.fallos)
                .map(id => PREGUNTAS_COMPLETAS.find(p => p.cuestion === id))
                .filter(p => p);
        }
        
        this.indiceActual = 0;
        this.mostrarPregunta();
        document.getElementById('seleccionModo').classList.add('oculto');
        document.getElementById('examen').classList.remove('oculto');
    },

    // ========== SELECCIÓN DE PREGUNTAS ==========
    obtenerPreguntasExamen() {
        const preguntasPorTema = {};
        TEMAS.forEach(tema => preguntasPorTema[tema] = []);
        
        PREGUNTAS_COMPLETAS.forEach(p => {
            TEMAS.forEach(tema => {
                if (p.cuestion.includes(tema)) {
                    preguntasPorTema[tema].push(p);
                }
            });
        });
        
        let seleccionadas = [];
        TEMAS.forEach(tema => {
            const t = preguntasPorTema[tema]
                .sort(() => Math.random() - 0.5)
                .slice(0, 10);
            seleccionadas = seleccionadas.concat(t);
        });
        
        return seleccionadas.slice(0, 50);
    },

    obtenerPreguntasPractica() {
        const temasSeleccionados = this.config.practica.temasSeleccionados.map(n => TEMAS[n - 1]);
        const filtradas = PREGUNTAS_COMPLETAS.filter(p =>
            temasSeleccionados.some(tema => p.cuestion.includes(tema))
        );
        
        let seleccionadas = filtradas
            .sort(() => Math.random() - 0.5)
            .slice(0, 50);
        
        if (this.config.practica.ordenarPorTema) {
            seleccionadas.sort((a, b) => a.cuestion.localeCompare(b.cuestion));
        }
        
        return seleccionadas;
    },

    // ========== MOSTRAR PREGUNTA ==========
    mostrarPregunta() {
        const pregunta = this.preguntas[this.indiceActual];
        if (!pregunta) return;

        document.getElementById('preguntaNumero').textContent = 
            `Pregunta ${this.indiceActual + 1}/${this.preguntas.length}`;
        
        document.getElementById('preguntaTexto').textContent = pregunta.cuestion;
        
        const contenedor = document.getElementById('opcionesContenedor');
        contenedor.innerHTML = '';
        
        pregunta.opciones.forEach((opcion, idx) => {
            const div = document.createElement('div');
            div.className = 'opcion';
            div.textContent = opcion;
            
            const respuestaGuardada = this.respuestas[this.indiceActual];
            if (respuestaGuardada === opcion) div.classList.add('seleccionada');
            
            div.onclick = () => this.seleccionarOpcion(idx, opcion);
            contenedor.appendChild(div);
        });

        this.actualizarBotones();
        document.getElementById('barraProgreso').style.width = 
            ((this.indiceActual + 1) / this.preguntas.length * 100) + '%';
    },

    seleccionarOpcion(idx, opcion) {
        this.respuestas[this.indiceActual] = opcion;
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
        if (this.indiceActual > 0 && this.modo !== 'examen') {
            this.indiceActual--;
            this.mostrarPregunta();
        }
    },

    // ========== BOTONES ==========
    actualizarBotones() {
        document.getElementById('btnAnterior').disabled = 
            this.indiceActual === 0 || this.modo === 'examen';
        document.getElementById('btnSiguiente').disabled = 
            this.indiceActual === this.preguntas.length - 1;
    },

    // ========== TERMINAR ==========
    terminar() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        let correctas = 0, incorrectas = 0, sinResponder = 0;
        const errores = [];

        this.preguntas.forEach((pregunta, idx) => {
            const respuesta = this.respuestas[idx];
            if (!respuesta) {
                sinResponder++;
            } else if (respuesta.startsWith(pregunta.solucion + '.')) {
                correctas++;
            } else {
                incorrectas++;
                errores.push(pregunta);
                this.fallos[pregunta.cuestion] = true;
            }
        });

        localStorage.setItem('fallos', JSON.stringify(this.fallos));

        this.mostrarResultados(correctas, incorrectas, sinResponder, errores);
    },

    mostrarResultados(correctas, incorrectas, sinResponder, errores) {
        const total = this.preguntas.length;
        const puntuacion = Math.round((correctas / total) * 10);
        
        document.getElementById('respuestasCorrectas').textContent = correctas;
        document.getElementById('respuestasIncorrectas').textContent = incorrectas;
        document.getElementById('sinResponder').textContent = sinResponder;
        document.getElementById('puntuacionFinal').textContent = `${puntuacion}/10`;

        if (this.modo !== 'examen' && errores.length > 0) {
            let html = '<h3 style="color: #00d4ff; margin-bottom: 15px;">Respuestas Incorrectas</h3>';
            errores.forEach(pregunta => {
                html += `
                    <div class="error-item">
                        <div class="error-pregunta">${pregunta.cuestion}</div>
                        <div class="error-respuesta">
                            Opciones correcta: <span class="respuesta-correcta">${pregunta.solucion}</span>
                        </div>
                    </div>
                `;
            });
            document.getElementById('erroresDetalle').innerHTML = html;
            document.getElementById('erroresDetalle').classList.remove('oculto');
        }

        document.getElementById('examen').classList.add('oculto');
        document.getElementById('resultados').classList.remove('oculto');
    },

    reiniciar() {
        this.indiceActual = 0;
        this.respuestas = {};
        document.getElementById('seleccionModo').classList.remove('oculto');
        document.getElementById('examen').classList.add('oculto');
        document.getElementById('resultados').classList.add('oculto');
        this.actualizarUI();
    },

    // ========== TIMER ==========
    iniciarTimer() {
        document.getElementById('modoActual').textContent = '⏱️ Examen';
        this.timerInterval = setInterval(() => {
            this.tiempoRestante--;
            const minutos = Math.floor(this.tiempoRestante / 60);
            const segundos = this.tiempoRestante % 60;
            document.getElementById('tiempoRestante').textContent = 
                `${minutos}:${segundos.toString().padStart(2, '0')}`;
            
            if (this.tiempoRestante <= 0) {
                clearInterval(this.timerInterval);
                this.terminar();
            }
        }, 1000);
    },

    // ========== CONFIGURACIÓN ==========
    toggleConfig(key) {
        const config = this.config[this.modo];
        if (config) {
            config[key] = !config[key];
            document.getElementById('toggleOrdenTema').classList.toggle('active');
        }
    },

    toggleTema(numero) {
        const config = this.config.practica;
        const idx = config.temasSeleccionados.indexOf(numero);
        if (idx > -1) {
            config.temasSeleccionados.splice(idx, 1);
        } else {
            config.temasSeleccionados.push(numero);
        }
        this.actualizarUI();
    },

    limpiarFallos() {
        this.fallos = {};
        localStorage.removeItem('fallos');
        this.actualizarUI();
    },

    // ========== UI ==========
    actualizarUI() {
        const fallosCount = Object.keys(this.fallos).length;
        document.getElementById('contadorFallos').textContent = fallosCount;
        document.getElementById('badgeFallos').textContent = fallosCount;
        document.getElementById('btnTestFallos').disabled = fallosCount === 0;

        const distribucion = this.config.practica.temasSeleccionados.length;
        document.getElementById('infoDistribucion').textContent = 
            `${50 / (distribucion || 1) >> 0} preguntas por tema`;
    }
};

// ========== EVENTOS ==========
document.addEventListener('keydown', (e) => {
    if (!document.getElementById('examen').classList.contains('oculto')) {
        if (e.key === 'ArrowLeft') app.anterior();
        if (e.key === 'ArrowRight') app.siguiente();
        if (e.key === 'Enter') app.terminar();
        
        const num = parseInt(e.key) - 1;
        if (num >= 0 && num <= 3) {
            const opciones = document.querySelectorAll('.opcion');
            if (opciones[num]) opciones[num].click();
        }
    }
});

// ========== INICIO ==========
window.addEventListener('load', () => app.init());
