document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN ---
    const startDate = new Date('2024-07-16'); 
    const totalPhotos = 16;
    const moments = [
        "Nuestro comienzo", "Esa mirada", "Risas infinitas", "Cena favorita", 
        "Escapada juntos", "Tú y yo", "Complicidad", "Paz a tu lado", 
        "Tus abrazos", "Aventuras", "Magia pura", "Mi hogar", 
        "Siempre así", "Inolvidable", "Te quiero", "Por más días"
    ];

    let currentAudio = null;
    let currentOpenPage = 0;
    let startX = 0;
    
    const pages = document.querySelectorAll('.page');
    const book = document.getElementById('book');
    const overlay = document.getElementById('photo-overlay');
    const overlayContent = document.getElementById('overlay-content');

    // 1. CONTADOR
    function updateCounter() {
        const diff = new Date() - startDate;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const el = document.getElementById('days-number');
        if(el) el.textContent = days;
    }

    // 2. CARGAR FOTOS
    function loadGallery() {
        for (let i = 1; i <= totalPhotos; i++) {
            const gridNum = Math.ceil(i / 4);
            const container = document.getElementById(`grid-${gridNum}`);
            if (!container) continue;

            const randomRot = (Math.random() * 4 - 2).toFixed(2);

            const photoDiv = document.createElement('div');
            photoDiv.className = 'polaroid-container';
            photoDiv.innerHTML = `
                <div class="polaroid-inner" style="--r: ${randomRot}deg">
                    <div class="photo-front">
                        <img src="fotos/${i}.jpeg" alt="Foto ${i}" onerror="this.src='https://via.placeholder.com/150?text=Error'">
                    </div>
                    <div class="photo-back">
                        <p>${moments[i-1] || '❤️'}</p>
                    </div>
                </div>
            `;

            const audioPath = `sonidos/audio${i}.mp3`;
            const audio = new Audio(audioPath);
            
            photoDiv.onclick = (e) => {
                e.stopPropagation();
                openPhotoZoom(`fotos/${i}.jpeg`, moments[i-1] || '', audio);
            };

            container.appendChild(photoDiv);
        }
    }

    // 3. ZOOM
    function openPhotoZoom(imgSrc, text, audioObj) {
        if(currentAudio) currentAudio.pause();
        audioObj.play().catch(e => console.log("Audio bloqueado"));
        currentAudio = audioObj;

        overlayContent.innerHTML = `
            <div class="polaroid-container overlay-polaroid" onclick="this.querySelector('.polaroid-inner').classList.toggle('is-flipped')">
                <div class="polaroid-inner">
                    <div class="photo-front"><img src="${imgSrc}"></div>
                    <div class="photo-back"><p>${text}</p></div>
                </div>
            </div>
        `;
        overlay.classList.add('active');
    }

    if(overlay) {
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
                overlayContent.innerHTML = '';
                if(currentAudio) currentAudio.pause();
            }
        };
    }

    // 4. GESTOS (SWIPE)
    document.addEventListener('touchstart', e => startX = e.touches[0].clientX);
    document.addEventListener('mousedown', e => startX = e.clientX);
    document.addEventListener('touchend', e => handleSwipe(e.changedTouches[0].clientX));
    document.addEventListener('mouseup', e => handleSwipe(e.clientX));

    function handleSwipe(endX) {
        if(overlay && overlay.classList.contains('active')) return;

        const threshold = 50;
        const diff = startX - endX;

        if (Math.abs(diff) < threshold) return;

        // Siguiente Página
        if (diff > 0 && currentOpenPage < pages.length) { 
            pages[currentOpenPage].classList.add('flipped');
            pages[currentOpenPage].style.zIndex = 10 + currentOpenPage; 
            currentOpenPage++;
        } 
        // Anterior Página
        else if (diff < 0 && currentOpenPage > 0) { 
            currentOpenPage--;
            pages[currentOpenPage].classList.remove('flipped');
            setTimeout(() => {
                if(!pages[currentOpenPage].classList.contains('flipped')) {
                    pages[currentOpenPage].style.zIndex = pages.length - currentOpenPage;
                }
            }, 300);
        }
        
        updateBookPosition();
    }

    // --- 5. CENTRADO DEL LIBRO (CORREGIDO) ---
    function updateBookPosition() {
        const isClosedStart = currentOpenPage === 0;
        const isClosedEnd = currentOpenPage === pages.length;
        
        // Si el libro está en medio (abierto), lo movemos 50% a la derecha.
        // Esto coloca el "lomo" (borde izquierdo del contenedor) en el centro de la pantalla.
        // Funciona en móvil Y en escritorio.
        let moveX = "0%";
        
        if (!isClosedStart && !isClosedEnd) {
            moveX = "50%";
        } 
        else if (isClosedEnd) {
            // Opcional: Si quieres ver la contraportada centrada
            moveX = "100%"; 
        }

        book.style.transform = `translateX(${moveX})`;
    }

    function initBook() {
        pages.forEach((page, index) => {
            page.style.zIndex = pages.length - index;
        });
        updateCounter();
        loadGallery();
    }

    initBook();
    window.addEventListener('resize', updateBookPosition);
});