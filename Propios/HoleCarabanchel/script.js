// ═══════════════════════════════════════════════════════════════
//  HOLE CARABANCHEL  ·  script.js
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
//  VISUALES EDITABLES DE OBJETOS
//  Si image está vacío el juego dibuja el emoji.
//  Para usar imágenes propias: image: 'img/caja.png'
// ─────────────────────────────────────────────
const COLLECTIBLE_VISUALS = {
    box: { label: 'cajas', emoji: '📦', image: '', color: '#ffbc48' },
    target: { label: 'dianas', emoji: '🎯', image: '', color: '#e8ff47' },
    diamond: { label: 'diamantes', emoji: '💎', image: '', color: '#7dff8a' },
    ball: { label: 'balones', emoji: '🏀', image: '', color: '#ff9a47' },
    crate: { label: 'cajas viejas', emoji: '🧱', image: '', color: '#c27bff' },
    ring: { label: 'anillos', emoji: '🌀', image: '', color: '#47c8ff' },
};

const DISTRACTOR_VISUALS = {
    bottle: { label: 'botellas', emoji: '🍶', image: '', color: '#9ac7ff' },
    cup: { label: 'vasos', emoji: '🥤', image: '', color: '#ff7fa2' },
    cone: { label: 'conos', emoji: '🔺', image: '', color: '#ffb84d' },
    coin: { label: 'monedas', emoji: '🪙', image: '', color: '#f4d35e' },
    leaf: { label: 'hojas', emoji: '🍃', image: '', color: '#78dca0' },
    star: { label: 'estrellas', emoji: '⭐', image: '', color: '#ffd86b' },
    knife: { label: 'cuchillos', emoji: '🔪', image: '', color: '#d9d3c7' },
};

const POWERDOWN_VISUAL = {
    key: 'mud',
    label: 'barro',
    emoji: '🟫',
    image: 'img/barro.png',
    color: '#8f5b3e',
};

const LETHAL_POWERDOWN_VISUAL = {
    key: 'syringe',
    label: 'jeringuilla',
    emoji: '💉',
    image: 'img/jeringa.png',
    color: '#f36f5b',
};

const TYPE_IMAGES = {
    growth: 'img/growth.png',
    speedup: 'img/speedup.png',
    freeze: 'img/freeze.png',
    citronela: 'img/citronela.png',
};

// ─────────────────────────────────────────────
//  CACHÉ DE IMÁGENES
// ─────────────────────────────────────────────
const imgCache = {};
function loadImage(src) {
    if (!src) return null;
    if (imgCache[src]) return imgCache[src];
    const img = new Image();
    img.src = src;
    imgCache[src] = img;
    return img;
}
function getCollectibleVisual(key) { return COLLECTIBLE_VISUALS[key] || COLLECTIBLE_VISUALS.box; }
function loadCollectibleImage(key) { return loadImage(getCollectibleVisual(key).image); }
function getDistractorVisual(key) { return DISTRACTOR_VISUALS[key] || DISTRACTOR_VISUALS.bottle; }
function loadDistractorImage(key) { return loadImage(getDistractorVisual(key).image); }
function getPowerdownVisual() { return POWERDOWN_VISUAL; }
function loadPowerdownImage() { return loadImage(POWERDOWN_VISUAL.image); }
function getLethalPowerdownVisual() { return LETHAL_POWERDOWN_VISUAL; }
function loadLethalPowerdownImage() { return loadImage(LETHAL_POWERDOWN_VISUAL.image); }

function randomBetween(min, max) { return min + Math.random() * (max - min); }

// ─────────────────────────────────────────────
//  RADIO BASE de cada tipo de objeto
//  (fracción del radio inicial del jugador)
//  Cuanto mayor, más grande el objeto ⟹ más difícil de absorber
// ─────────────────────────────────────────────
function getObjectRadius(role, key, playerStartRadius) {
    const ranges = role === 'distractor'
        ? {
            bottle: [0.36, 0.70],
            cup: [0.32, 0.56],
            cone: [0.44, 0.80],
            coin: [0.20, 0.36],
            leaf: [0.28, 0.56],
            star: [0.30, 0.52],
        }
        : {
            box: [0.40, 0.76],
            target: [0.44, 0.84],
            diamond: [0.56, 1.00],
            ball: [0.72, 1.24],
            crate: [0.90, 1.48],
            ring: [0.50, 0.96],
        };
    const [min, max] = ranges[key] || (role === 'distractor' ? [0.32, 0.72] : [0.42, 0.90]);
    return randomBetween(min, max) * playerStartRadius;
}

// ─────────────────────────────────────────────
//  REGLA DE ABSORCIÓN  ← BUG CORREGIDO
//
//  Un objeto solo puede ser absorbido cuando el radio del jugador
//  supera un múltiplo del radio BASE del objeto.
//  El umbral ABSORB_RATIO define cuánto más grande debe ser el agujero.
//
//  ABSORB_RATIO = 1.0  → el agujero debe ser exactamente igual de grande
//  ABSORB_RATIO = 1.2  → el agujero debe ser un 20% más grande que el objeto
//
//  Los power-ups (growth, speedup, freeze, citronela) se absorben siempre.
// ─────────────────────────────────────────────
const ABSORB_RATIO = 1.25; // jugador debe ser ≥ 1.25× el radio base del objeto

function canAbsorbObject(obj, playerRadius) {
    // Power-ups: siempre accesibles, no dependen del tamaño
    if (obj.type === 'growth' || obj.type === 'speedup' ||
        obj.type === 'freeze' || obj.type === 'citronela' ||
        obj.type === 'powerdown' || obj.type === 'powerdownLose') {
        return true;
    }
    // Coleccionables y señuelos: el jugador debe ser suficientemente grande
    return playerRadius >= obj.baseR * ABSORB_RATIO;
}

// Precarga imágenes
Object.values(COLLECTIBLE_VISUALS).forEach(v => loadImage(v.image));
Object.values(DISTRACTOR_VISUALS).forEach(v => loadImage(v.image));
loadPowerdownImage();
loadLethalPowerdownImage();
Object.values(TYPE_IMAGES).filter(Boolean).forEach(loadImage);


// ═══════════════════════════════════════════════
//  PERSISTENCIA
// ═══════════════════════════════════════════════
const SAVE_KEY = 'holeCarabanchel_v2';

function loadSave() {
    try {
        const d = JSON.parse(localStorage.getItem(SAVE_KEY));
        if (d) return d;
    } catch (e) { }
    return { maxLevel: 1, highScore: 0, audio: true, vibrate: true };
}
function writeSave(s) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { }
}
let save = loadSave();


// ═══════════════════════════════════════════════
//  CONFIGURACIÓN DE NIVELES
// ═══════════════════════════════════════════════
const TOTAL_LEVELS = 12;

function buildCollectibleObjectives(n) {
    const isChallenge = n % 5 === 0;
    const objectives = [
        { key: 'box', count: 5 + Math.floor((n - 1) / 3) },
        { key: 'target', count: 10 + Math.floor((n - 1) * 0.75) },
    ];
    if (n >= 4) objectives.push({ key: 'diamond', count: 2 + Math.floor((n - 4) / 4) });
    if (n >= 7) objectives.push({ key: 'ball', count: 2 + Math.floor((n - 7) / 3) });
    if (isChallenge) objectives.push({ key: 'ring', count: 1 + Math.floor(n / 5) });
    return objectives;
}

function getObjectiveTotal(objectives) {
    return objectives.reduce((t, o) => t + o.count, 0);
}

function formatObjectiveProgress(objectives, collectedByType = {}) {
    return objectives
        .map(o => {
            const visual = getCollectibleVisual(o.key);
            const collected = collectedByType[o.key] || 0;
            return `${visual.label} ${collected}/${o.count}`;
        })
        .join(' · ');
}

function areObjectivesComplete(objectives, collectedByType = {}) {
    return objectives.every(o => (collectedByType[o.key] || 0) >= o.count);
}

function getLevelConfig(n) {
    const isChallenge = n % 5 === 0;
    const objectives = buildCollectibleObjectives(n);
    return {
        level: n,
        quota: getObjectiveTotal(objectives),
        objectives,
        timeLimit: isChallenge ? Math.max(25, 65 - n * 2) : Math.max(35, 80 - n * 2),
        growthCount: Math.max(2, Math.round((3 + Math.floor(n / 2)) * perfProfile.objectMultiplier)),
        speedupCount: 2,
        freezeCount: 1 + (isChallenge ? 1 : 0),
        powerdownCount: 1 + Math.floor((n - 1) / 4) + (isChallenge ? 1 : 0),
        powerdownLoseCount: 1,
        citronelaCount: isChallenge ? 1 : 0,
        playerStartRadius: 22,
        growthPerObject: 2.2 + n * 0.25,
        isChallenge,
    };
}


// ═══════════════════════════════════════════════
//  AUDIO (Web Audio API)
// ═══════════════════════════════════════════════
let audioCtx = null;

function ensureAudio() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
    }
    if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => { });
}

function playTone(freq, type = 'sine', duration = 0.09, vol = 0.15) {
    if (!save.audio || !audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.55, audioCtx.currentTime + duration);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) { }
}

const playAbsorb = (big = false) => playTone(big ? 180 : 340, 'triangle', big ? 0.14 : 0.07, big ? 0.22 : 0.13);
const playPowerup = () => { playTone(520, 'square', 0.18, 0.18); setTimeout(() => playTone(780, 'square', 0.13, 0.13), 90); };
const playPowerdown = () => { playTone(140, 'sawtooth', 0.22, 0.18); setTimeout(() => playTone(90, 'sawtooth', 0.18, 0.14), 110); };
const playWin = () => [400, 520, 650, 800].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.2, 0.22), i * 110));
const playLose = () => [300, 220, 150].forEach((f, i) => setTimeout(() => playTone(f, 'sawtooth', 0.25, 0.18), i * 130));


// ═══════════════════════════════════════════════
//  VIBRACIÓN
// ═══════════════════════════════════════════════
function vibrate(pattern) {
    if (!save.vibrate) return;
    try { navigator.vibrate?.(pattern); } catch (e) { }
}


// ═══════════════════════════════════════════════
//  REFS DOM
// ═══════════════════════════════════════════════
const menuEl = document.getElementById('menu');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hudEl = document.getElementById('hud');
const hudQuotaVal = document.getElementById('hud-quota-val');
const hudScoreVal = document.getElementById('hud-score-val');
const hudTimeVal = document.getElementById('hud-time-val');
const hudTimeChip = document.getElementById('hud-time');
const hudAudioBtn = document.getElementById('hudAudio');
const hudPauseBtn = document.getElementById('hudPause');
const pauseOverlay = document.getElementById('pauseOverlay');
const endOverlay = document.getElementById('endOverlay');
const endTitle = document.getElementById('endTitle');
const endSub = document.getElementById('endSub');
const levelSelect = document.getElementById('levelSelect');
const menuHighScore = document.getElementById('menuHighScore');
const menuMaxLevel = document.getElementById('menuMaxLevel');
const btnPlay = document.getElementById('btnPlay');
const btnAudio = document.getElementById('btnAudio');
const btnVibrate = document.getElementById('btnVibrate');
const btnResume = document.getElementById('btnResume');
const btnPauseMenu = document.getElementById('btnPauseMenu');
const btnReplay = document.getElementById('btnReplay');
const btnEndMenu = document.getElementById('btnEndMenu');
const btnNextLevel = document.getElementById('btnNextLevel');
const powerupBar = document.getElementById('powerup-bar');


// ═══════════════════════════════════════════════
//  ESTADO DE JUEGO
// ═══════════════════════════════════════════════
let state = 'menu';
let cfg = null;
let player = null;
let objects = [];
let particles = [];
let score = 0;
let absorbed = 0;
let absorbedByType = {};
let pendingWin = false;
let timeLeft = 0;
let timerInterval = null;
let rafId = null;
let WORLD_W = 0;
let WORLD_H = 0;
let camX = 0;
let camY = 0;
let mouseX = 0;
let mouseY = 0;
let activePowerups = {};
let currentLevel = 1;
let lastTime = 0;

const gridCanvas = document.createElement('canvas');
const gridCtx = gridCanvas.getContext('2d');
const bgCanvas = document.createElement('canvas');
const bgCtx = bgCanvas.getContext('2d');
let gridDirty = true;
let bgDirty = true;
let floatCount = 0;
const MAX_FLOATS = 15;
const MAX_PARTICLES = 120;
let maxFloats = MAX_FLOATS;
let maxParticles = MAX_PARTICLES;
let cursorVisible = true;

const perfProfile = {
    isTouch: false,
    isMobileLike: false,
    lowQuality: false,
    objectMultiplier: 1,
    cameraLerp: 0.12,
    worldScale: 1.15,
    gridSize: 90,
    showBgGradient: true,
};

function updatePerfProfile() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    perfProfile.isTouch = coarse || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    perfProfile.isMobileLike = perfProfile.isTouch || Math.min(window.innerWidth, window.innerHeight) <= 900;
    perfProfile.lowQuality = perfProfile.isMobileLike;
    perfProfile.objectMultiplier = perfProfile.lowQuality ? 0.78 : 1;
    perfProfile.cameraLerp = perfProfile.lowQuality ? 0.18 : 0.12;
    perfProfile.worldScale = perfProfile.lowQuality ? 1.08 : 1.15;
    perfProfile.gridSize = perfProfile.lowQuality ? 112 : 90;
    perfProfile.showBgGradient = false;
    maxFloats = perfProfile.lowQuality ? 8 : MAX_FLOATS;
    maxParticles = perfProfile.lowQuality ? 60 : 90;
    cursorVisible = !perfProfile.isTouch;
}

updatePerfProfile();


// ═══════════════════════════════════════════════
//  MENÚ
// ═══════════════════════════════════════════════
function refreshMenu() {
    menuHighScore.textContent = save.highScore;
    menuMaxLevel.textContent = save.maxLevel;

    levelSelect.innerHTML = '';
    for (let i = 1; i <= save.maxLevel; i++) {
        const c = getLevelConfig(i);
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Nivel ${i}${c.isChallenge ? ' 🔥 DESAFÍO' : ''}`;
        levelSelect.appendChild(opt);
    }
    levelSelect.value = Math.min(save.maxLevel, currentLevel);

    btnAudio.classList.toggle('active', save.audio);
    btnVibrate.classList.toggle('active', save.vibrate);
    btnAudio.querySelector('.icon').textContent = save.audio ? '🔊' : '🔇';
    hudAudioBtn.textContent = save.audio ? '🔊' : '🔇';
    hudAudioBtn.classList.toggle('active', save.audio);
}

refreshMenu();

btnAudio.addEventListener('click', () => { ensureAudio(); save.audio = !save.audio; writeSave(save); refreshMenu(); });
btnVibrate.addEventListener('click', () => { save.vibrate = !save.vibrate; writeSave(save); refreshMenu(); });
hudAudioBtn.addEventListener('click', () => { save.audio = !save.audio; writeSave(save); refreshMenu(); });

btnPlay.addEventListener('click', () => {
    ensureAudio();
    currentLevel = parseInt(levelSelect.value) || 1;
    startGame(currentLevel);
});


// ═══════════════════════════════════════════════
//  INICIO DE PARTIDA
// ═══════════════════════════════════════════════
function startGame(levelNum) {
    cfg = getLevelConfig(levelNum);
    score = 0;
    absorbed = 0;
    absorbedByType = {};
    pendingWin = false;
    activePowerups = {};
    particles = [];

    const vw = window.innerWidth;
    const vh = window.innerHeight - 48;
    WORLD_W = Math.max(vw * perfProfile.worldScale, perfProfile.lowQuality ? 760 : 900);
    WORLD_H = Math.max(vh * perfProfile.worldScale, perfProfile.lowQuality ? 680 : 800);

    player = {
        x: WORLD_W / 2,
        y: WORLD_H / 2,
        r: cfg.playerStartRadius,
        vx: 0,
        vy: 0,
    };

    objects = generateObjects(cfg);
    timeLeft = cfg.timeLimit;

    clearInterval(timerInterval);
    timerInterval = setInterval(tickTimer, 1000);

    menuEl.classList.add('hidden');
    canvas.classList.add('visible');
    hudEl.classList.add('visible');
    pauseOverlay.classList.remove('visible');
    endOverlay.classList.remove('visible');

    resizeCanvas();
    mouseX = canvas.width / 2;
    mouseY = canvas.height / 2;

    updateHUD();
    updatePowerupBar();

    state = 'playing';
    cancelAnimationFrame(rafId);
    lastTime = 0;
    rafId = requestAnimationFrame(gameLoop);
}

function tickTimer() {
    if (state !== 'playing') return;
    if (activePowerups.freeze > 0 || activePowerups.citronela > 0) return;
    timeLeft--;
    hudTimeChip.classList.toggle('warning', timeLeft <= 10);
    if (timeLeft <= 0) endGame(false);
    updateHUD();
}

function updateHUD() {
    hudQuotaVal.textContent = formatObjectiveProgress(cfg.objectives, absorbedByType);
    hudScoreVal.textContent = score;
    hudTimeVal.textContent = timeLeft;
}

function updatePowerupBar() {
    if (!powerupBar) return;
    powerupBar.innerHTML = '';
    if (activePowerups.speed > 0) {
        const pill = document.createElement('div');
        pill.className = 'powerup-pill speed';
        pill.innerHTML = `⚡ SPEED <span>${Math.ceil(activePowerups.speed / 60)}s</span>`;
        powerupBar.appendChild(pill);
    }
    if (activePowerups.freeze > 0) {
        const pill = document.createElement('div');
        pill.className = 'powerup-pill freeze';
        pill.innerHTML = `❄️ FREEZE <span>${Math.ceil(activePowerups.freeze / 60)}s</span>`;
        powerupBar.appendChild(pill);
    }
    if (activePowerups.slow > 0) {
        const pill = document.createElement('div');
        pill.className = 'powerup-pill powerdown';
        pill.innerHTML = `🟫 BARRO <span>${Math.ceil(activePowerups.slow / 60)}s</span>`;
        powerupBar.appendChild(pill);
    }
    if (activePowerups.citronela > 0) {
        const pill = document.createElement('div');
        pill.className = 'powerup-pill citronela';
        pill.innerHTML = `🟢 CITRONELA <span>${Math.ceil(activePowerups.citronela / 60)}s</span>`;
        powerupBar.appendChild(pill);
    }
}


// ═══════════════════════════════════════════════
//  GENERACIÓN DE OBJETOS
// ═══════════════════════════════════════════════
function rndPos(yTop = false) {
    const margin = 70;
    const x = margin + Math.random() * (WORLD_W - margin * 2);
    const y = yTop
        ? margin + Math.random() * (WORLD_H * 0.5)
        : margin + Math.random() * (WORLD_H - margin * 2);
    return { x, y };
}

function generateObjects(cfg) {
    const objs = [];

    // ── Coleccionables (objetivos) ──
    for (const objective of cfg.objectives) {
        const visual = getCollectibleVisual(objective.key);
        for (let i = 0; i < objective.count; i++) {
            const p = rndPos(true);
            const baseR = getObjectRadius('collectible', objective.key, cfg.playerStartRadius);
            objs.push({
                type: 'collectible',
                collectibleKey: objective.key,
                x: p.x,
                y: p.y,
                r: baseR,    // radio de render (cambia durante absorción)
                baseR: baseR,    // radio original (referencia fija para canAbsorb)
                vx: (Math.random() - 0.5) * 0.05,
                vy: 0.06 + Math.random() * 0.09,
                alive: true,
                absorbing: false,
                absorbT: 0,
                color: visual.color,
                points: Math.round(baseR * 2),
                emoji: visual.emoji,
                img: loadCollectibleImage(objective.key),
            });
        }
    }

    // ── Señuelos ──
    const distractorKeys = Object.keys(DISTRACTOR_VISUALS);
    const distractorCount = Math.max(10, Math.round(getObjectiveTotal(cfg.objectives) * 1.4 * perfProfile.objectMultiplier));
    for (let i = 0; i < distractorCount; i++) {
        const key = distractorKeys[Math.floor(Math.random() * distractorKeys.length)];
        const visual = getDistractorVisual(key);
        const p = rndPos(i % 2 === 0);
        const baseR = getObjectRadius('distractor', key, cfg.playerStartRadius);
        objs.push({
            type: 'distractor',
            distractorKey: key,
            x: p.x,
            y: p.y,
            r: baseR,
            baseR: baseR,
            vx: (Math.random() - 0.5) * 0.08,
            vy: 0.04 + Math.random() * 0.10,
            alive: true,
            absorbing: false,
            absorbT: 0,
            color: visual.color,
            points: Math.round(baseR * 1.2),
            emoji: visual.emoji,
            img: loadDistractorImage(key),
        });
    }

    // ── Power-ups: crecimiento ──
    for (let i = 0; i < cfg.growthCount; i++) {
        const p = rndPos(true);
        const baseR = 15;
        objs.push({
            type: 'growth', x: p.x, y: p.y,
            r: baseR, baseR,
            vx: 0, vy: 0.03,
            alive: true, absorbing: false, absorbT: 0,
            color: '#e8ff47', points: 50, emoji: '⭐',
            img: loadImage(TYPE_IMAGES.growth),
        });
    }

    // ── Power-down: barro / trampa rural ──
    for (let i = 0; i < cfg.powerdownCount; i++) {
        const p = rndPos(i % 2 === 0);
        const baseR = getObjectRadius('collectible', 'target', cfg.playerStartRadius) * randomBetween(0.9, 1.25);
        const visual = getPowerdownVisual();
        objs.push({
            type: 'powerdown',
            powerdownKey: visual.key,
            x: p.x,
            y: p.y,
            r: baseR,
            baseR,
            vx: (Math.random() - 0.5) * 0.06,
            vy: 0.05 + Math.random() * 0.08,
            alive: true,
            absorbing: false,
            absorbT: 0,
            color: visual.color,
            points: 0,
            emoji: visual.emoji,
            duration: 6 + Math.floor(cfg.level / 3),
            img: loadPowerdownImage(),
        });
    }

    // ── Power-down letal: jeringuilla ──
    // Solo aparece una vez por partida. Si se come, se pierde al instante.
    for (let i = 0; i < cfg.powerdownLoseCount; i++) {
        const p = rndPos(false);
        const visual = getLethalPowerdownVisual();
        const baseR = Math.max(18, getObjectRadius('distractor', 'cone', cfg.playerStartRadius) * 1.1);
        objs.push({
            type: 'powerdownLose',
            powerdownKey: visual.key,
            x: p.x,
            y: p.y,
            r: baseR,
            baseR,
            vx: (Math.random() - 0.5) * 0.05,
            vy: 0.04 + Math.random() * 0.06,
            alive: true,
            absorbing: false,
            absorbT: 0,
            color: visual.color,
            points: 0,
            emoji: visual.emoji,
            duration: 0,
            img: loadLethalPowerdownImage(),
        });
    }

    // ── Power-ups: velocidad ──
    for (let i = 0; i < cfg.speedupCount; i++) {
        const p = rndPos(false);
        const baseR = 14;
        objs.push({
            type: 'speedup', x: p.x, y: p.y,
            r: baseR, baseR,
            vx: 0, vy: 0.04,
            alive: true, absorbing: false, absorbT: 0,
            color: '#ff9a47', points: 30, emoji: '⚡', duration: 7,
            img: loadImage(TYPE_IMAGES.speedup),
        });
    }

    // ── Power-ups: congelación ──
    for (let i = 0; i < cfg.freezeCount; i++) {
        const p = rndPos(false);
        const baseR = 14;
        objs.push({
            type: 'freeze', x: p.x, y: p.y,
            r: baseR, baseR,
            vx: 0, vy: 0.04,
            alive: true, absorbing: false, absorbT: 0,
            color: '#47c8ff', points: 40, emoji: '❄️', duration: 9,
            img: loadImage(TYPE_IMAGES.freeze),
        });
    }

    // ── Power-ups: citronela ──
    for (let i = 0; i < cfg.citronelaCount; i++) {
        const p = rndPos(false);
        const baseR = 18;
        objs.push({
            type: 'citronela', x: p.x, y: p.y,
            r: baseR, baseR,
            vx: 0, vy: 0.03,
            alive: true, absorbing: false, absorbT: 0,
            color: '#7dff8a', points: 120, emoji: '🟢', duration: 10,
            img: loadImage(TYPE_IMAGES.citronela),
        });
    }

    return objs;
}


// ═══════════════════════════════════════════════
//  BUCLE PRINCIPAL
// ═══════════════════════════════════════════════
function gameLoop(ts) {
    rafId = requestAnimationFrame(gameLoop);

    const rawDt = lastTime ? (ts - lastTime) / 16.667 : 1;
    const dt = Math.min(rawDt, 2.5);
    lastTime = ts;

    if (state === 'paused') { renderFrame(); return; }
    if (state !== 'playing') return;

    update(dt);
    renderFrame();
}


// ═══════════════════════════════════════════════
//  UPDATE
// ═══════════════════════════════════════════════
function update(dt) {
    // ── Movimiento del jugador ──────────────────
    const slowFactor = activePowerups.slow > 0 ? 0.45 : 1;
    const MAX_SPEED =
        activePowerups.citronela > 0 ? 9.6 :
            activePowerups.speed > 0 ? 4.2 : 2.4;
    const ACCEL = 0.07;
    const FRICTION = 0.88;

    const targetWX = mouseX + camX;
    const targetWY = mouseY + camY + 48;
    const dx = targetWX - player.x;
    const dy = targetWY - player.y;
    const dist2 = dx * dx + dy * dy;
    const minDist = player.r * 0.6;

    if (dist2 > minDist * minDist) {
        const dist = Math.sqrt(dist2);
        const nx = dx / dist;
        const ny = dy / dist;
        const force = Math.min(dist * 0.008, MAX_SPEED) * ACCEL * slowFactor;
        player.vx += nx * force * dt * 60;
        player.vy += ny * force * dt * 60;
    }

    player.vx *= Math.pow(FRICTION, dt);
    player.vy *= Math.pow(FRICTION, dt);

    const spd2 = player.vx * player.vx + player.vy * player.vy;
    if (spd2 > (MAX_SPEED * slowFactor) * (MAX_SPEED * slowFactor)) {
        const spd = Math.sqrt(spd2);
        player.vx = (player.vx / spd) * (MAX_SPEED * slowFactor);
        player.vy = (player.vy / spd) * (MAX_SPEED * slowFactor);
    }

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    if (player.x < player.r) { player.x = player.r; player.vx *= -0.4; }
    if (player.x > WORLD_W - player.r) { player.x = WORLD_W - player.r; player.vx *= -0.4; }
    if (player.y < player.r) { player.y = player.r; player.vy *= -0.4; }
    if (player.y > WORLD_H - player.r) { player.y = WORLD_H - player.r; player.vy *= -0.4; }

    // ── Cámara ──────────────────────────────────
    const vw = canvas.width, vh = canvas.height;
    const targetCamX = Math.max(0, Math.min(WORLD_W - vw, player.x - vw / 2));
    const targetCamY = Math.max(0, Math.min(WORLD_H - vh, player.y - vh / 2));
    const camLerp = Math.min(1, perfProfile.cameraLerp * dt);
    camX += (targetCamX - camX) * camLerp;
    camY += (targetCamY - camY) * camLerp;

    // ── Objetos ──────────────────────────────────
    const freezeFactor = activePowerups.freeze > 0 ? 0.15 : 1;

    for (const obj of objects) {
        if (!obj.alive) continue;

        // ── FASE DE ABSORCIÓN ← BUG CORREGIDO ──────
        // Una vez iniciada la absorción, el objeto ya no se mueve libremente
        // ni se vuelve a comprobar la colisión. Se gestiona completamente aquí
        // hasta que absorbT llega a 1, momento en que se marca como !alive.
        if (obj.absorbing) {
            obj.absorbT = Math.min(1, obj.absorbT + dt * 0.022);

            // Interpolación hacia el centro del jugador (curva ease-in)
            const ease = obj.absorbT * obj.absorbT;  // aceleración progresiva
            obj.x = obj.absorbStartX + (player.x - obj.absorbStartX) * ease;
            obj.y = obj.absorbStartY + (player.y - obj.absorbStartY) * ease;

            // Radio se reduce hasta 0 con la misma curva
            obj.r = obj.baseR * (1 - ease);

            if (obj.absorbT >= 1) {
                obj.alive = false;
            }
            continue;  // nunca vuelve a la rama de movimiento normal
        }

        // ── Movimiento libre ─────────────────────
        obj.x += obj.vx * dt * freezeFactor;
        obj.y += obj.vy * dt * freezeFactor;

        // Wrap horizontal
        if (obj.x < -obj.r) obj.x = WORLD_W + obj.r;
        if (obj.x > WORLD_W + obj.r) obj.x = -obj.r;
        // Rebote vertical
        if (obj.y > WORLD_H - obj.r) { obj.y = WORLD_H - obj.r; obj.vy *= -0.4; }
        if (obj.y < obj.r) { obj.y = obj.r; obj.vy = Math.abs(obj.vy) || 0.06; }

        // ── Detección de colisión ← BUG CORREGIDO ──
        // Solo comprobamos colisión si el objeto NO está absorbiendo ya.
        // canAbsorbObject usa baseR (radio original fijo), no r (que cambia).
        const odx = obj.x - player.x;
        const ody = obj.y - player.y;
        const cdist2 = odx * odx + ody * ody;
        const absorbRange = player.r + obj.r * 0.65;

        if (cdist2 < absorbRange * absorbRange && canAbsorbObject(obj, player.r)) {
            absorb(obj);
        }
    }

    // ── Partículas ───────────────────────────────
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= dt * 0.035;
        if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > maxParticles) {
        particles.splice(0, particles.length - maxParticles);
    }

    // ── Victoria pendiente ───────────────────────
    // Esperamos a que todos los objetos absorbiéndose terminen
    if (pendingWin && !objects.some(o => o.alive && o.absorbing)) {
        endGame(true);
        return;
    }

    // ── Timers de powerups ────────────────────────
    let changed = false;
    for (const key of Object.keys(activePowerups)) {
        activePowerups[key] -= dt;
        if (activePowerups[key] <= 0) { delete activePowerups[key]; changed = true; }
    }
    if (changed) updatePowerupBar();
}


// ═══════════════════════════════════════════════
//  ABSORCIÓN
// ═══════════════════════════════════════════════
function absorb(obj) {
    if (obj.absorbing) return;

    const big = obj.baseR > player.r * 0.65;
    playAbsorb(big);
    if (big) vibrate([30, 15, 30]);

    // Guardamos la posición de INICIO para interpolar en update()
    obj.absorbing = true;
    obj.absorbT = 0;
    obj.absorbStartX = obj.x;
    obj.absorbStartY = obj.y;
    // baseR ya está definido en generateObjects; no lo tocamos aquí

    // Partículas
    const count = big ? 12 : 6;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        const spd = 0.8 + Math.random() * 2.5;
        particles.push({
            x: obj.x, y: obj.y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            r: 2 + Math.random() * 3.5,
            color: obj.color,
            life: 1,
        });
    }

    score += obj.points;

    switch (obj.type) {
        case 'collectible': {
            absorbed++;
            absorbedByType[obj.collectibleKey] = (absorbedByType[obj.collectibleKey] || 0) + 1;
            player.r += cfg.growthPerObject * 0.4;
            showFloat(`+${obj.points}`, obj.x, obj.y, getCollectibleVisual(obj.collectibleKey).color);
            pendingWin = areObjectivesComplete(cfg.objectives, absorbedByType);
            break;
        }
        case 'distractor':
            showFloat(`+${obj.points}`, obj.x, obj.y, getDistractorVisual(obj.distractorKey).color);
            break;
        case 'growth':
            player.r += 5;
            playPowerup();
            vibrate([20, 10, 20, 10, 40]);
            showFloat('⭐ +5', obj.x, obj.y, '#e8ff47');
            break;
        case 'speedup':
            activePowerups.speed = obj.duration * 60;
            playPowerup();
            vibrate([50, 30, 50]);
            showFloat('⚡ ¡RÁPIDO!', obj.x, obj.y, '#ff9a47');
            updatePowerupBar();
            break;
        case 'freeze':
            activePowerups.freeze = obj.duration * 60;
            playPowerup();
            vibrate([80, 40, 80]);
            showFloat('❄️ ¡FREEZE!', obj.x, obj.y, '#47c8ff');
            updatePowerupBar();
            break;
        case 'powerdown':
            activePowerups.slow = obj.duration * 60;
            playPowerdown();
            vibrate([30, 20, 30]);
            showFloat('🟫 ¡BARRO!', obj.x, obj.y, '#8f5b3e');
            updatePowerupBar();
            break;
        case 'powerdownLose':
            playLose();
            vibrate([220, 80, 220]);
            showFloat('💉 ¡MAL!', obj.x, obj.y, '#f36f5b');
            pendingWin = false;
            endGame(false);
            break;
        case 'citronela':
            activePowerups.citronela = obj.duration * 60;
            player.r *= 1.25;
            playPowerup();
            vibrate([120, 40, 120]);
            showFloat('🟢 CITRONELA!', obj.x, obj.y, '#7dff8a');
            updatePowerupBar();
            break;
    }

    updateHUD();
}


// ═══════════════════════════════════════════════
//  TEXTO FLOTANTE
// ═══════════════════════════════════════════════
function showFloat(text, wx, wy, color = '#e8ff47') {
    if (floatCount >= maxFloats) {
        const old = document.querySelector('.float-text');
        if (old) { old.remove(); floatCount = Math.max(0, floatCount - 1); }
    }
    floatCount++;
    const sx = wx - camX;
    const sy = wy - camY + 48;
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    el.style.color = color;
    el.style.textShadow = `0 0 8px ${color}`;
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); floatCount = Math.max(0, floatCount - 1); }, 950);
}


// ═══════════════════════════════════════════════
//  RENDER DE FONDOS (cacheados)
// ═══════════════════════════════════════════════
function renderGrid() {
    if (!gridCtx || !gridDirty) return;
    const gs = perfProfile.gridSize;
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.fillStyle = perfProfile.lowQuality ? 'rgba(120,84,50,0.035)' : 'rgba(120,84,50,0.055)';
    for (let x = 0; x < gridCanvas.width; x += gs) {
        for (let y = 0; y < gridCanvas.height; y += gs) {
            gridCtx.beginPath();
            gridCtx.arc(x, y, 1.5, 0, Math.PI * 2);
            gridCtx.fill();
        }
    }

    // Suelo de madera muy sutil para reforzar el estilo de hogar/pueblo.
    gridCtx.save();
    gridCtx.globalAlpha = perfProfile.lowQuality ? 0.07 : 0.12;
    gridCtx.strokeStyle = '#a56f42';
    gridCtx.lineWidth = 1;
    for (let y = Math.floor(gridCanvas.height * 0.68); y < gridCanvas.height; y += 56) {
        gridCtx.beginPath();
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(gridCanvas.width, y);
        gridCtx.stroke();
    }
    gridCtx.restore();
    gridDirty = false;
}

function renderBackground() {
    if (!bgCtx || !bgDirty) return;
    const W = bgCanvas.width, H = bgCanvas.height;
    bgCtx.clearRect(0, 0, W, H);

    // Pared clara de casa/patio con luz de tarde.
    const wallGrad = bgCtx.createLinearGradient(0, 0, 0, H);
    wallGrad.addColorStop(0, '#f9f2e7');
    wallGrad.addColorStop(0.48, '#f2dfc8');
    wallGrad.addColorStop(0.72, '#e1bf96');
    wallGrad.addColorStop(1, '#c58954');
    bgCtx.fillStyle = wallGrad;
    bgCtx.fillRect(0, 0, W, H);

    // Resplandor cálido de ventana / lámpara de pared.
    const warmGlow = bgCtx.createRadialGradient(W * 0.22, H * 0.18, 0, W * 0.22, H * 0.18, Math.max(W, H) * 0.4);
    warmGlow.addColorStop(0, 'rgba(255, 250, 236, .65)');
    warmGlow.addColorStop(0.4, 'rgba(255, 233, 197, .26)');
    warmGlow.addColorStop(1, 'rgba(255, 233, 197, 0)');
    bgCtx.fillStyle = warmGlow;
    bgCtx.fillRect(0, 0, W, H);

    // Viga superior / techo cálido.
    bgCtx.fillStyle = 'rgba(171, 117, 66, .18)';
    bgCtx.fillRect(0, 0, W, Math.max(28, Math.floor(H * 0.045)));

    // Suelo de madera con tablones.
    const floorY = Math.floor(H * 0.68);
    const floorGrad = bgCtx.createLinearGradient(0, floorY, 0, H);
    floorGrad.addColorStop(0, 'rgba(193, 141, 92, .45)');
    floorGrad.addColorStop(1, 'rgba(142, 88, 48, .88)');
    bgCtx.fillStyle = floorGrad;
    bgCtx.fillRect(0, floorY, W, H - floorY);

    bgCtx.save();
    bgCtx.globalAlpha = 0.18;
    bgCtx.strokeStyle = '#8c5835';
    bgCtx.lineWidth = 2;
    for (let y = floorY + 12; y < H; y += 54) {
        bgCtx.beginPath();
        bgCtx.moveTo(0, y);
        bgCtx.lineTo(W, y);
        bgCtx.stroke();
    }
    bgCtx.restore();

    // Sombra suave en los bordes para dar profundidad sin oscurecer demasiado.
    const vignette = bgCtx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.18, W / 2, H / 2, Math.max(W, H) * 0.78);
    vignette.addColorStop(0, 'rgba(255,255,255,0)');
    vignette.addColorStop(1, 'rgba(106, 67, 39, .12)');
    bgCtx.fillStyle = vignette;
    bgCtx.fillRect(0, 0, W, H);

    // Pequeños puntos de polvo/arena, muy ligeros, para dar vida al fondo.
    bgCtx.save();
    bgCtx.globalAlpha = 0.08;
    bgCtx.fillStyle = '#fff7eb';
    const specks = perfProfile.lowQuality ? 45 : 90;
    for (let i = 0; i < specks; i++) {
        const x = (i * 131) % W;
        const y = (i * 67) % H;
        bgCtx.beginPath();
        bgCtx.arc(x, y, 1 + (i % 2) * 0.5, 0, Math.PI * 2);
        bgCtx.fill();
    }
    bgCtx.restore();

    bgDirty = false;
}


// ═══════════════════════════════════════════════
//  RENDER PRINCIPAL
// ═══════════════════════════════════════════════
function renderFrame() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bgCanvas, 0, 0);
    ctx.drawImage(gridCanvas, 0, 0);

    ctx.save();
    ctx.translate(-camX, -camY);

    // Borde del mundo
    ctx.strokeStyle = 'rgba(184,116,60,0.55)';
    ctx.lineWidth = 3;
    ctx.shadowBlur = perfProfile.lowQuality ? 0 : 10;
    ctx.shadowColor = '#b8743c';
    ctx.strokeRect(2, 2, WORLD_W - 4, WORLD_H - 4);
    ctx.shadowBlur = 0;

    renderObjects(false);
    renderParticles();
    renderPlayer();
    renderObjects(true);

    ctx.restore();
}

function renderObjects(absorbingOnly = false) {
    const W = canvas.width, H = canvas.height;
    const lowQuality = perfProfile.lowQuality || objects.length > 120;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    for (const obj of objects) {
        if (!obj.alive) continue;
        if (absorbingOnly ? !obj.absorbing : obj.absorbing) continue;

        // Culling básico
        const sx = obj.x - camX;
        const sy = obj.y - camY;
        if (sx < -100 || sx > W + 100 || sy < -100 || sy > H + 100) continue;

        // Efecto de profundidad
        const depthT = obj.y / WORLD_H;
        const depthScale = 1.4 + depthT * 1.0;
        const dr = obj.r * depthScale * 1.5;
        const alpha = 0.55 + depthT * 0.45;

        ctx.save();

        // ── Indicador visual de "no puedes absorberlo aún" ──────────────
        // Si el jugador está cerca pero NO puede absorber: se dibuja un contorno
        // rojo parpadeante para que el jugador sepa que necesita crecer más.
        if (!obj.absorbing && (obj.type === 'collectible' || obj.type === 'distractor')) {
            const odx = obj.x - player.x;
            const ody = obj.y - player.y;
            const proximity = Math.sqrt(odx * odx + ody * ody);
            const isNear = proximity < player.r + obj.r * 1.8;
            const tooSmall = !canAbsorbObject(obj, player.r);

            if (isNear && tooSmall) {
                // Halo rojo pulsante
                const pulse = 0.4 + 0.3 * Math.sin(Date.now() * 0.008);
                ctx.globalAlpha = pulse;
                ctx.strokeStyle = '#ff4747';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, dr + 5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        ctx.globalAlpha = obj.absorbing
            ? alpha * Math.max(0.05, 1 - obj.absorbT * 0.95)
            : alpha;

        if (obj.img && obj.img.complete && obj.img.naturalWidth > 0) {
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, dr, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(obj.img, obj.x - dr, obj.y - dr, dr * 2, dr * 2);

            if (!lowQuality && !obj.absorbing) {
                ctx.globalAlpha = alpha * 0.35;
                ctx.strokeStyle = obj.color;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, dr, 0, Math.PI * 2);
                ctx.stroke();
            }
        } else if (lowQuality) {
            ctx.fillStyle = obj.color;
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, dr, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = obj.color;
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, dr, 0, Math.PI * 2);
            ctx.fill();

            if (dr > 8) {
                ctx.font = `${Math.max(10, dr * 1.0)}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.globalAlpha = alpha;
                ctx.fillText(obj.emoji, obj.x, obj.y);
            }
        }

        // Tether durante absorción
        if (obj.absorbing && !lowQuality) {
            const t = obj.absorbT;
            const tetherAlpha = Math.max(0.04, 0.28 - t * 0.28);
            ctx.save();
            ctx.globalAlpha = tetherAlpha;
            ctx.strokeStyle = obj.color;
            ctx.lineWidth = Math.max(1, dr * 0.06);
            ctx.beginPath();
            ctx.moveTo(obj.x, obj.y);
            ctx.lineTo(player.x, player.y);
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    }
}

function renderParticles() {
    if (particles.length > maxParticles) {
        particles.splice(0, particles.length - maxParticles);
    }
    for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life * 0.85;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = perfProfile.lowQuality ? 0 : 5;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function renderPlayer() {
    const { x: px, y: py, r: pr } = player;
    const rimColor =
        activePowerups.citronela > 0 ? '#7dff8a' :
            activePowerups.speed > 0 ? '#ff9a47' :
                activePowerups.freeze > 0 ? '#47c8ff' : '#7c3aed';
    const progress = cfg ? Math.min(1, absorbed / Math.max(1, cfg.quota)) : 0;

    ctx.save();
    ctx.shadowBlur = perfProfile.lowQuality ? 8 : 16;
    ctx.shadowColor = rimColor;

    // Cuerpo del hoyo
    const holeGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    holeGrad.addColorStop(0, '#2a0a4e');
    holeGrad.addColorStop(0.65, '#1a0a2e');
    holeGrad.addColorStop(1, '#08040f');
    ctx.fillStyle = holeGrad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Rim
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.stroke();

    // Arco de progreso
    ctx.strokeStyle = '#e8ff47';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(px, py, pr + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();

    // Texto interior
    const fontSize = Math.max(8, pr * 0.34);
    ctx.fillStyle = '#e8ff47';
    ctx.font = `bold ${fontSize}px 'Space Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(progress * 100)}%`, px, py);

    ctx.restore();
}


// ═══════════════════════════════════════════════
//  FIN DE PARTIDA
// ═══════════════════════════════════════════════
function endGame(win) {
    state = 'ended';
    clearInterval(timerInterval);
    cancelAnimationFrame(rafId);

    if (win) {
        playWin();
        vibrate([100, 50, 100, 50, 200]);
        if (currentLevel >= save.maxLevel && currentLevel < TOTAL_LEVELS) {
            save.maxLevel = currentLevel + 1;
        }
    } else {
        playLose();
        vibrate([300]);
    }

    if (score > save.highScore) save.highScore = score;
    writeSave(save);

    endTitle.textContent = win ? '¡GANASTE!' : '¡TIEMPO!';
    endTitle.className = 'overlay-title ' + (win ? 'win' : 'lose');
    endSub.textContent = win
        ? `Nivel ${currentLevel} completado · ${formatObjectiveProgress(cfg.objectives, absorbedByType)} · ${score} pts`
        : `${formatObjectiveProgress(cfg.objectives, absorbedByType)} · ${score} pts`;

    if (btnNextLevel) {
        const hasNextLevel = win && currentLevel < TOTAL_LEVELS;
        btnNextLevel.style.display = hasNextLevel ? '' : 'none';
    }

    endOverlay.classList.add('visible');
}


// ═══════════════════════════════════════════════
//  PAUSA
// ═══════════════════════════════════════════════
function togglePause() {
    if (state === 'playing') {
        state = 'paused';
        clearInterval(timerInterval);
        hudPauseBtn.textContent = '▶';
        pauseOverlay.classList.add('visible');
    } else if (state === 'paused') {
        resumeGame();
    }
}

function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    timerInterval = setInterval(tickTimer, 1000);
    hudPauseBtn.textContent = '⏸';
    pauseOverlay.classList.remove('visible');
    lastTime = 0;
}

function goToMenu() {
    state = 'menu';
    clearInterval(timerInterval);
    cancelAnimationFrame(rafId);
    canvas.classList.remove('visible');
    hudEl.classList.remove('visible');
    pauseOverlay.classList.remove('visible');
    endOverlay.classList.remove('visible');
    hudPauseBtn.textContent = '⏸';
    hudTimeChip.classList.remove('warning');
    if (powerupBar) powerupBar.innerHTML = '';
    menuEl.classList.remove('hidden');
    refreshMenu();
}

function goToNextLevel() {
    if (currentLevel >= TOTAL_LEVELS) {
        goToMenu();
        return;
    }

    const nextLevel = Math.min(currentLevel + 1, save.maxLevel, TOTAL_LEVELS);
    endOverlay.classList.remove('visible');
    currentLevel = nextLevel;
    startGame(nextLevel);
}

hudPauseBtn.addEventListener('click', togglePause);
btnResume.addEventListener('click', resumeGame);
btnPauseMenu.addEventListener('click', goToMenu);
btnEndMenu.addEventListener('click', goToMenu);
btnNextLevel.addEventListener('click', goToNextLevel);
btnReplay.addEventListener('click', () => {
    endOverlay.classList.remove('visible');
    startGame(currentLevel);
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && (state === 'playing' || state === 'paused')) togglePause();
});


// ═══════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════
function setMouse(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    mouseX = clientX - rect.left;
    mouseY = clientY - rect.top;
}

canvas.addEventListener('pointermove', e => setMouse(e.clientX, e.clientY), { passive: true });
canvas.addEventListener('pointerdown', e => { ensureAudio(); setMouse(e.clientX, e.clientY); }, { passive: true });

mouseX = window.innerWidth / 2;
mouseY = (window.innerHeight - 48) / 2;


// ═══════════════════════════════════════════════
//  RESIZE
// ═══════════════════════════════════════════════
function resizeCanvas() {
    updatePerfProfile();
    const w = window.innerWidth;
    const h = window.innerHeight - 48;

    canvas.width = w;
    canvas.height = h;
    canvas.style.cursor = cursorVisible ? 'none' : 'default';

    gridCanvas.width = canvas.width;
    gridCanvas.height = canvas.height;
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;

    gridDirty = true;
    bgDirty = true;
    renderBackground();
    renderGrid();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') {
        state = 'paused';
        clearInterval(timerInterval);
        hudPauseBtn.textContent = '⏸';
        pauseOverlay.classList.add('visible');
    }
});