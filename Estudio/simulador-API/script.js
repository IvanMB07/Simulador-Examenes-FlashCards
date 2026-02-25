// TODAS LAS PREGUNTAS (cargadas desde JSON)
let PREGUNTAS_COMPLETAS = [];

// URL de respaldo del archivo JSON en GitHub (RAW)
const URL_PREGUNTAS = 'https://raw.githubusercontent.com/IvanMB07/Simulador-Examenes-FlashCards/main/Estudio/simulador-API/preguntas.json';

async function fetchConTimeout(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { cache: 'no-store', signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// Función para cargar las preguntas (primero local, luego respaldo remoto)
async function cargarPreguntasDesdeJSON() {
    const fuentes = [
        { nombre: 'local', url: './preguntas.json' },
        { nombre: 'remota', url: URL_PREGUNTAS }
    ];

    try {
        for (const fuente of fuentes) {
            try {
                console.log(`🔄 Cargando preguntas desde ${fuente.nombre}...`);
                const response = await fetchConTimeout(fuente.url);

                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }

                const data = await response.json();
                if (!Array.isArray(data)) {
                    throw new Error('Formato JSON inválido (se esperaba un array)');
                }

                PREGUNTAS_COMPLETAS = data;
                console.log(`✅ ${PREGUNTAS_COMPLETAS.length} preguntas cargadas desde ${fuente.nombre}`);
                return true;
            } catch (errorFuente) {
                console.warn(`⚠️ Fallo cargando desde ${fuente.nombre}:`, errorFuente.message || errorFuente);
            }
        }

        throw new Error('No se pudo cargar preguntas ni en local ni en remoto');
    } catch (error) {
        console.error('❌ Error al cargar preguntas:', error);
        alert('Error al cargar las preguntas. Revisa conexión y recarga la página.');
        return false;
    }
}

// Configuración del modo examen
// Temas: 1, 2, 3, 4, 5, 6
const TEMAS_EXAMEN = [1, 2, 3, 4, 5, 6];
const PREGUNTAS_POR_TEMA_EXAMEN = 4;
const TOTAL_PREGUNTAS_EXAMEN = 25;

// Sistema de almacenamiento de preguntas falladas
class GestorFallos {
    constructor() {
        this.cargarFallos();
    }

    cargarFallos() {
        try {
      const data = localStorage.getItem(this.getStorageKey());
            this.fallos = data ? JSON.parse(data) : [];
        } catch (e) {
            this.fallos = [];
        }
    }

    guardarFallos() {
        try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.fallos));
        } catch (e) {
            console.error('Error al guardar fallos:', e);
        }
    }

  getStorageKey() {
    const perfilActual = (typeof configuracion !== 'undefined' && configuracion.get('perfilActual')) || 'default';
    return `preguntasFalladas:perfil:${perfilActual}`;
  }

  cambiarUsuario() {
    this.cargarFallos();
  }

    agregarFallo(pregunta, respuestaUsuario, respuestaCorrecta) {
        // Evitar duplicados
        const existe = this.fallos.some(f => f.cuestion === pregunta.cuestion);
        if (!existe) {
            this.fallos.push({
                ...pregunta,
                respuestaUsuario,
                respuestaCorrecta,
                fecha: new Date().toISOString()
            });
            this.guardarFallos();
            
            // Actualizar estadísticas del perfil si la función existe
            if (typeof actualizarEstadisticasPerfil === 'function') {
                actualizarEstadisticasPerfil();
            }
        }
    }

    obtenerFallos() {
        return this.fallos;
    }

    limpiarFallos() {
        this.fallos = [];
        this.guardarFallos();
    }

    contarFallos() {
        return this.fallos.length;
    }
}

const gestorFallos = new GestorFallos();

// Sistema de historial de preguntas recientes
class GestorHistorial {
    constructor() {
        this.maxHistorial = 150; // Guardar las últimas 150 preguntas vistas
        this.cargarHistorial();
    }

    cargarHistorial() {
        try {
            const data = localStorage.getItem(this.getStorageKey());
            this.historial = data ? JSON.parse(data) : [];
        } catch (e) {
            this.historial = [];
        }
    }

    guardarHistorial() {
        try {
            localStorage.setItem(this.getStorageKey(), JSON.stringify(this.historial));
        } catch (e) {
            console.error('Error al guardar historial:', e);
        }
    }

    getStorageKey() {
        const perfilActual = (typeof configuracion !== 'undefined' && configuracion.get('perfilActual')) || 'default';
        return `historialPreguntas:perfil:${perfilActual}`;
    }

    cambiarUsuario() {
        this.cargarHistorial();
    }

    registrarPreguntas(preguntas) {
        // Agregar nuevas preguntas al historial
        const cuestiones = preguntas.map(p => p.cuestion);
        this.historial.push(...cuestiones);
        
        // Mantener solo las últimas N preguntas
        if (this.historial.length > this.maxHistorial) {
            this.historial = this.historial.slice(-this.maxHistorial);
        }
        
        this.guardarHistorial();
    }

    estáEnHistorial(pregunta) {
        return this.historial.includes(pregunta.cuestion);
    }

    obtenerPrioridad(pregunta) {
        // Retorna un valor de prioridad (0 = más reciente, mayor = más antigua)
        const indice = this.historial.lastIndexOf(pregunta.cuestion);
        if (indice === -1) return Infinity; // No está en historial = máxima prioridad
        return this.historial.length - indice; // Cuanto mayor, más tiempo sin ver
    }

    limpiarHistorial() {
        this.historial = [];
        this.guardarHistorial();
    }
}

const gestorHistorial = new GestorHistorial();

// Sistema de configuración
class ConfiguracionApp {
    constructor() {
        this.cargarConfig();
    }

    cargarConfig() {
        try {
            const data = localStorage.getItem('configApp');
            this.config = data ? JSON.parse(data) : {
              ordenarPorTema: false,
              temasSeleccionados: [1, 2, 3, 4, 5, 6],
              perfilActual: 'default',
              perfiles: {}
            };
            // Asegurar que existan las nuevas propiedades
            if (!this.config.perfilActual) this.config.perfilActual = 'default';
            if (!this.config.perfiles) this.config.perfiles = {};
        } catch (e) {
            this.config = {
              ordenarPorTema: false,
              temasSeleccionados: [1, 2, 3, 4, 5, 6],
              perfilActual: 'default',
              perfiles: {}
            };
        }
    }

    guardarConfig() {
        try {
            localStorage.setItem('configApp', JSON.stringify(this.config));
        } catch (e) {
            console.error('Error al guardar configuración:', e);
        }
    }

    get(clave) {
        return this.config[clave];
    }

    set(clave, valor) {
        this.config[clave] = valor;
        this.guardarConfig();
    }

    toggle(clave) {
        this.config[clave] = !this.config[clave];
        this.guardarConfig();
        return this.config[clave];
    }
}

const configuracion = new ConfiguracionApp();

class SimuladorExamen {
    constructor(modo) {
        this.modo = modo;
        this.preguntas = [];
        this.preguntaActual = 0;
        this.respuestas = {};
        this.sinResponder = new Set(); // Para marcar preguntas sin responder
        this.tiempoInicio = Date.now();
        this.tiempoLimiteMs = this.modo === 'examen' ? 25 * 60 * 1000 : null;
        this.timerId = null;
        this.bloqueadoPorTiempo = false;
        this.erroresDelTest = []; // Para guardar errores del test actual
        this.keyboardHandler = null; // Para guardar referencia al handler del teclado
        this.opcionEnfocada = 0; // Índice de la opción actualmente enfocada
        this.focoActivo = false; // Indicador de si el foco visual está activo
        this.inicializar();
    }

    inicializar() {
        this.detenerTiempo();
        this.bloqueadoPorTiempo = false;
        this.erroresDelTest = [];
        
        // Registrar preguntas del test anterior en el historial (si había)
        if (this.preguntas && this.preguntas.length > 0) {
            gestorHistorial.registrarPreguntas(this.preguntas);
        }

        if (this.modo === 'examen') {
            // Modo examen: siempre 50 preguntas, 10 de cada uno de los 5 temas
            this.preguntas = this.seleccionarPreguntasExamen();
        } else if (this.modo === 'fallos') {
            // Modo fallos: todas las preguntas falladas guardadas
            this.preguntas = gestorFallos.obtenerFallos();
            if (this.preguntas.length === 0) {
                alert('No hay preguntas falladas guardadas');
                this.reiniciar();
                return;
            }
        } else {
            // Modo práctica: 50 preguntas distribuidas proporcionalmente entre los temas seleccionados
            const ordenarPorTema = configuracion.get('ordenarPorTema');
            const temasSeleccionados = configuracion.get('temasSeleccionados') || [1, 2, 3, 4, 5];
            this.preguntas = this.seleccionarPreguntasPractica(temasSeleccionados, ordenarPorTema);
        }
        this.respuestas = {};
        this.sinResponder = new Set();
        this.preguntaActual = 0;
        this.tiempoInicio = Date.now();
        this.mostrarPregunta();
        this.iniciarTiempo();
        this.iniciarNavegacionTeclado();
    }

    iniciarNavegacionTeclado() {
        // Remover handler anterior si existe
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }

        // Crear y guardar el nuevo handler
        this.keyboardHandler = (e) => {
            // Ignorar si estamos en un input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.anterior();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    // Si estamos en la última pregunta, finalizar en lugar de avanzar
                    if (this.preguntaActual >= this.preguntas.length - 1) {
                        this.terminar();
                    } else {
                        this.siguiente();
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.moverFocoOpcion(-1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.moverFocoOpcion(1);
                    break;
                case ' ':
                case 'Spacebar':
                    e.preventDefault();
                    this.seleccionarOpcion(this.opcionEnfocada);
                    break;
                case '1':
                    e.preventDefault();
                    this.seleccionarOpcion(0);
                    break;
                case '2':
                    e.preventDefault();
                    this.seleccionarOpcion(1);
                    break;
                case '3':
                    e.preventDefault();
                    this.seleccionarOpcion(2);
                    break;
                case '4':
                    e.preventDefault();
                    this.seleccionarOpcion(3);
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.terminar();
                    break;
            }
        };

        document.addEventListener('keydown', this.keyboardHandler);
    }

    moverFocoOpcion(direccion) {
        const pregunta = this.preguntas[this.preguntaActual];
        if (!pregunta) return;

        const totalOpciones = pregunta.opciones.length;
        this.opcionEnfocada = (this.opcionEnfocada + direccion + totalOpciones) % totalOpciones;
        this.focoActivo = true; // Activar el foco visual
        this.actualizarFocoVisual();
    }

    actualizarFocoVisual() {
        const botones = document.querySelectorAll('#opcionesContenedor .opcion');
        botones.forEach((boton, indice) => {
            if (this.focoActivo && indice === this.opcionEnfocada) {
                boton.classList.add('enfocada');
                boton.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                boton.classList.remove('enfocada');
            }
        });
    }

    seleccionarOpcion(indice) {
        const pregunta = this.preguntas[this.preguntaActual];
        if (!pregunta || indice >= pregunta.opciones.length) {
            return;
        }

        // En modo práctica: no permitir cambiar si ya está respondida
        const yaRespondida = this.respuestas.hasOwnProperty(this.preguntaActual);
        if (this.modo === 'practica' && yaRespondida) {
            return;
        }

        // Actualizar el foco a la opción seleccionada
        this.opcionEnfocada = indice;
        this.responderPregunta(indice);
    }

    seleccionarPreguntasPractica(temasSeleccionados, ordenarPorTema = false) {
        const pool = PREGUNTAS_COMPLETAS.filter(p => !this.esGaitero(p));
        const totalPreguntas = 25;
        const poolTemasSeleccionados = pool.filter(p => temasSeleccionados.includes(this.extraerTema(p)));
        
        // Agrupar preguntas por tema
        const grupos = new Map();
        for (const pregunta of pool) {
            const tema = this.extraerTema(pregunta);
            if (tema === null) continue;
            if (!grupos.has(tema)) grupos.set(tema, []);
            grupos.get(tema).push(pregunta);
        }

        // Calcular preguntas por tema
        const numTemas = temasSeleccionados.length;
        const preguntasPorTema = Math.floor(totalPreguntas / numTemas);
        const preguntasExtras = totalPreguntas % numTemas;

        const seleccion = [];

        if (ordenarPorTema) {
            // Mantener orden por temas
            temasSeleccionados.forEach((tema, index) => {
                const preguntasTema = grupos.get(tema) || [];
                const cantidad = preguntasPorTema + (index < preguntasExtras ? 1 : 0);
                const preguntasMezcladas = this.barajar(preguntasTema);
                seleccion.push(...preguntasMezcladas.slice(0, cantidad));
            });
        } else {
            // Orden aleatorio
            const preguntasPorTemaTemporal = [];
            temasSeleccionados.forEach((tema, index) => {
                const preguntasTema = grupos.get(tema) || [];
                const cantidad = preguntasPorTema + (index < preguntasExtras ? 1 : 0);
                const preguntasMezcladas = this.barajar(preguntasTema);
                preguntasPorTemaTemporal.push(...preguntasMezcladas.slice(0, cantidad));
            });
            seleccion.push(...this.barajar(preguntasPorTemaTemporal));
        }

        const seleccionNormalizada = this.normalizarSeleccionConDependencias(
            seleccion,
            totalPreguntas,
            poolTemasSeleccionados
        );

        if (ordenarPorTema) {
            return seleccionNormalizada;
        }

        return this.barajarRespetandoDependencias(seleccionNormalizada);
    }

    seleccionarPreguntas(cantidad, ordenarPorTema = false) {
        // Esta función ya no se usa, mantenida por compatibilidad
        return this.seleccionarPreguntasPractica([1, 2, 3, 4, 5, 6], ordenarPorTema);
    }

    shuffleConSemilla(array, seed) {
        const copia = [...array];
        let random = this.seededRandom(seed);
        
        for (let i = copia.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [copia[i], copia[j]] = [copia[j], copia[i]];
        }
        return copia;
    }

    seededRandom(seed) {
        let estado = seed;
        return function() {
            estado = (estado * 9301 + 49297) % 233280;
            return estado / 233280;
        };
    }

    esGaitero(pregunta) {
        return /gaitero/i.test(pregunta.cuestion);
    }

    obtenerGrupoDependencia(pregunta) {
        if (!pregunta || !pregunta.grupoDependencia) return null;
        return pregunta.mantenerJuntas === false ? null : String(pregunta.grupoDependencia);
    }

    ordenarPreguntasDeGrupo(preguntas) {
        return [...preguntas].sort((a, b) => {
            const ordenA = Number.isFinite(a.ordenGrupo) ? a.ordenGrupo : Number.MAX_SAFE_INTEGER;
            const ordenB = Number.isFinite(b.ordenGrupo) ? b.ordenGrupo : Number.MAX_SAFE_INTEGER;
            if (ordenA !== ordenB) return ordenA - ordenB;
            return a.cuestion.localeCompare(b.cuestion, 'es');
        });
    }

    construirMapaGrupos(pool) {
        const grupos = new Map();
        for (const pregunta of pool) {
            const grupo = this.obtenerGrupoDependencia(pregunta);
            if (!grupo) continue;
            if (!grupos.has(grupo)) grupos.set(grupo, []);
            grupos.get(grupo).push(pregunta);
        }
        for (const [id, preguntas] of grupos.entries()) {
            grupos.set(id, this.ordenarPreguntasDeGrupo(preguntas));
        }
        return grupos;
    }

    compactarDependenciasEnOrden(lista) {
        const resultado = [];
        const gruposAñadidos = new Set();
        const preguntasAñadidas = new Set();

        for (const pregunta of lista) {
            const clave = pregunta.cuestion;
            if (preguntasAñadidas.has(clave)) continue;

            const grupo = this.obtenerGrupoDependencia(pregunta);
            if (!grupo) {
                resultado.push(pregunta);
                preguntasAñadidas.add(clave);
                continue;
            }

            if (gruposAñadidos.has(grupo)) continue;

            gruposAñadidos.add(grupo);
            const bloque = this.ordenarPreguntasDeGrupo(
                lista.filter(p => this.obtenerGrupoDependencia(p) === grupo)
            );

            for (const item of bloque) {
                const itemClave = item.cuestion;
                if (preguntasAñadidas.has(itemClave)) continue;
                resultado.push(item);
                preguntasAñadidas.add(itemClave);
            }
        }

        return resultado;
    }

    normalizarSeleccionConDependencias(seleccionInicial, totalObjetivo, poolBase) {
        const mapaGrupos = this.construirMapaGrupos(poolBase);
        const seleccionOrdenada = this.compactarDependenciasEnOrden(seleccionInicial);

        const preguntasSeleccionadas = new Set(seleccionOrdenada.map(p => p.cuestion));
        const gruposRequeridos = new Set();

        for (const pregunta of seleccionOrdenada) {
            const grupo = this.obtenerGrupoDependencia(pregunta);
            if (grupo) gruposRequeridos.add(grupo);
        }

        const resultado = [];
        const resultadoSet = new Set();

        const añadirPregunta = (pregunta) => {
            if (!pregunta) return;
            if (resultadoSet.has(pregunta.cuestion)) return;
            resultado.push(pregunta);
            resultadoSet.add(pregunta.cuestion);
        };

        const añadirGrupoCompleto = (grupoId) => {
            const preguntasGrupo = mapaGrupos.get(grupoId) || [];
            for (const pregunta of preguntasGrupo) {
                añadirPregunta(pregunta);
            }
        };

        for (const pregunta of seleccionOrdenada) {
            const grupo = this.obtenerGrupoDependencia(pregunta);
            if (grupo) {
                añadirGrupoCompleto(grupo);
            } else {
                añadirPregunta(pregunta);
            }
        }

        if (resultado.length > totalObjetivo) {
            const clavesProtegidas = new Set();
            for (const grupo of gruposRequeridos) {
                for (const pregunta of mapaGrupos.get(grupo) || []) {
                    clavesProtegidas.add(pregunta.cuestion);
                }
            }

            for (let i = resultado.length - 1; i >= 0 && resultado.length > totalObjetivo; i--) {
                const pregunta = resultado[i];
                if (clavesProtegidas.has(pregunta.cuestion)) continue;
                resultadoSet.delete(pregunta.cuestion);
                resultado.splice(i, 1);
            }
        }

        if (resultado.length < totalObjetivo) {
            const disponibles = this.barajar(poolBase.filter(p => !resultadoSet.has(p.cuestion)));

            for (const candidata of disponibles) {
                if (resultado.length >= totalObjetivo) break;

                const grupo = this.obtenerGrupoDependencia(candidata);
                if (!grupo) {
                    añadirPregunta(candidata);
                    continue;
                }

                const preguntasGrupo = mapaGrupos.get(grupo) || [];
                const faltantesGrupo = preguntasGrupo.filter(p => !resultadoSet.has(p.cuestion));
                if (faltantesGrupo.length === 0) continue;
                if (resultado.length + faltantesGrupo.length > totalObjetivo) continue;

                for (const pregunta of faltantesGrupo) {
                    añadirPregunta(pregunta);
                }
            }
        }

        return this.compactarDependenciasEnOrden(resultado).slice(0, totalObjetivo);
    }

    barajarRespetandoDependencias(array) {
        const compactadas = this.compactarDependenciasEnOrden(array);
        const bloques = [];
        const gruposAñadidos = new Set();

        for (const pregunta of compactadas) {
            const grupo = this.obtenerGrupoDependencia(pregunta);
            if (!grupo) {
                bloques.push([pregunta]);
                continue;
            }

            if (gruposAñadidos.has(grupo)) continue;
            gruposAñadidos.add(grupo);
            bloques.push(compactadas.filter(p => this.obtenerGrupoDependencia(p) === grupo));
        }

        return this.barajar(bloques).flat();
    }

    extraerTema(pregunta) {
        // Busca el patrón -T1-, -T2-, etc.
        const match = pregunta.cuestion.match(/-T([1-6])-/i);
        if (match && match[1]) {
            return parseInt(match[1]);
        }
        return null;
    }

    barajar(array) {
        const copia = [...array];
        for (let i = copia.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copia[i], copia[j]] = [copia[j], copia[i]];
        }
        return copia;
    }

    sample(array, n) {
        if (array.length <= n) {
            return this.barajar(array);
        }

        // Dividir preguntas en 3 grupos según historial
        const noVistas = [];
        const vistasAntiguas = [];
        const vistasRecientes = [];
        
        const umbralReciente = 50; // Últimas 50 preguntas se consideran "recientes"
        
        for (const pregunta of array) {
            const prioridad = gestorHistorial.obtenerPrioridad(pregunta);
            
            if (prioridad === Infinity) {
                noVistas.push(pregunta);
            } else if (prioridad > umbralReciente) {
                vistasAntiguas.push(pregunta);
            } else {
                vistasRecientes.push(pregunta);
            }
        }
        
        // Estrategia de selección: priorizar no vistas, luego antiguas, luego recientes
        const seleccion = [];
        
        // 1. Tomar de no vistas
        const deNoVistas = Math.min(noVistas.length, n);
        seleccion.push(...this.barajar(noVistas).slice(0, deNoVistas));
        
        // 2. Si faltan, tomar de antiguas
        if (seleccion.length < n && vistasAntiguas.length > 0) {
            const faltan = n - seleccion.length;
            const deAntiguas = Math.min(vistasAntiguas.length, faltan);
            seleccion.push(...this.barajar(vistasAntiguas).slice(0, deAntiguas));
        }
        
        // 3. Si aún faltan, tomar de recientes (pero las menos recientes primero)
        if (seleccion.length < n && vistasRecientes.length > 0) {
            const faltan = n - seleccion.length;
            // Ordenar por prioridad descendente (menos recientes primero)
            vistasRecientes.sort((a, b) => 
                gestorHistorial.obtenerPrioridad(b) - gestorHistorial.obtenerPrioridad(a)
            );
            seleccion.push(...vistasRecientes.slice(0, faltan));
        }
        
        return this.barajar(seleccion).slice(0, n);
    }

    seleccionarPreguntasExamen() {
        // Modo examen: SIEMPRE 50 preguntas, 10 de cada uno de los 5 temas, orden aleatorio
        const pool = PREGUNTAS_COMPLETAS.filter(p => !this.esGaitero(p));

        const grupos = new Map();
        for (const pregunta of pool) {
            const tema = this.extraerTema(pregunta);
            if (tema === null) continue;
            if (!grupos.has(tema)) grupos.set(tema, []);
            grupos.get(tema).push(pregunta);
        }

        const temasExamen = [1, 2, 3, 4, 5, 6]; // Siempre los 6 temas
        const seleccion = [];
        const seleccionSet = new Set();

        for (const tema of temasExamen) {
            const preguntasTema = grupos.get(tema) ?? [];
            const elegidas = this.sample(preguntasTema, PREGUNTAS_POR_TEMA_EXAMEN);
            for (const p of elegidas) {
                seleccion.push(p);
                seleccionSet.add(p);
            }
        }

        // Si no llegamos a 50, completar con preguntas aleatorias
        if (seleccion.length < TOTAL_PREGUNTAS_EXAMEN) {
            const restantes = pool.filter(p => !seleccionSet.has(p));
            const faltan = TOTAL_PREGUNTAS_EXAMEN - seleccion.length;
            seleccion.push(...this.sample(restantes, faltan));
        }

        const seleccionNormalizada = this.normalizarSeleccionConDependencias(
            seleccion,
            TOTAL_PREGUNTAS_EXAMEN,
            pool
        );

        // Orden aleatorio final, respetando bloques de dependencia
        return this.barajarRespetandoDependencias(seleccionNormalizada).slice(0, TOTAL_PREGUNTAS_EXAMEN);
    }

    mostrarPregunta() {
        const pregunta = this.preguntas[this.preguntaActual];
        
        // Resetear el foco a la primera opción y desactivar el foco visual
        this.opcionEnfocada = 0;
        this.focoActivo = false;
        
        if (this.modo === 'examen') {
            const bloque = Math.floor(this.preguntaActual / 10) + 1;
            const totalBloques = Math.ceil(this.preguntas.length / 10);
            const enBloque = (this.preguntaActual % 10) + 1;
            const indicadorNoResponder = !this.respuestas.hasOwnProperty(this.preguntaActual) ? ' ⭕' : '';
            document.getElementById('preguntaNumero').textContent =
                `Bloque ${bloque}/${totalBloques} — Pregunta ${enBloque}/10 (global ${this.preguntaActual + 1}/${this.preguntas.length})${indicadorNoResponder}`;
        } else {
            document.getElementById('preguntaNumero').textContent =
                `Pregunta ${this.preguntaActual + 1} de ${this.preguntas.length}`;
        }
        const preguntaTextoEl = document.getElementById('preguntaTexto');
        this.renderizarPreguntaTexto(preguntaTextoEl, pregunta.cuestion);

        const contenedor = document.getElementById('opcionesContenedor');
        contenedor.innerHTML = '';

        const yaRespondida = this.respuestas.hasOwnProperty(this.preguntaActual);

        pregunta.opciones.forEach((opcion, indice) => {
            const boton = document.createElement('button');
            boton.className = 'opcion';
            
            // Agregar número de tecla al inicio
            const numeroTecla = document.createElement('span');
            numeroTecla.style.cssText = 'display: inline-block; background: #3a3a3a; padding: 2px 6px; border-radius: 3px; margin-right: 8px; font-size: 11px; color: #00d4ff;';
            numeroTecla.textContent = (indice + 1);
            
            const textoOpcion = document.createElement('span');
            textoOpcion.textContent = opcion;
            
            boton.appendChild(numeroTecla);
            boton.appendChild(textoOpcion);

            if (this.respuestas[this.preguntaActual] === indice) {
                boton.classList.add('seleccionada');
            }

            // En modo práctica: bloquear opciones una vez respondida
            if (this.modo === 'practica' && yaRespondida) {
                boton.disabled = true;
                boton.style.cursor = 'not-allowed';
                boton.style.opacity = '0.8';
            } else {
                boton.onclick = () => this.responderPregunta(indice);
            }

            contenedor.appendChild(boton);
        });

        // No aplicar foco visual por defecto, solo cuando se use arriba/abajo

        const btnAnterior = document.getElementById('btnAnterior');
        const btnSiguiente = document.getElementById('btnSiguiente');
        const btnNoResponder = document.getElementById('btnNoResponder');

        if (this.modo === 'examen') {
            // En modo examen: permitir volver atrás dentro del bloque (cada 10 preguntas)
            const inicioBloque = Math.floor(this.preguntaActual / 10) * 10;
            btnAnterior.classList.remove('oculto');
            btnAnterior.disabled = this.preguntaActual === inicioBloque;
        } else {
            btnAnterior.classList.remove('oculto');
            btnAnterior.disabled = this.preguntaActual === 0;
        }

        btnSiguiente.disabled = this.preguntaActual >= this.preguntas.length - 1;

        const progreso = ((this.preguntaActual + 1) / this.preguntas.length) * 100;
        document.getElementById('progresoBarra').style.width = progreso + '%';
        document.getElementById('numeroPregunta').textContent = this.preguntaActual + 1;

        if (this.modo === 'practica' && this.respuestas.hasOwnProperty(this.preguntaActual)) {
            this.aplicarFeedback();
        }
    }

    renderizarPreguntaTexto(contenedor, texto) {
        const lineas = texto.split('\n');
        const indiceCabecera = lineas.findIndex(linea => linea.includes('|'));

        if (indiceCabecera < 0) {
            contenedor.classList.remove('pregunta-texto-tabla');
            contenedor.innerHTML = '';
            contenedor.textContent = texto;
            return;
        }

        const filas = lineas
            .slice(indiceCabecera)
            .filter(linea => linea.includes('|'))
            .map(linea => linea.split('|').map(celda => celda.trim()));

        if (filas.length < 2) {
            contenedor.classList.remove('pregunta-texto-tabla');
            contenedor.innerHTML = '';
            contenedor.textContent = texto;
            return;
        }

        const introTexto = lineas.slice(0, indiceCabecera).join('\n').trim();

        contenedor.classList.add('pregunta-texto-tabla');
        contenedor.innerHTML = '';

        if (introTexto) {
            const intro = document.createElement('div');
            intro.className = 'pregunta-tabla-intro';
            intro.textContent = introTexto;
            contenedor.appendChild(intro);
        }

        const wrap = document.createElement('div');
        wrap.className = 'pregunta-tabla-wrap';

        const table = document.createElement('table');
        table.className = 'pregunta-tabla';

        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        filas[0].forEach(textoCelda => {
            const th = document.createElement('th');
            th.textContent = textoCelda;
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);

        const tbody = document.createElement('tbody');
        filas.slice(1).forEach(fila => {
            const tr = document.createElement('tr');
            fila.forEach(textoCelda => {
                const td = document.createElement('td');
                td.textContent = textoCelda;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        wrap.appendChild(table);
        contenedor.appendChild(wrap);
    }

    obtenerIndiceCorrecto(pregunta) {
        const objetivo = `${pregunta.solucion}.`;
        return pregunta.opciones.findIndex(op => op.trim().startsWith(objetivo) || op.trim().charAt(0) === pregunta.solucion);
    }

    aplicarFeedback() {
        const pregunta = this.preguntas[this.preguntaActual];
        const correcto = this.obtenerIndiceCorrecto(pregunta);
        const elegido = this.respuestas[this.preguntaActual];

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
    }

    responderPregunta(indice) {
        if (this.modo === 'practica') {
            // En práctica: seleccionar y bloquear (como antes)
            this.respuestas[this.preguntaActual] = indice;
        } else {
            // En examen: toggle (puedo desseleccionar y cambiar)
            if (this.respuestas[this.preguntaActual] === indice) {
                // Si ya está seleccionada, deseleccionar
                delete this.respuestas[this.preguntaActual];
            } else {
                // Seleccionar opción
                this.respuestas[this.preguntaActual] = indice;
            }
        }
        this.mostrarPregunta();
    }

    siguiente() {
        if (this.preguntaActual < this.preguntas.length - 1) {
            this.preguntaActual++;
            this.mostrarPregunta();
        }
    }

    anterior() {
        if (this.modo === 'examen') {
            // Permitir ir atrás dentro del bloque (cada 10 preguntas)
            const inicioBloque = Math.floor(this.preguntaActual / 10) * 10;
            if (this.preguntaActual > inicioBloque) {
                this.preguntaActual--;
                this.mostrarPregunta();
            }
        } else {
            if (this.preguntaActual > 0) {
                this.preguntaActual--;
                this.mostrarPregunta();
            }
        }
    }

    terminar() {
        if (this.bloqueadoPorTiempo) {
            this.mostrarResultados();
            return;
        }
        const contestadas = Object.keys(this.respuestas).length;
        const sinResponder = this.preguntas.length - contestadas;

        const mensaje = sinResponder > 0
            ? `¿Seguro que quieres terminar el examen?\n\nTe quedan ${sinResponder} preguntas sin responder.`
            : '¿Seguro que quieres terminar el examen?';

        if (!confirm(mensaje)) {
            return;
        }

        this.mostrarResultados();
    }

    mostrarResultados() {
        let correctas = 0;
        this.erroresDelTest = [];
        
        this.preguntas.forEach((pregunta, indice) => {
            if (this.respuestas.hasOwnProperty(indice)) {
                const indiceRespuesta = this.respuestas[indice];
                const respuestaUsuario = pregunta.opciones[indiceRespuesta].charAt(0);
                const esCorrecta = respuestaUsuario === pregunta.solucion;
                
                if (esCorrecta) {
                    correctas++;
                } else {
                    // Guardar error del test actual
                    const indiceCorrecto = this.obtenerIndiceCorrecto(pregunta);
                    this.erroresDelTest.push({
                        pregunta: pregunta.cuestion,
                        respuestaUsuario: pregunta.opciones[indiceRespuesta],
                        respuestaCorrecta: pregunta.opciones[indiceCorrecto]
                    });
                    
                    // Guardar en el gestor de fallos (todos los modos)
                    gestorFallos.agregarFallo(
                        pregunta,
                        pregunta.opciones[indiceRespuesta],
                        pregunta.opciones[indiceCorrecto]
                    );
                }
            } else {
                // Todas las preguntas no respondidas se agregan al test de fallos
                const indiceCorrecto = this.obtenerIndiceCorrecto(pregunta);
                gestorFallos.agregarFallo(
                    pregunta,
                    '(No respondida)',
                    pregunta.opciones[indiceCorrecto]
                );
            }
        });

        const incorrectas = Object.keys(this.respuestas).length - correctas;
        const sinResponder = this.preguntas.length - Object.keys(this.respuestas).length;
        
        // Fórmula (examen real): (Correctas - Incorrectas/3) / Total de preguntas × 10
        // 3 preguntas mal restan 1 bien.
        // IMPORTANTE: Solo contar las preguntas respondidas para el cálculo de puntuación
        const preguntasContadas = Object.keys(this.respuestas).length;
        const puntuacionRaw = correctas - (incorrectas / 3);
        const puntuacionFinal = preguntasContadas > 0 
            ? Math.max(0, Math.min(10, (puntuacionRaw / preguntasContadas) * 10))
            : 0;

        document.getElementById('respuestasCorrectas').textContent = correctas;
        document.getElementById('respuestasIncorrectas').textContent = incorrectas;
        document.getElementById('sinResponder').textContent = sinResponder;
        document.getElementById('puntuacionFinal').textContent = puntuacionFinal.toFixed(2) + '/10';

        // Mostrar detalle de errores
        this.mostrarDetalleErrores();

        document.getElementById('examen').classList.add('oculto');
        document.getElementById('resultados').classList.remove('oculto');
    }

    mostrarDetalleErrores() {
        const contenedor = document.getElementById('erroresDetalle');
        
        // Recopilar preguntas no respondidas (todas las que no tienen respuesta)
        const preguntasNoRespondidas = [];
        this.preguntas.forEach((pregunta, indice) => {
            if (!this.respuestas.hasOwnProperty(indice)) {
                preguntasNoRespondidas.push({
                    pregunta: pregunta.cuestion,
                    indice: indice
                });
            }
        });
        
        if (this.erroresDelTest.length === 0 && preguntasNoRespondidas.length === 0) {
            contenedor.classList.add('oculto');
            return;
        }

        contenedor.classList.remove('oculto');
        let html = '';
        
        // Mostrar preguntas falladas
        if (this.erroresDelTest.length > 0) {
            html += '<h3 style="color: #ef4444; margin-bottom: 15px;">📋 Preguntas Falladas</h3>';
            this.erroresDelTest.forEach((error, index) => {
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
        }
        
        // Mostrar preguntas no respondidas
        if (preguntasNoRespondidas.length > 0) {
            if (this.erroresDelTest.length > 0) {
                html += '<hr style="border: none; border-top: 1px solid #3a3a3a; margin: 20px 0;">';
            }
            html += '<h3 style="color: #8b5cf6; margin-bottom: 15px; margin-top: 20px;">⭕ Preguntas No Respondidas</h3>';
            html += '<div style="font-size: 12px; color: #888; margin-bottom: 15px;">Se han agregado al test de fallos para que las repases</div>';
            
            preguntasNoRespondidas.forEach((item, index) => {
                const respuestaCorrecta = this.preguntas[item.indice].opciones[this.obtenerIndiceCorrecto(this.preguntas[item.indice])];
                html += `
                    <div class="error-item" style="border-left-color: #8b5cf6;">
                        <div class="error-pregunta">⭕ ${index + 1}. ${item.pregunta}</div>
                        <div class="error-respuesta respuesta-correcta">
                            ✓ Respuesta correcta: ${respuestaCorrecta}
                        </div>
                    </div>
                `;
            });
        }
        
        contenedor.innerHTML = html;
    }

    reiniciar() {
        this.detenerTiempo();
        // Limpiar el event listener del teclado
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        document.getElementById('resultados').classList.add('oculto');
        document.getElementById('examen').classList.add('oculto');
        document.getElementById('seleccionModo').classList.remove('oculto');
        document.getElementById('modoActual').textContent = '-';
        actualizarContadorFallos();
    }

    iniciarTiempo() {
        this.detenerTiempo();
        this.timerId = setInterval(() => {
            const ahora = Date.now();
            const transcurridoMs = ahora - this.tiempoInicio;

            if (this.modo === 'examen' && this.tiempoLimiteMs != null) {
                const restanteMs = Math.max(0, this.tiempoLimiteMs - transcurridoMs);
                const restanteSec = Math.floor(restanteMs / 1000);
                const minutos = Math.floor(restanteSec / 60);
                const segundos = restanteSec % 60;
                document.getElementById('tiempoTranscurrido').textContent =
                    `Tiempo restante: ${minutos}:${segundos.toString().padStart(2, '0')}`;

                if (restanteMs <= 0 && !this.bloqueadoPorTiempo) {
                    this.bloqueadoPorTiempo = true;
                    this.detenerTiempo();
                    alert('Se acabó el tiempo. El examen se finalizará automáticamente.');
                    this.mostrarResultados();
                }
                return;
            }

            const tiempoTranscurrido = Math.floor(transcurridoMs / 1000);
            const minutos = Math.floor(tiempoTranscurrido / 60);
            const segundos = tiempoTranscurrido % 60;
            document.getElementById('tiempoTranscurrido').textContent =
                `Tiempo: ${minutos}:${segundos.toString().padStart(2, '0')}`;
        }, 1000);
    }

    detenerTiempo() {
        if (this.timerId != null) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }
}

let app;

// Mostrar total de preguntas en el encabezado
function mostrarTotalPreguntas() {
    const totalElement = document.getElementById('totalPreguntasInfo');
    if (totalElement && PREGUNTAS_COMPLETAS.length > 0) {
        totalElement.textContent = `Base: ${PREGUNTAS_COMPLETAS.length} ✓`;
    }
}

function actualizarContadorFallos() {
    const contador = gestorFallos.contarFallos();
    document.getElementById('contadorFallos').textContent = contador;
    document.getElementById('badgeFallos').textContent = contador;
    
    const btnTestFallos = document.getElementById('btnTestFallos');
    const btnLimpiarFallos = document.getElementById('btnLimpiarFallos');
    
    if (contador > 0) {
        btnTestFallos.disabled = false;
        if (btnLimpiarFallos) btnLimpiarFallos.disabled = false;
    } else {
        btnTestFallos.disabled = true;
        if (btnLimpiarFallos) btnLimpiarFallos.disabled = true;
    }
}

function limpiarFallos() {
    if (gestorFallos.contarFallos() === 0) {
        return;
    }
    
    if (confirm('¿Estás seguro de que quieres eliminar todas las preguntas falladas guardadas?')) {
        gestorFallos.limpiarFallos();
        actualizarContadorFallos();
        alert('Preguntas falladas eliminadas correctamente');
    }
}

function actualizarConfigUI() {
    const ordenarPorTema = configuracion.get('ordenarPorTema');
    const toggle = document.getElementById('toggleOrdenTema');
    
    if (ordenarPorTema) {
        toggle.classList.add('active');
    } else {
        toggle.classList.remove('active');
    }
}

// Funciones globales para configuración
function toggleConfig(clave) {
    const nuevoValor = configuracion.toggle(clave);
    actualizarConfigUI();
}

// Importar/Exportar fallos
function exportarFallos() {
  try {
    const perfilActual = configuracion.get('perfilActual') || 'default';
    const perfiles = configuracion.get('perfiles') || {};
    const nombrePerfil = perfilActual === 'default' ? 'Principal' : (perfiles[perfilActual]?.nombre || perfilActual);
    
    const datosExportar = {
      perfil: perfilActual,
      nombrePerfil: nombrePerfil,
      fallos: gestorFallos.obtenerFallos(),
      fecha: new Date().toISOString()
    };
    
    const datos = JSON.stringify(datosExportar, null, 2);
    const blob = new Blob([datos], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fallos_${nombrePerfil}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert(`Fallos exportados correctamente (Perfil: ${nombrePerfil})`);
  } catch (e) {
    alert('No se pudo exportar los fallos');
  }
}

function importarFallosDesdeArchivo(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const datos = JSON.parse(reader.result);
      
      // Verificar formato nuevo (con perfil)
      if (datos.fallos && Array.isArray(datos.fallos)) {
        const mensaje = `¿Importar ${datos.fallos.length} fallos del perfil "${datos.nombrePerfil || 'Desconocido'}"?\n\nEsto reemplazará los fallos actuales del perfil activo.`;
        if (!confirm(mensaje)) return;
        
        gestorFallos.fallos = datos.fallos;
        gestorFallos.guardarFallos();
        actualizarContadorFallos();
        actualizarEstadisticasPerfil();
        alert('Fallos importados correctamente');
      } 
      // Formato antiguo (array directo)
      else if (Array.isArray(datos)) {
        if (!confirm(`¿Importar ${datos.length} fallos?\nEsto reemplazará los fallos actuales del perfil activo.`)) return;
        
        gestorFallos.fallos = datos;
        gestorFallos.guardarFallos();
        actualizarContadorFallos();
        actualizarEstadisticasPerfil();
        alert('Fallos importados correctamente');
      } 
      else {
        throw new Error('Formato inválido');
      }
    } catch (e) {
      alert('Error al importar JSON de fallos: ' + e.message);
    }
  };
  reader.readAsText(file);
}

function toggleTema(numeroTema) {
    let temasSeleccionados = configuracion.get('temasSeleccionados') || [1, 2, 3, 4, 5];
    
    if (temasSeleccionados.includes(numeroTema)) {
        // Si ya está seleccionado, quitarlo
        temasSeleccionados = temasSeleccionados.filter(t => t !== numeroTema);
        // Asegurar que al menos un tema quede seleccionado
        if (temasSeleccionados.length === 0) {
            alert('Debes seleccionar al menos un tema');
            // Restaurar el checkbox
            const checkbox = document.querySelector(`input[type="checkbox"][value="${numeroTema}"]`);
            if (checkbox) checkbox.checked = true;
            return;
        }
    } else {
        // Si no está seleccionado, agregarlo
        temasSeleccionados.push(numeroTema);
        temasSeleccionados.sort((a, b) => a - b);
    }
    
    configuracion.set('temasSeleccionados', temasSeleccionados);
    actualizarDistribucion();
}

function actualizarDistribucion() {
    const temasSeleccionados = configuracion.get('temasSeleccionados') || [1, 2, 3, 4, 5, 6];
    const totalPreguntas = 25;
    const numTemas = temasSeleccionados.length;
    const preguntasPorTema = Math.floor(totalPreguntas / numTemas);
    const preguntasExtras = totalPreguntas % numTemas;

    let texto = `📊 Distribución: `;
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
}

function actualizarTemasUI() {
    const temasSeleccionados = configuracion.get('temasSeleccionados') || [1, 2, 3, 4, 5, 6];
    
    for (let i = 1; i <= 6; i++) {
        const checkbox = document.querySelector(`input[type="checkbox"][value="${i}"]`);
        if (checkbox) {
            checkbox.checked = temasSeleccionados.includes(i);
        }
    }
    
    actualizarDistribucion();
}

function iniciarModo(modo) {
    if (app && app.detenerTiempo) {
        app.detenerTiempo();
    }

    document.getElementById('seleccionModo').classList.add('oculto');
    document.getElementById('resultados').classList.add('oculto');
    document.getElementById('examen').classList.remove('oculto');
    
    let textoModo = 'Práctica';
    if (modo === 'examen') textoModo = 'Examen';
    else if (modo === 'fallos') textoModo = 'Test de Fallos';
    
    document.getElementById('modoActual').textContent = textoModo;

    app = new SimuladorExamen(modo);
}

// ========== GESTIÓN DE PERFILES DE USUARIO ==========

function cargarPerfiles() {
    const select = document.getElementById('perfilSelect');
    if (!select) return;
    
    const perfilActual = configuracion.get('perfilActual') || 'default';
    const perfiles = configuracion.get('perfiles') || {};
    
    // Limpiar opciones
    select.innerHTML = '<option value="default">Usuario Principal</option>';
    
    // Agregar perfiles personalizados
    Object.keys(perfiles).forEach(id => {
        if (id !== 'default') {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = perfiles[id].nombre || id;
            select.appendChild(option);
        }
    });
    
    // Seleccionar el perfil actual
    select.value = perfilActual;
    
    // Actualizar botón de eliminar
    const btnEliminar = document.getElementById('btnEliminar');
    if (btnEliminar) {
        btnEliminar.disabled = perfilActual === 'default';
        btnEliminar.style.opacity = perfilActual === 'default' ? '0.5' : '1';
    }
    
    actualizarEstadisticasPerfil();
}

function crearNuevoPerfil() {
    const nombre = prompt('Nombre del nuevo perfil:');
    if (!nombre || !nombre.trim()) return;
    
    const id = 'perfil_' + Date.now();
    const perfiles = configuracion.get('perfiles') || {};
    
    perfiles[id] = {
        nombre: nombre.trim(),
        fallos: [],
        fechaCreacion: new Date().toISOString()
    };
    
    configuracion.set('perfiles', perfiles);
    configuracion.set('perfilActual', id);
    
    // Cambiar al nuevo perfil
    gestorFallos.cambiarUsuario();
    gestorHistorial.cambiarUsuario();
    cargarPerfiles();
    actualizarContadorFallos();
}

function cambiarPerfil() {
    const select = document.getElementById('perfilSelect');
    if (!select) return;
    
    const nuevoPerfil = select.value;
    configuracion.set('perfilActual', nuevoPerfil);
    
    // Recargar los fallos del nuevo perfil
    gestorFallos.cambiarUsuario();
    gestorHistorial.cambiarUsuario();
    cargarPerfiles();
    actualizarContadorFallos();
}

function eliminarPerfilActual() {
    const perfilActual = configuracion.get('perfilActual');
    if (perfilActual === 'default') {
        alert('No puedes eliminar el perfil principal');
        return;
    }
    
    const perfiles = configuracion.get('perfiles') || {};
    const nombrePerfil = perfiles[perfilActual]?.nombre || perfilActual;
    
    if (!confirm(`¿Estás seguro de eliminar el perfil "${nombrePerfil}"?\nEsto borrará todos los fallos registrados en este perfil.`)) {
        return;
    }
    
    // Eliminar el perfil
    delete perfiles[perfilActual];
    configuracion.set('perfiles', perfiles);
    
    // Volver al perfil default
    configuracion.set('perfilActual', 'default');
    gestorFallos.cambiarUsuario();
    gestorHistorial.cambiarUsuario();
    cargarPerfiles();
    actualizarContadorFallos();
}

function actualizarEstadisticasPerfil() {
    const statsDiv = document.getElementById('perfilStats');
    if (!statsDiv) return;
    
    const perfilActual = configuracion.get('perfilActual');
    const perfiles = configuracion.get('perfiles') || {};
    const totalFallos = gestorFallos.obtenerFallos().length;
    
    let texto = `📊 Fallos registrados: ${totalFallos}`;
    
    if (perfilActual !== 'default' && perfiles[perfilActual]) {
        const perfil = perfiles[perfilActual];
        const fecha = new Date(perfil.fechaCreacion).toLocaleDateString();
        texto += ` | Creado: ${fecha}`;
    }
    
    statsDiv.textContent = texto;
}

window.addEventListener('DOMContentLoaded', async () => {
    // Primero cargar las preguntas desde GitHub
    const cargaExitosa = await cargarPreguntasDesdeJSON();
    
    if (!cargaExitosa) {
        console.error('No se pudieron cargar las preguntas');
        return;
    }
    
    // Una vez cargadas las preguntas, inicializar la aplicación
    document.getElementById('examen').classList.add('oculto');
    document.getElementById('resultados').classList.add('oculto');
    document.getElementById('seleccionModo').classList.remove('oculto');
    document.getElementById('modoActual').textContent = '-';
    document.getElementById('tiempoTranscurrido').textContent = 'Tiempo: 0:00';
    
    mostrarTotalPreguntas();
    cargarPerfiles();
    actualizarContadorFallos();
    actualizarConfigUI();
    actualizarTemasUI();
});


