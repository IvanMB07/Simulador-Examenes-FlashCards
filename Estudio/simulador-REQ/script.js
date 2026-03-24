// TODAS LAS PREGUNTAS (cargadas desde JSON)
let PREGUNTAS_COMPLETAS = [];

// URL de respaldo del archivo JSON en GitHub (RAW)
const URL_PREGUNTAS = 'https://raw.githubusercontent.com/IvanMB07/Simulador-Examenes-FlashCards/main/Estudio/simulador-REQ/preguntas.json';

function getArchivoPreguntasDesdeURL() {
    const params = new URLSearchParams(window.location.search);
    const archivo = (params.get('archivo') || '').trim();
    if (!archivo) return './preguntas.json';

    // Evita rutas externas o navegación de directorios.
    if (!/^[a-zA-Z0-9._-]+\.json$/.test(archivo)) {
        console.warn('Archivo de preguntas inválido en URL, usando preguntas.json');
        return './preguntas.json';
    }

    return `./${archivo}`;
}

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
    const archivoLocal = getArchivoPreguntasDesdeURL();
    const fuentes = [
        { nombre: 'local', url: archivoLocal },
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
// Formato oficial: 30 preguntas, 60 minutos
const TOTAL_PREGUNTAS_EXAMEN = 30;
const TIEMPO_EXAMEN_MINUTOS = 60;
const PENALIZACION_ERROR = 1 / 3;
const PARCIALES_EXAMEN = {
    parcial1: [1, 2, 3, 4, 5],
    parcial2: [6],
};

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
                parcialExamen: 'parcial1',
                perfilActual: 'default',
                perfiles: {}
            };
            // Asegurar que existan las nuevas propiedades
            if (!this.config.perfilActual) this.config.perfilActual = 'default';
            if (!this.config.perfiles) this.config.perfiles = {};
            if (!this.config.parcialExamen) this.config.parcialExamen = 'parcial1';
        } catch (e) {
            this.config = {
                ordenarPorTema: false,
                temasSeleccionados: [1, 2, 3, 4, 5, 6],
                parcialExamen: 'parcial1',
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
        this.practicaBloqueadas = new Set();
        this.sinResponder = new Set();
        this.tiempoInicio = Date.now();
        this.tiempoLimiteMs = this.modo === 'examen' ? TIEMPO_EXAMEN_MINUTOS * 60 * 1000 : null;
        this.timerId = null;
        this.bloqueadoPorTiempo = false;
        this.erroresDelTest = [];
        this.keyboardHandler = null;
        this.opcionEnfocada = 0;
        this.focoActivo = false;
        this.ultimoIntentoTerminar = 0;
        this.toastTimer = null;
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
            this.preguntas = this.seleccionarPreguntasExamen();
            if (!this.preguntas || this.preguntas.length < TOTAL_PREGUNTAS_EXAMEN) {
                alert('No hay suficientes preguntas para generar este parcial de examen.');
                this.reiniciar();
                return;
            }
        } else if (this.modo === 'fallos') {
            this.preguntas = gestorFallos.obtenerFallos();
            if (this.preguntas.length === 0) {
                alert('No hay preguntas falladas guardadas');
                this.reiniciar();
                return;
            }
        } else {
            const ordenarPorTema = configuracion.get('ordenarPorTema');
            const temasParcial = this.obtenerTemasExamen();
            const temasSeleccionados = configuracion.get('temasSeleccionados') || [...temasParcial];
            const temasAplicables = temasSeleccionados.filter(tema => temasParcial.includes(tema));
            const temasPractica = temasAplicables.length > 0 ? temasAplicables : [...temasParcial];

            this.preguntas = this.seleccionarPreguntasPractica(temasPractica, ordenarPorTema);
            if (!this.preguntas || this.preguntas.length === 0) {
                alert('No hay preguntas disponibles para el parcial seleccionado.');
                this.reiniciar();
                return;
            }
        }
        this.respuestas = {};
        this.practicaBloqueadas = new Set();
        this.sinResponder = new Set();
        this.preguntaActual = 0;
        this.tiempoInicio = Date.now();
        this.mostrarPregunta();
        this.iniciarTiempo();
        this.iniciarNavegacionTeclado();
    }

    iniciarNavegacionTeclado() {
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }

        this.keyboardHandler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.anterior();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
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
        this.focoActivo = true;
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

        this.opcionEnfocada = indice;
        this.responderPregunta(indice);
    }

    seleccionarPreguntasPractica(temasSeleccionados, ordenarPorTema = false) {
        const pool = PREGUNTAS_COMPLETAS.filter(p => !this.esGaitero(p));
        const totalPreguntas = 25;
        const poolTemasSeleccionados = pool.filter(p => temasSeleccionados.includes(this.extraerTema(p)));

        const grupos = new Map();
        for (const pregunta of pool) {
            const tema = this.extraerTema(pregunta);
            if (tema === null) continue;
            if (!grupos.has(tema)) grupos.set(tema, []);
            grupos.get(tema).push(pregunta);
        }

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
        return function () {
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
            const baseA = a.preguntaBaseDependencia === true ? 1 : 0;
            const baseB = b.preguntaBaseDependencia === true ? 1 : 0;
            if (baseA !== baseB) return baseB - baseA;

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
        const match = pregunta.cuestion.match(/T([1-6])-/i);
        if (match && match[1]) {
            return parseInt(match[1]);
        }
        return null;
    }

    esPreguntaConTabla(pregunta) {
        return typeof pregunta?.cuestion === 'string' && /\n[^\n]*\|[^\n]*/.test(pregunta.cuestion);
    }

    esTablaTema3(pregunta) {
        return this.extraerTema(pregunta) === 3 && this.esPreguntaConTabla(pregunta);
    }

    esPracticaTema4(pregunta) {
        if (this.extraerTema(pregunta) !== 4 || typeof pregunta?.cuestion !== 'string') {
            return false;
        }

        const texto = pregunta.cuestion.toLowerCase();
        const tieneNumeros = /\d/.test(texto);
        const patronesPracticos = [
            'calcula', 'cálculo', 'indice', 'índice', 'variación', 'valor ganado',
            'cpi', 'spi', 'ev', 'ac', 'pv', 'eac', 'bac'
        ];

        return tieneNumeros || patronesPracticos.some(patron => texto.includes(patron));
    }

    obtenerTemasExamen() {
        const parcial = configuracion.get('parcialExamen') || 'parcial1';
        return PARCIALES_EXAMEN[parcial] || PARCIALES_EXAMEN.parcial1;
    }

    seleccionarTema3ConUnaTabla(preguntasTema3, cantidad) {
        if (cantidad <= 0) return [];

        const tablas = preguntasTema3.filter(p => this.esTablaTema3(p));
        const sinTabla = preguntasTema3.filter(p => !this.esTablaTema3(p));

        let seleccion = [];
        let grupoDependenciaPermitido = null;

        if (tablas.length > 0) {
            const tablasConGrupo = tablas.filter(p => this.obtenerGrupoDependencia(p));
            const candidatasTabla = tablasConGrupo.length > 0 ? tablasConGrupo : tablas;
            const tablaElegida = this.sample(candidatasTabla, 1)[0];
            seleccion.push(tablaElegida);
            grupoDependenciaPermitido = this.obtenerGrupoDependencia(tablaElegida);
        }

        const sinTablaPermitidas = sinTabla.filter(p => {
            const grupo = this.obtenerGrupoDependencia(p);
            if (!grupo) return true;
            return grupoDependenciaPermitido != null && grupo === grupoDependenciaPermitido;
        });

        const faltan = Math.max(0, cantidad - seleccion.length);
        seleccion.push(...this.sample(sinTablaPermitidas, faltan));

        return seleccion.slice(0, cantidad);
    }

    seleccionarTema4ConUnaPractica(preguntasTema4, cantidad) {
        if (cantidad <= 0) return [];

        const practicas = preguntasTema4.filter(p => this.esPracticaTema4(p));
        const noPracticas = preguntasTema4.filter(p => !this.esPracticaTema4(p));

        const seleccion = [];
        if (practicas.length > 0) {
            seleccion.push(this.sample(practicas, 1)[0]);
        }

        const restantes = [...noPracticas, ...practicas.filter(p => !seleccion.some(s => s.cuestion === p.cuestion))];
        const faltan = Math.max(0, cantidad - seleccion.length);
        seleccion.push(...this.sample(restantes, faltan));

        return seleccion.slice(0, cantidad);
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

        const noVistas = [];
        const vistasAntiguas = [];
        const vistasRecientes = [];

        const umbralReciente = 50;

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

        const seleccion = [];

        const deNoVistas = Math.min(noVistas.length, n);
        seleccion.push(...this.barajar(noVistas).slice(0, deNoVistas));

        if (seleccion.length < n && vistasAntiguas.length > 0) {
            const faltan = n - seleccion.length;
            const deAntiguas = Math.min(vistasAntiguas.length, faltan);
            seleccion.push(...this.barajar(vistasAntiguas).slice(0, deAntiguas));
        }

        if (seleccion.length < n && vistasRecientes.length > 0) {
            const faltan = n - seleccion.length;
            vistasRecientes.sort((a, b) =>
                gestorHistorial.obtenerPrioridad(b) - gestorHistorial.obtenerPrioridad(a)
            );
            seleccion.push(...vistasRecientes.slice(0, faltan));
        }

        return this.barajar(seleccion).slice(0, n);
    }

    seleccionarPreguntasExamen() {
        const pool = PREGUNTAS_COMPLETAS.filter(p => !this.esGaitero(p));
        const temasExamen = this.obtenerTemasExamen();
        const poolParcial = pool.filter(p => temasExamen.includes(this.extraerTema(p)));

        if (poolParcial.length < TOTAL_PREGUNTAS_EXAMEN) {
            return [];
        }

        const grupos = new Map();
        for (const pregunta of poolParcial) {
            const tema = this.extraerTema(pregunta);
            if (tema === null) continue;
            if (!grupos.has(tema)) grupos.set(tema, []);
            grupos.get(tema).push(pregunta);
        }

        const seleccion = [];
        const seleccionSet = new Set();

        const preguntasPorTemaBase = Math.floor(TOTAL_PREGUNTAS_EXAMEN / temasExamen.length);
        const extras = TOTAL_PREGUNTAS_EXAMEN % temasExamen.length;

        temasExamen.forEach((tema, indiceTema) => {
            const preguntasTema = grupos.get(tema) ?? [];
            const cuotaTema = preguntasPorTemaBase + (indiceTema < extras ? 1 : 0);

            let elegidas = [];
            elegidas = this.sample(preguntasTema, cuotaTema);

            for (const p of elegidas) {
                seleccion.push(p);
                seleccionSet.add(p.cuestion);
            }
        });

        if (seleccion.length < TOTAL_PREGUNTAS_EXAMEN) {
            const restantes = poolParcial.filter(p => {
                if (seleccionSet.has(p.cuestion)) return false;
                return true;
            });
            const faltan = TOTAL_PREGUNTAS_EXAMEN - seleccion.length;
            seleccion.push(...this.sample(restantes, faltan));
        }

        const seleccionNormalizada = this.normalizarSeleccionConDependencias(
            seleccion,
            TOTAL_PREGUNTAS_EXAMEN,
            poolParcial.length > 0 ? poolParcial : pool
        );

        const final = this.barajarRespetandoDependencias(seleccionNormalizada).slice(0, TOTAL_PREGUNTAS_EXAMEN);
        return final;
    }

    mostrarPregunta() {
        const pregunta = this.preguntas[this.preguntaActual];

        this.opcionEnfocada = 0;
        this.focoActivo = false;

        if (this.modo === 'examen') {
            const bloque = Math.floor(this.preguntaActual / 10) + 1;
            const totalBloques = Math.ceil(this.preguntas.length / 10);
            const enBloque = (this.preguntaActual % 10) + 1;
            const seleccionActual = this.normalizarSeleccion(this.respuestas[this.preguntaActual] || []);
            const indicadorNoResponder = seleccionActual.length === 0 ? ' ⭕' : '';
            document.getElementById('preguntaNumero').textContent =
                `Bloque ${bloque}/${totalBloques} — Pregunta ${enBloque}/10 (global ${this.preguntaActual + 1}/${this.preguntas.length})${indicadorNoResponder}`;
        } else {
            document.getElementById('preguntaNumero').textContent =
                `Pregunta ${this.preguntaActual + 1} de ${this.preguntas.length}`;
        }
        const preguntaTextoEl = document.getElementById('preguntaTexto');
        this.renderizarPreguntaTexto(preguntaTextoEl, pregunta.cuestion);

        let avisoRespuestaMultiple = document.getElementById('avisoRespuestaMultiple');
        if (!avisoRespuestaMultiple) {
            avisoRespuestaMultiple = document.createElement('div');
            avisoRespuestaMultiple.id = 'avisoRespuestaMultiple';
            avisoRespuestaMultiple.className = 'aviso-respuesta-multiple';
            preguntaTextoEl.insertAdjacentElement('afterend', avisoRespuestaMultiple);
        }

        const esMultiple = this.esPreguntaMultiple(pregunta);
        avisoRespuestaMultiple.style.display = esMultiple ? 'block' : 'none';
        avisoRespuestaMultiple.textContent = '(Respuesta múltiple)';

        const contenedor = document.getElementById('opcionesContenedor');
        contenedor.innerHTML = '';
        const seleccionActual = this.normalizarSeleccion(this.respuestas[this.preguntaActual] || []);
        const bloqueadaEnPractica = this.modo === 'practica' && this.practicaBloqueadas.has(this.preguntaActual);

        pregunta.opciones.forEach((opcion, indice) => {
            const boton = document.createElement('button');
            boton.className = 'opcion';

            const numeroTecla = document.createElement('span');
            numeroTecla.style.cssText = 'display: inline-block; background: #3a3a3a; padding: 2px 6px; border-radius: 3px; margin-right: 8px; font-size: 11px; color: #00d4ff;';
            numeroTecla.textContent = (indice + 1);

            const textoOpcion = document.createElement('span');
            textoOpcion.textContent = opcion;

            boton.appendChild(numeroTecla);
            boton.appendChild(textoOpcion);

            if (seleccionActual.includes(indice)) {
                boton.classList.add('seleccionada');
            }

            if (bloqueadaEnPractica) {
                boton.disabled = true;
                boton.style.cursor = 'not-allowed';
                boton.style.opacity = '0.85';
            } else {
                boton.onclick = () => this.responderPregunta(indice);
            }

            contenedor.appendChild(boton);
        });

        const btnAnterior = document.getElementById('btnAnterior');
        const btnSiguiente = document.getElementById('btnSiguiente');
        const btnComprobarPractica = document.getElementById('btnComprobarPractica');

        if (this.modo === 'examen') {
            btnAnterior.classList.remove('oculto');
            btnAnterior.disabled = this.preguntaActual === 0;
        } else {
            btnAnterior.classList.remove('oculto');
            btnAnterior.disabled = this.preguntaActual === 0;
        }

        btnSiguiente.disabled = this.preguntaActual >= this.preguntas.length - 1;

        if (btnComprobarPractica) {
            if (this.modo !== 'practica') {
                btnComprobarPractica.classList.add('oculto');
            } else {
                const mostrarComprobar = esMultiple && !bloqueadaEnPractica;
                btnComprobarPractica.classList.toggle('oculto', !mostrarComprobar);
                btnComprobarPractica.disabled = !mostrarComprobar || seleccionActual.length === 0;
            }
        }

        const progreso = ((this.preguntaActual + 1) / this.preguntas.length) * 100;
        document.getElementById('progresoBarra').style.width = progreso + '%';
        document.getElementById('numeroPregunta').textContent = this.preguntaActual + 1;
        const totalPreguntasActual = document.getElementById('totalPreguntasActual');
        if (totalPreguntasActual) totalPreguntasActual.textContent = this.preguntas.length;

        if (this.modo === 'practica' && this.practicaBloqueadas.has(this.preguntaActual)) {
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

    obtenerIndicesCorrectos(pregunta) {
        const solucion = (pregunta.solucion || '').toString().toUpperCase();
        const letras = [...new Set(solucion.replace(/[^A-Z]/g, '').split('').filter(Boolean))];

        const indices = [];
        for (const letra of letras) {
            const objetivo = `${letra}.`;
            const indice = pregunta.opciones.findIndex(op => {
                const opcion = op.trim();
                return opcion.startsWith(objetivo) || opcion.charAt(0).toUpperCase() === letra;
            });
            if (indice >= 0) indices.push(indice);
        }
        return [...new Set(indices)].sort((a, b) => a - b);
    }

    normalizarSeleccion(respuesta) {
        if (!Array.isArray(respuesta)) return [];
        return [...new Set(respuesta)].sort((a, b) => a - b);
    }

    preguntaRespondida(indicePregunta) {
        const seleccion = this.normalizarSeleccion(this.respuestas[indicePregunta] || []);
        return seleccion.length > 0;
    }

    contarRespondidas() {
        let total = 0;
        for (let i = 0; i < this.preguntas.length; i++) {
            if (this.preguntaRespondida(i)) total++;
        }
        return total;
    }

    esRespuestaCorrecta(pregunta, respuestaSeleccionada) {
        const correctos = this.obtenerIndicesCorrectos(pregunta);
        const seleccionados = this.normalizarSeleccion(respuestaSeleccionada);

        if (correctos.length !== seleccionados.length) return false;
        for (let i = 0; i < correctos.length; i++) {
            if (correctos[i] !== seleccionados[i]) return false;
        }
        return true;
    }

    esPreguntaMultiple(pregunta) {
        return this.obtenerIndicesCorrectos(pregunta).length > 1;
    }

    aplicarFeedback() {
        const pregunta = this.preguntas[this.preguntaActual];
        const correctos = new Set(this.obtenerIndicesCorrectos(pregunta));
        const elegidos = new Set(this.normalizarSeleccion(this.respuestas[this.preguntaActual] || []));

        const botones = document.querySelectorAll('#opcionesContenedor .opcion');
        botones.forEach((boton, indice) => {
            boton.classList.remove('correcta', 'incorrecta');
            if (correctos.has(indice)) {
                boton.classList.add('correcta');
            }
            if (elegidos.has(indice) && !correctos.has(indice)) {
                boton.classList.add('incorrecta');
            }
        });
    }

    responderPregunta(indice) {
        const pregunta = this.preguntas[this.preguntaActual];
        if (this.modo === 'practica' && this.practicaBloqueadas.has(this.preguntaActual)) {
            return;
        }

        const seleccionActual = this.normalizarSeleccion(this.respuestas[this.preguntaActual] || []);
        const esMultiple = this.esPreguntaMultiple(pregunta);

        if (!esMultiple) {
            if (this.modo === 'practica') {
                this.respuestas[this.preguntaActual] = [indice];
                this.practicaBloqueadas.add(this.preguntaActual);
            } else {
                if (seleccionActual.length === 1 && seleccionActual[0] === indice) {
                    this.respuestas[this.preguntaActual] = [];
                } else {
                    this.respuestas[this.preguntaActual] = [indice];
                }
            }
        } else {
            if (seleccionActual.includes(indice)) {
                this.respuestas[this.preguntaActual] = seleccionActual.filter(i => i !== indice);
            } else {
                this.respuestas[this.preguntaActual] = [...seleccionActual, indice].sort((a, b) => a - b);
            }
        }

        this.mostrarPregunta();
    }

    comprobarRespuestaPractica() {
        if (this.modo !== 'practica') return;

        const pregunta = this.preguntas[this.preguntaActual];
        if (!this.esPreguntaMultiple(pregunta)) return;

        const seleccion = this.normalizarSeleccion(this.respuestas[this.preguntaActual] || []);
        if (seleccion.length === 0) {
            alert('Selecciona al menos una opción antes de comprobar.');
            return;
        }

        const aciertoTotal = this.esRespuestaCorrecta(pregunta, seleccion);
        if (!aciertoTotal) {
            this.practicaBloqueadas.add(this.preguntaActual);
            this.mostrarPregunta();
            return;
        }

        this.practicaBloqueadas.add(this.preguntaActual);
        this.mostrarPregunta();
    }

    siguiente() {
        if (this.preguntaActual < this.preguntas.length - 1) {
            this.preguntaActual++;
            this.mostrarPregunta();
        }
    }

    anterior() {
        if (this.preguntaActual > 0) {
            this.preguntaActual--;
            this.mostrarPregunta();
        }
    }

    terminar() {
        if (this.bloqueadoPorTiempo) {
            this.mostrarResultados();
            return;
        }
        const contestadas = this.contarRespondidas();
        const sinResponder = this.preguntas.length - contestadas;

        const mensaje = sinResponder > 0
            ? `¿Seguro que quieres terminar el examen?\n\nTe quedan ${sinResponder} preguntas sin responder.`
            : '¿Seguro que quieres terminar el examen?';

        if (this.debeUsarConfirmacionMovil()) {
            if (!this.confirmarConDobleToque(sinResponder)) {
                return;
            }
        } else {
            if (!confirm(mensaje)) {
                return;
            }
        }

        this.mostrarResultados();
    }

    debeUsarConfirmacionMovil() {
        const tactil = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
        const ua = navigator.userAgent || '';
        const movil = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
        return tactil || movil;
    }

    confirmarConDobleToque(sinResponder) {
        const ahora = Date.now();
        const ventanaMs = 3500;

        if (ahora - this.ultimoIntentoTerminar <= ventanaMs) {
            this.ultimoIntentoTerminar = 0;
            this.ocultarToastConfirmacion();
            return true;
        }

        this.ultimoIntentoTerminar = ahora;
        const pendiente = sinResponder > 0
            ? `Quedan ${sinResponder} sin responder. `
            : '';
        this.mostrarToastConfirmacion(`${pendiente}Pulsa "Terminar Examen" otra vez para confirmar.`);
        return false;
    }

    mostrarToastConfirmacion(mensaje) {
        let toast = document.getElementById('toastConfirmacionFinalizar');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toastConfirmacionFinalizar';
            toast.className = 'toast-confirmacion';
            document.body.appendChild(toast);
        }

        toast.textContent = mensaje;
        toast.classList.add('visible');

        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
        }

        this.toastTimer = setTimeout(() => {
            this.ultimoIntentoTerminar = 0;
            this.ocultarToastConfirmacion();
        }, 3500);
    }

    ocultarToastConfirmacion() {
        const toast = document.getElementById('toastConfirmacionFinalizar');
        if (toast) {
            toast.classList.remove('visible');
        }

        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
            this.toastTimer = null;
        }
    }

    mostrarResultados() {
        let correctas = 0;
        this.erroresDelTest = [];

        this.preguntas.forEach((pregunta, indice) => {
            const seleccion = this.normalizarSeleccion(this.respuestas[indice] || []);
            const tieneRespuesta = seleccion.length > 0;

            if (tieneRespuesta) {
                const esCorrecta = this.esRespuestaCorrecta(pregunta, seleccion);

                if (esCorrecta) {
                    correctas++;
                } else {
                    const indicesCorrectos = this.obtenerIndicesCorrectos(pregunta);
                    const respuestaUsuario = seleccion.map(i => pregunta.opciones[i]).join(' | ');
                    const respuestaCorrecta = indicesCorrectos.map(i => pregunta.opciones[i]).join(' | ');
                    this.erroresDelTest.push({
                        pregunta: pregunta.cuestion,
                        respuestaUsuario: respuestaUsuario || '(No respondida)',
                        respuestaCorrecta
                    });

                    gestorFallos.agregarFallo(
                        pregunta,
                        respuestaUsuario || '(No respondida)',
                        respuestaCorrecta
                    );
                }
            } else {
                const indicesCorrectos = this.obtenerIndicesCorrectos(pregunta);
                gestorFallos.agregarFallo(
                    pregunta,
                    '(No respondida)',
                    indicesCorrectos.map(i => pregunta.opciones[i]).join(' | ')
                );
            }
        });

        const respondidas = this.contarRespondidas();
        const incorrectas = respondidas - correctas;
        const sinResponder = this.preguntas.length - respondidas;

        const npv = this.preguntas.length;
        const notaBruta = correctas - (incorrectas * PENALIZACION_ERROR);
        const puntuacionFinal = npv > 0
            ? Math.max(0, Math.min(10, (notaBruta / npv) * 10))
            : 0;

        document.getElementById('respuestasCorrectas').textContent = correctas;
        document.getElementById('respuestasIncorrectas').textContent = incorrectas;
        document.getElementById('sinResponder').textContent = sinResponder;
        document.getElementById('puntuacionFinal').textContent = puntuacionFinal.toFixed(2) + '/10';

        this.mostrarDetalleErrores();

        document.getElementById('examen').classList.add('oculto');
        document.getElementById('resultados').classList.remove('oculto');
    }

    mostrarDetalleErrores() {
        const contenedor = document.getElementById('erroresDetalle');

        const preguntasNoRespondidas = [];
        this.preguntas.forEach((pregunta, indice) => {
            if (!this.preguntaRespondida(indice)) {
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

        if (preguntasNoRespondidas.length > 0) {
            if (this.erroresDelTest.length > 0) {
                html += '<hr style="border: none; border-top: 1px solid #3a3a3a; margin: 20px 0;">';
            }
            html += '<h3 style="color: #8b5cf6; margin-bottom: 15px; margin-top: 20px;">⭕ Preguntas No Respondidas</h3>';
            html += '<div style="font-size: 12px; color: #888; margin-bottom: 15px;">Se han agregado al test de fallos para que las repases</div>';

            preguntasNoRespondidas.forEach((item, index) => {
                const indicesCorrectos = this.obtenerIndicesCorrectos(this.preguntas[item.indice]);
                const respuestaCorrecta = indicesCorrectos.map(i => this.preguntas[item.indice].opciones[i]).join(' | ');
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
        this.ocultarToastConfirmacion();
        this.ultimoIntentoTerminar = 0;
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

function toggleConfig(clave) {
    const nuevoValor = configuracion.toggle(clave);
    actualizarConfigUI();
}

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

            if (datos.fallos && Array.isArray(datos.fallos)) {
                const mensaje = `¿Importar ${datos.fallos.length} fallos del perfil "${datos.nombrePerfil || 'Desconocido'}"?\n\nEsto reemplazará los fallos actuales del perfil activo.`;
                if (!confirm(mensaje)) return;

                gestorFallos.fallos = datos.fallos;
                gestorFallos.guardarFallos();
                actualizarContadorFallos();
                alert('Fallos importados correctamente');
            }
            else if (Array.isArray(datos)) {
                if (!confirm(`¿Importar ${datos.length} fallos?\nEsto reemplazará los fallos actuales del perfil activo.`)) return;

                gestorFallos.fallos = datos;
                gestorFallos.guardarFallos();
                actualizarContadorFallos();
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
    let temasSeleccionados = configuracion.get('temasSeleccionados') || [1, 2, 3, 4, 5, 6];

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

function cambiarParcialExamen() {
    const select = document.getElementById('parcialExamenSelect');
    if (!select) return;
    configuracion.set('parcialExamen', select.value);
    actualizarTemasUI();
}

function actualizarParcialExamenUI() {
    const select = document.getElementById('parcialExamenSelect');
    if (!select) return;
    select.value = configuracion.get('parcialExamen') || 'parcial1';
}

function actualizarTemasUI() {
    const parcial = configuracion.get('parcialExamen') || 'parcial1';
    const temasParcial = PARCIALES_EXAMEN[parcial] || PARCIALES_EXAMEN.parcial1;
    const temasSeleccionados = configuracion.get('temasSeleccionados') || [...temasParcial];
    let temasCompatibles = temasSeleccionados.filter(tema => temasParcial.includes(tema));

    if (temasCompatibles.length === 0) {
        temasCompatibles = [...temasParcial];
        configuracion.set('temasSeleccionados', temasCompatibles);
    }

    for (let i = 1; i <= 6; i++) {
        const checkbox = document.querySelector(`input[type="checkbox"][value="${i}"]`);
        if (checkbox) {
            const permitido = temasParcial.includes(i);
            checkbox.disabled = !permitido;
            checkbox.checked = permitido && temasCompatibles.includes(i);

            const etiqueta = checkbox.closest('.tema-checkbox');
            if (etiqueta) {
                etiqueta.style.opacity = permitido ? '1' : '0.45';
            }
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

function cargarPerfiles() {
    const select = document.getElementById('perfilSelect');
    if (!select) return;

    const perfilActual = configuracion.get('perfilActual') || 'default';
    const perfiles = configuracion.get('perfiles') || {};

    select.innerHTML = '<option value="default">Usuario Principal</option>';

    Object.keys(perfiles).forEach(id => {
        if (id !== 'default') {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = perfiles[id].nombre || id;
            select.appendChild(option);
        }
    });

    select.value = perfilActual;

    const btnEliminar = document.getElementById('btnEliminar');
    if (btnEliminar) {
        btnEliminar.disabled = perfilActual === 'default';
        btnEliminar.style.opacity = perfilActual === 'default' ? '0.5' : '1';
    }
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

    gestorFallos.cambiarUsuario();
    gestorHistorial.cambiarUsuario();
    cargarPerfiles();
}

function cambiarPerfil() {
    const select = document.getElementById('perfilSelect');
    if (!select) return;
    configuracion.set('perfilActual', select.value);
    gestorFallos.cambiarUsuario();
    gestorHistorial.cambiarUsuario();
    cargarPerfiles();
}

function eliminarPerfilActual() {
    const perfilActual = configuracion.get('perfilActual');
    if (perfilActual === 'default') return;

    if (!confirm('¿Estás seguro de que quieres eliminar este perfil?')) return;

    const perfiles = configuracion.get('perfiles') || {};
    delete perfiles[perfilActual];
    configuracion.set('perfiles', perfiles);
    configuracion.set('perfilActual', 'default');

    gestorFallos.cambiarUsuario();
    gestorHistorial.cambiarUsuario();
    cargarPerfiles();
    alert('Perfil eliminado correctamente');
}

function actualizarEstadisticasPerfil() {
    const perfilActual = configuracion.get('perfilActual') || 'default';
    const perfiles = configuracion.get('perfiles') || {};
    const perfilData = perfiles[perfilActual];
    const statsDiv = document.getElementById('perfilStats');

    if (!statsDiv) return;

    let texto = '';
    if (perfilActual === 'default') {
        texto = '👤 Usuario Principal';
    } else if (perfilData) {
        texto = `👤 ${perfilData.nombre}`;
        if (perfilData.fechaCreacion) {
            const fecha = new Date(perfilData.fechaCreacion).toLocaleDateString();
            texto += ` | Creado: ${fecha}`;
        }
    }

    statsDiv.textContent = texto;
}

window.addEventListener('DOMContentLoaded', async () => {
    const cargaExitosa = await cargarPreguntasDesdeJSON();

    if (!cargaExitosa) {
        console.error('No se pudieron cargar las preguntas');
        return;
    }

    document.getElementById('examen').classList.add('oculto');
    document.getElementById('resultados').classList.add('oculto');
    document.getElementById('seleccionModo').classList.remove('oculto');
    document.getElementById('modoActual').textContent = '-';
    document.getElementById('tiempoTranscurrido').textContent = 'Tiempo: 0:00';
    const totalPreguntasActual = document.getElementById('totalPreguntasActual');
    if (totalPreguntasActual) totalPreguntasActual.textContent = '25';

    mostrarTotalPreguntas();
    cargarPerfiles();
    actualizarContadorFallos();
    actualizarConfigUI();
    actualizarParcialExamenUI();
    actualizarTemasUI();
});
