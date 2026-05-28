// ═══════════════════════════════════════════════════════════════
//  HOLE CARABANCHEL  ·  script.js
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
//  IMÁGENES PERSONALIZADAS
//  Para usar tus propias imágenes PNG/WebP/SVG,
//  pon los archivos en la carpeta "img/" y edita
//  el array CUSTOM_IMAGES con sus rutas.
//  Si la lista está vacía el juego usa emojis.
//
//  Ejemplo:
//    const CUSTOM_IMAGES = [
//      'img/botella.png',
//      'img/bici.png',
//      'img/banco.png',
//      'img/paloma.png',
//    ];
//
//  Puedes asignar imágenes específicas a tipos:
//    const TYPE_IMAGES = {
//      growth:  'img/estrella.png',
//      speedup: 'img/rayo.png',
//      freeze:  'img/hielo.png',
//    };
// ─────────────────────────────────────────────
const CUSTOM_IMAGES = [];   // ← añade rutas aquí

const TYPE_IMAGES = {       // ← imágenes por tipo especial (opcional)
    growth: 'img/growth.png',
    speedup: 'img/speedup.png',
    freeze: 'img/freeze.png',
    citronela: 'img/citronela.png',
};

// Cache de objetos Image cargados
const imgCache = {};
function loadImage(src) {
    if (!src) return null;
    if (imgCache[src]) return imgCache[src];
    const img = new Image();
    img.src = src;
    imgCache[src] = img;
    return img;
}
// Precarga todas las imágenes al arrancar
[...CUSTOM_IMAGES, ...Object.values(TYPE_IMAGES).filter(Boolean)].forEach(loadImage);


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

function getLevelConfig(n) {
    const isChallenge = n % 5 === 0;
    const objMul = perfProfile.objectMultiplier;
    return {
        level: n,
        quota: 8 + n * 3,
        timeLimit: isChallenge ? Math.max(25, 65 - n * 2) : Math.max(35, 80 - n * 2),
        objectCount: Math.max(18, Math.round((35 + n * 6) * objMul)),
        growthCount: Math.max(2, Math.round((3 + Math.floor(n / 2)) * objMul)),
        speedupCount: 2,
        freezeCount: 1 + (isChallenge ? 1 : 0),
        citronelaCount: isChallenge ? 1 : 0,
        playerStartRadius: 22,
        growthPerObject: 2.2 + n * 0.25,
        isChallenge,
    };
}


// ═══════════════════════════════════════════════
//  AUDIO (Web Audio API, sin librerías)
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
const powerupBar = document.getElementById('powerup-bar');


// ═══════════════════════════════════════════════
//  ESTADO DE JUEGO
// ═══════════════════════════════════════════════
let state = 'menu'; // menu | playing | paused | ended
let cfg = null;
let player = null;
let objects = [];
let particles = [];
let score = 0;
let absorbed = 0;
let timeLeft = 0;
let timerInterval = null;
let rafId = null;
let WORLD_W = 0;
let WORLD_H = 0;
let camX = 0;
let camY = 0;
let mouseX = 0;
let mouseY = 0;
let activePowerups = {};  // { speed: framesLeft, freeze: framesLeft }
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
    perfProfile.showBgGradient = !perfProfile.lowQuality;
    maxFloats = perfProfile.lowQuality ? 10 : MAX_FLOATS;
    maxParticles = perfProfile.lowQuality ? 80 : MAX_PARTICLES;
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
    activePowerups = {};
    particles = [];

    // Mundo
    const vw = window.innerWidth;
    const vh = window.innerHeight - 48;
    WORLD_W = Math.max(vw * perfProfile.worldScale, perfProfile.lowQuality ? 760 : 900);
    WORLD_H = Math.max(vh * perfProfile.worldScale, perfProfile.lowQuality ? 680 : 800);

    // Jugador: empieza centrado
    player = {
        x: WORLD_W / 2,
        y: WORLD_H / 2,
        r: cfg.playerStartRadius,
        vx: 0, vy: 0,
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
    hudQuotaVal.textContent = `${absorbed}/${cfg.quota}`;
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
    if (activePowerups.citronela > 0) {
        const pill = document.createElement('div');

        pill.className = 'powerup-pill citronela';

        pill.innerHTML =
            `🟢 CITRONELA <span>${Math.ceil(activePowerups.citronela / 60)}s</span>`;

        powerupBar.appendChild(pill);
    }
}


// ═══════════════════════════════════════════════
//  GENERACIÓN DE OBJETOS
// ═══════════════════════════════════════════════
const EMOJI_POOL = ['🧱', '🪨', '📦', '🎁', '🍎', '🏀', '🎲', '🧩', '🥡', '🫙', '🚗', '🪑', '🌀', '💎', '🎯'];

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

    // Estándar
    for (let i = 0; i < cfg.objectCount; i++) {
        const p = rndPos(true);
        const r = 7 + Math.random() * (cfg.playerStartRadius * 0.9);
        const src = CUSTOM_IMAGES.length
            ? CUSTOM_IMAGES[Math.floor(Math.random() * CUSTOM_IMAGES.length)]
            : null;
        objs.push({
            type: 'standard',
            x: p.x, y: p.y, r,
            vx: (Math.random() - 0.5) * 0.05,
            vy: 0.06 + Math.random() * 0.09,
            alive: true,
            color: `hsl(${200 + Math.random() * 120},70%,60%)`,
            points: Math.round(r * 2),
            emoji: EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)],
            img: loadImage(src),
        });
    }

    // Crecimiento
    for (let i = 0; i < cfg.growthCount; i++) {
        const p = rndPos(true);
        objs.push({
            type: 'growth', x: p.x, y: p.y, r: 15,
            vx: 0, vy: 0.03, alive: true,
            color: '#e8ff47', points: 50, emoji: '⭐',
            img: loadImage(TYPE_IMAGES.growth),
        });
    }

    // Speed
    for (let i = 0; i < cfg.speedupCount; i++) {
        const p = rndPos(false);
        objs.push({
            type: 'speedup', x: p.x, y: p.y, r: 14,
            vx: 0, vy: 0.04, alive: true,
            color: '#ff9a47', points: 30, emoji: '⚡', duration: 7,
            img: loadImage(TYPE_IMAGES.speedup),
        });
    }

    // Freeze
    for (let i = 0; i < cfg.freezeCount; i++) {
        const p = rndPos(false);
        objs.push({
            type: 'freeze', x: p.x, y: p.y, r: 14,
            vx: 0, vy: 0.04, alive: true,
            color: '#47c8ff', points: 40, emoji: '❄️', duration: 9,
            img: loadImage(TYPE_IMAGES.freeze),
        });
    }

    // Citronela
    for (let i = 0; i < cfg.citronelaCount; i++) {
        const p = rndPos(false);

        objs.push({
            type: 'citronela',
            x: p.x,
            y: p.y,
            r: 18,

            vx: 0,
            vy: 0.03,

            alive: true,

            color: '#7dff8a',
            points: 120,

            emoji: '🟢',

            duration: 10,

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
    const dt = Math.min(rawDt, 2.5); // limitar spike de dt
    lastTime = ts;

    if (state === 'paused') { renderFrame(); return; }
    if (state !== 'playing') return;

    update(dt);
    renderFrame();
}


// ═══════════════════════════════════════════════
//  UPDATE (física mejorada, velocidad reducida)
// ═══════════════════════════════════════════════
function update(dt) {
    // ── Movimiento del jugador ──────────────────
    // Velocidades base reducidas y más suaves
    const MAX_SPEED =
        activePowerups.citronela > 0
            ? 9.6
            : activePowerups.speed > 0
                ? 4.2
                : 2.4; const ACCEL = 0.07;   // aceleración hacia el cursor
    const FRICTION = 0.88;   // fricción (cuánto se frena)

    // Destino en coordenadas mundo
    const targetWX = mouseX + camX;
    const targetWY = mouseY + camY + 48;

    const dx = targetWX - player.x;
    const dy = targetWY - player.y;
    const dist2 = dx * dx + dy * dy;

    // Solo acelera si el cursor está suficientemente lejos
    const minDist = player.r * 0.6;
    if (dist2 > minDist * minDist) {
        const dist = Math.sqrt(dist2);
        const nx = dx / dist; // normal
        const ny = dy / dist;
        // Aceleración proporcional a la distancia (hasta MAX_SPEED)
        const force = Math.min(dist * 0.008, MAX_SPEED) * ACCEL;
        player.vx += nx * force * dt * 60;
        player.vy += ny * force * dt * 60;
    }

    // Fricción
    player.vx *= Math.pow(FRICTION, dt);
    player.vy *= Math.pow(FRICTION, dt);

    // Limitar velocidad máxima
    const spd2 = player.vx * player.vx + player.vy * player.vy;
    if (spd2 > MAX_SPEED * MAX_SPEED) {
        const spd = Math.sqrt(spd2);
        player.vx = (player.vx / spd) * MAX_SPEED;
        player.vy = (player.vy / spd) * MAX_SPEED;
    }

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Rebote en bordes del mundo
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

        obj.x += obj.vx * dt * freezeFactor;
        obj.y += obj.vy * dt * freezeFactor;

        // Wrap horizontal
        if (obj.x < -obj.r) obj.x = WORLD_W + obj.r;
        if (obj.x > WORLD_W + obj.r) obj.x = -obj.r;
        // Rebote vertical
        if (obj.y > WORLD_H - obj.r) { obj.y = WORLD_H - obj.r; obj.vy *= -0.4; }
        if (obj.y < obj.r) { obj.y = obj.r; obj.vy = Math.abs(obj.vy) || 0.06; }

        // Colisión jugador-objeto
        const odx = obj.x - player.x;
        const ody = obj.y - player.y;
        const cdist2 = odx * odx + ody * ody;
        const canAbsorb = obj.type !== 'standard' || obj.r <= player.r * 1.08;
        const absorbRange = player.r + obj.r * 0.65;

        if (cdist2 < absorbRange * absorbRange && canAbsorb) {
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

    // ── Powerup timers ────────────────────────────
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
    obj.alive = false;
    const big = obj.r > player.r * 0.65;
    playAbsorb(big);
    if (big) vibrate([30, 15, 30]);

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
        case 'standard':
            absorbed++;
            player.r += cfg.growthPerObject * 0.4;
            showFloat(`+${obj.points}`, obj.x, obj.y, '#e8ff47');
            if (absorbed >= cfg.quota) endGame(true);
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
        case 'citronela':

            // duración
            activePowerups.citronela = obj.duration * 60;

            // crecer 25%
            player.r *= 1.25;

            playPowerup();

            vibrate([120, 40, 120]);

            showFloat(
                '🟢 CITRONELA!',
                obj.x,
                obj.y,
                '#7dff8a'
            );

            updatePowerupBar();

            break;
    }

    updateHUD();
}

function showFloat(text, wx, wy, color = '#e8ff47') {
    if (floatCount >= maxFloats) {
        const old = document.querySelector('.float-text');
        if (old) {
            old.remove();
            floatCount = Math.max(0, floatCount - 1);
        }
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
    setTimeout(() => {
        el.remove();
        floatCount = Math.max(0, floatCount - 1);
    }, 950);
}

function renderGrid() {
    if (!gridCtx || !gridDirty) return;

    const gs = perfProfile.gridSize;
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.fillStyle = perfProfile.lowQuality ? 'rgba(255,255,255,0.016)' : 'rgba(255,255,255,0.022)';

    for (let x = 0; x < gridCanvas.width; x += gs) {
        for (let y = 0; y < gridCanvas.height; y += gs) {
            gridCtx.beginPath();
            gridCtx.arc(x, y, 1.5, 0, Math.PI * 2);
            gridCtx.fill();
        }
    }

    gridDirty = false;
}

function renderBackground() {
    if (!bgCtx || !bgDirty) return;
    const W = bgCanvas.width;
    const H = bgCanvas.height;
    bgCtx.clearRect(0, 0, W, H);

    if (perfProfile.showBgGradient) {
        const bgGrad = bgCtx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H));
        bgGrad.addColorStop(0, '#12101e');
        bgGrad.addColorStop(1, '#070610');
        bgCtx.fillStyle = bgGrad;
    } else {
        bgCtx.fillStyle = '#0b0a12';
    }

    bgCtx.fillRect(0, 0, W, H);
    bgDirty = false;
}


// ═══════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════
function renderFrame() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.drawImage(bgCanvas, 0, 0);

    ctx.drawImage(gridCanvas, 0, 0);

    ctx.save();
    ctx.translate(-camX, -camY);

    // Borde del mundo
    ctx.strokeStyle = 'rgba(124,58,237,0.5)';
    ctx.lineWidth = 3;
    ctx.shadowBlur = perfProfile.lowQuality ? 0 : 18;
    ctx.shadowColor = '#7c3aed';
    ctx.strokeRect(2, 2, WORLD_W - 4, WORLD_H - 4);
    ctx.shadowBlur = 0;

    // Objetos
    renderObjects();

    // Partículas
    renderParticles();

    // Jugador
    renderPlayer();

    ctx.restore();
}

function renderObjects() {
    const W = canvas.width, H = canvas.height;
    const lowQuality = perfProfile.lowQuality || objects.length > 120;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    for (const obj of objects) {
        if (!obj.alive) continue;

        // Culling
        const sx = obj.x - camX;
        const sy = obj.y - camY;
        if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) continue;

        // Efecto de profundidad: objetos más abajo = más grandes y opacos
        const depthT = obj.y / WORLD_H;              // 0 (top) .. 1 (bottom)
        const depthScale = 1.4 + depthT * 1.0;
        const dr = obj.r * depthScale * 1.5;
        const alpha = 0.55 + depthT * 0.45;

        ctx.save();
        ctx.globalAlpha = alpha;

        // En lowQuality mantenemos imagen (sin efectos caros) para que no se vean "bolas".
        if (obj.img && obj.img.complete && obj.img.naturalWidth > 0) {
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, dr, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(obj.img, obj.x - dr, obj.y - dr, dr * 2, dr * 2);

            if (!lowQuality) {
                ctx.globalAlpha = alpha * 0.7;
                ctx.strokeStyle = obj.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, dr, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Ruta ligera cuando hay muchos objetos en pantalla
        } else if (lowQuality) {
            ctx.fillStyle = obj.color;
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, dr, 0, Math.PI * 2);
            ctx.fill();

        } else {
            // Sin imagen: círculo con gradiente + emoji
            if (!lowQuality) {
                ctx.shadowBlur = 8;
                ctx.shadowColor = obj.color;

                const grad = ctx.createRadialGradient(obj.x - dr * 0.25, obj.y - dr * 0.25, 0, obj.x, obj.y, dr);
                grad.addColorStop(0, obj.color);
                grad.addColorStop(1, 'rgba(0,0,0,0.55)');
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = obj.color;
            }
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, dr, 0, Math.PI * 2);
            ctx.fill();

            if (!lowQuality) {
                ctx.shadowBlur = 0;
                ctx.strokeStyle = obj.color;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Emoji centrado
                ctx.font = `${Math.max(10, dr * 1.05)}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.globalAlpha = alpha;
                ctx.fillText(obj.emoji, obj.x, obj.y);
            }
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
        activePowerups.citronela > 0
            ? '#7dff8a'
            : activePowerups.speed > 0
                ? '#ff9a47'
                : activePowerups.freeze > 0
                    ? '#47c8ff'
                    : '#7c3aed';
    const progress = cfg ? Math.min(1, absorbed / Math.max(1, cfg.quota)) : 0;

    ctx.save();

    // Glow exterior
    ctx.shadowBlur = perfProfile.lowQuality ? 14 : 28;
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

    // Borde / rim
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.stroke();

    // Arco de progreso hacia la cuota del nivel
    ctx.strokeStyle = '#e8ff47';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.shadowBlur = perfProfile.lowQuality ? 0 : 8;
    ctx.shadowColor = '#e8ff47';
    ctx.beginPath();
    ctx.arc(px, py, pr + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Porcentaje interior
    const fontSize = Math.max(8, pr * 0.36);
    ctx.fillStyle = '#e8ff47';
    ctx.font = `bold ${fontSize}px 'Space Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(progress * 100)}%`, px, py);

    // Partículas orbitales internas (sensación de succión)
    if (!perfProfile.lowQuality) {
        ctx.globalAlpha = 0.35;
        const now = Date.now() / 1800;
        for (let i = 0; i < 4; i++) {
            const angle = now + (Math.PI / 2) * i;
            const sr = pr * 0.48;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(px + Math.cos(angle) * sr, py + Math.sin(angle) * sr, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

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
        ? `Nivel ${currentLevel} completado · ${score} pts`
        : `${absorbed}/${cfg.quota} objetos · ${score} pts`;

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

hudPauseBtn.addEventListener('click', togglePause);
btnResume.addEventListener('click', resumeGame);
btnPauseMenu.addEventListener('click', goToMenu);
btnEndMenu.addEventListener('click', goToMenu);
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
canvas.addEventListener('pointerdown', e => {
    ensureAudio();
    setMouse(e.clientX, e.clientY);
}, { passive: true });

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
        hudPauseBtn.textContent = '▶';
        pauseOverlay.classList.add('visible');
    }
});