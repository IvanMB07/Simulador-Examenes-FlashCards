const startDate = new Date('2024-07-16');
let currentAudio = null;
const pages = document.querySelectorAll('.page');
const book = document.getElementById('book');

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

        const audio = new Audio(`sonidos/audio${i}.mp3`);
        photoElement.onclick = (e) => {
            e.stopPropagation();
            photoElement.querySelector('.polaroid-inner').classList.toggle('is-flipped');
            if(currentAudio) currentAudio.pause();
            audio.play();
            currentAudio = audio;
        };

        container.appendChild(photoElement);
    }
}

let startX = 0;
let currentOpenPage = 0;

document.addEventListener('touchstart', e => startX = e.touches[0].clientX);
document.addEventListener('mousedown', e => startX = e.clientX);

document.addEventListener('touchend', e => handleSwipe(e.changedTouches[0].clientX));
document.addEventListener('mouseup', e => handleSwipe(e.clientX));

function handleSwipe(endX) {
    const threshold = 60;
    const diff = startX - endX;

    if (Math.abs(diff) < threshold) return;

    if (diff > 0 && currentOpenPage < pages.length) { 
        // Girar página (Siguiente) - Ajustamos zIndex para que no desaparezca
        pages[currentOpenPage].style.zIndex = 10 + currentOpenPage;
        pages[currentOpenPage].classList.add('flipped');
        currentOpenPage++;
    } else if (diff < 0 && currentOpenPage > 0) { 
        // Volver página (Anterior)
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