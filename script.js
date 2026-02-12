const startDate = new Date('2024-07-16');
let currentAudio = null;
const pages = document.querySelectorAll('.page');
const book = document.getElementById('book');
const overlay = document.getElementById('photo-overlay');
const overlayContent = document.getElementById('overlay-content');

function updateCounter() {
    const diff = new Date() - startDate;
    document.getElementById('days-number').textContent = Math.floor(diff / (1000 * 60 * 60 * 24));
}

const moments = [
    "Nuestro comienzo", "Esa mirada", "Risas infinitas", "Cena favorita", 
    "Escapada juntos", "Tú y yo", "Complicidad", "Paz a tu lado", 
    "Tus abrazos", "Aventuras", "Magia pura", "Mi hogar", 
    "Siempre así", "Inolvidable", "Te quiero", "Por más días"
];

function loadGallery() {
    for (let i = 1; i <= 16; i++) {
        const gridId = `grid-${Math.ceil(i / 4)}`;
        const container = document.getElementById(gridId);
        
        // Creamos la foto pequeña normal
        const photoMarkup = `
            <div class="polaroid-container">
                <div class="polaroid-inner" style="--r: ${(Math.random() * 4 - 2)}deg">
                    <div class="photo-front">
                        <img src="fotos/${i}.jpeg" alt="Recuerdo ${i}">
                    </div>
                    <div class="photo-back">
                        <p>${moments[i-1]}</p>
                    </div>
                </div>
            </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = photoMarkup;
        const photoElement = tempDiv.firstElementChild;

        // --- CAMBIO PRINCIPAL AQUÍ ---
        // Al hacer clic en la foto pequeña, ABRIMOS EL ZOOM
        photoElement.onclick = (e) => {
            e.stopPropagation();
            // Llamamos a la nueva función de zoom pasando los datos de esta foto
            openPhotoZoom(`fotos/${i}.jpeg`, moments[i-1], i);
        };

        container.appendChild(photoElement);
    }
}

// --- NUEVA FUNCIÓN: ABRIR ZOOM ---
function openPhotoZoom(imgSrc, text, id) {
    // 1. Gestionar audio
    const audio = new Audio(`sonidos/audio${id}.mp3`);
    if(currentAudio) currentAudio.pause();
    audio.play();
    currentAudio = audio;

    // 2. Crear la estructura de la foto GIGANTE
    // Nota: Le añadimos un onclick interno para que ella misma se pueda girar
    overlayContent.innerHTML = `
        <div class="polaroid-container overlay-polaroid" onclick="this.querySelector('.polaroid-inner').classList.toggle('is-flipped')">
            <div class="polaroid-inner">
                <div class="photo-front">
                        <img src="${imgSrc}">
                </div>
                <div class="photo-back">
                    <p>${text}</p>
                </div>
            </div>
        </div>
    `;
    
    // 3. Mostrar el overlay
    overlay.classList.add('active');
}

// --- NUEVA FUNCIÓN: CERRAR ZOOM ---
// Si pulsamos en el fondo oscuro (fuera de la foto), cerramos.
overlay.onclick = (e) => {
    if (e.target === overlay) {
        overlay.classList.remove('active');
        overlayContent.innerHTML = ''; // Limpiamos el contenido
        if(currentAudio) currentAudio.pause(); // Opcional: parar audio al cerrar
    }
};


// --- Lógica de Deslizamiento (Se mantiene igual) ---
let startX = 0;
let currentOpenPage = 0;

document.addEventListener('touchstart', e => startX = e.touches[0].clientX);
document.addEventListener('mousedown', e => startX = e.clientX);
document.addEventListener('touchend', e => handleSwipe(e.changedTouches[0].clientX));
document.addEventListener('mouseup', e => handleSwipe(e.clientX));

function handleSwipe(endX) {
    // Si el overlay está abierto, no permitimos deslizar el libro
    if(overlay.classList.contains('active')) return;

    const threshold = 60;
    const diff = startX - endX;

    if (Math.abs(diff) < threshold) return;

    if (diff > 0 && currentOpenPage < pages.length) { 
        pages[currentOpenPage].style.zIndex = 10 + currentOpenPage;
        pages[currentOpenPage].classList.add('flipped');
        currentOpenPage++;
    } else if (diff < 0 && currentOpenPage > 0) { 
        currentOpenPage--;
        pages[currentOpenPage].classList.remove('flipped');
        setTimeout(() => {
            pages[currentOpenPage].style.zIndex = pages.length - currentOpenPage;
        }, 300);
    }
    
    book.style.transform = (currentOpenPage > 0 && currentOpenPage < pages.length) ? 
                           "translateX(25%)" : "translateX(0)";
}

function initBook() {
    pages.forEach((page, index) => {
        page.style.zIndex = pages.length - index;
    });
}

initBook();
updateCounter();
loadGallery();