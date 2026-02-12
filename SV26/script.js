document.addEventListener('DOMContentLoaded', () => {
    
    // --- DATOS DEL ÁLBUM ---
    const startDate = new Date('2024-07-16'); 
    const totalPhotos = 16;
    const phrases = [
        "Nuestro comienzo", "Esa mirada", "Risas locas", "Cena romántica",
        "Escapada juntos", "Solo tú y yo", "Complicidad", "Paz absoluta",
        "Abrazos fuertes", "Aventuras", "Magia pura", "Mi hogar",
        "Siempre juntos", "Inolvidable", "Te amo", "Por mil más"
    ];

    // --- ELEMENTOS ---
    const book = document.getElementById('book');
    const pages = document.querySelectorAll('.page');
    const overlay = document.getElementById('zoom-overlay');
    const zoomContent = document.getElementById('zoom-content');
    let currentAudio = null;
    let currentPage = 0; 
    const totalPages = pages.length; 

    // 1. Z-INDEX
    pages.forEach((page, i) => {
        page.style.zIndex = totalPages - i;
    });

    // 2. CONTADOR
    const diff = new Date() - startDate;
    document.getElementById('days-count').textContent = Math.floor(diff / (1000 * 60 * 60 * 24));

    // 3. GENERAR FOTOS
    for (let i = 1; i <= totalPhotos; i++) {
        const gridId = `grid-${Math.ceil(i / 4)}`;
        const container = document.getElementById(gridId);
        if (!container) continue;

        const imgIndex = i;
        const rot = (Math.random() * 6 - 3).toFixed(1); 
        
        const card = document.createElement('div');
        card.className = 'polaroid';
        card.style.setProperty('--r', `${rot}deg`);
        card.innerHTML = `<img src="fotos/${imgIndex}.jpeg" alt="Foto ${imgIndex}" onerror="this.src='https://via.placeholder.com/150/ccc/333?text=IMG+${imgIndex}'">`;

        card.addEventListener('click', (e) => {
            e.stopPropagation(); 
            openZoom(imgIndex, phrases[imgIndex - 1]);
        });

        container.appendChild(card);
    }

    // 4. ZOOM
    function openZoom(index, text) {
        if (currentAudio) currentAudio.pause();
        const audio = new Audio(`sonidos/audio${index}.mp3`);
        audio.play().catch(() => {});
        currentAudio = audio;

        zoomContent.innerHTML = `
            <div class="big-card">
                <div class="big-face big-front">
                    <img src="fotos/${index}.jpeg">
                </div>
                <div class="big-face big-back">
                    ${text}
                </div>
            </div>
        `;

        overlay.classList.add('active');

        const bigCard = zoomContent.querySelector('.big-card');
        bigCard.addEventListener('click', (e) => {
            e.stopPropagation(); 
            bigCard.classList.toggle('flipped');
        });
    }

    overlay.addEventListener('click', () => {
        overlay.classList.remove('active');
        if (currentAudio) currentAudio.pause();
        zoomContent.innerHTML = ''; 
    });

    // 5. NAVEGACIÓN
    let startX = 0;

    document.addEventListener('touchstart', e => startX = e.touches[0].clientX);
    document.addEventListener('mousedown', e => startX = e.clientX);

    document.addEventListener('touchend', e => handleSwipe(e.changedTouches[0].clientX));
    document.addEventListener('mouseup', e => handleSwipe(e.clientX));

    function handleSwipe(endX) {
        if (overlay.classList.contains('active')) return;

        const diff = startX - endX;
        if (Math.abs(diff) < 50) return; 

        if (diff > 0) nextPage(); 
        else prevPage();          
    }

    function nextPage() {
        if (currentPage < totalPages) {
            const page = document.getElementById(`p${currentPage + 1}`);
            page.style.transform = "rotateY(-180deg)";
            page.style.zIndex = 10 + currentPage; 
            currentPage++;
            updateBookCenter();
        }
    }

    function prevPage() {
        if (currentPage > 0) {
            currentPage--;
            const page = document.getElementById(`p${currentPage + 1}`);
            page.style.transform = "rotateY(0deg)";
            setTimeout(() => {
                page.style.zIndex = totalPages - currentPage;
            }, 300);
            updateBookCenter();
        }
    }

    // 6. CENTRADO
    function updateBookCenter() {
        const isClosedStart = currentPage === 0;
        const isClosedEnd = currentPage === totalPages;
        
        let moveX = "50%"; 

        if (isClosedStart) moveX = "0%"; 
        if (isClosedEnd) moveX = "100%"; 

        book.style.transform = `translateX(${moveX})`;
    }

    const infoBtn = document.getElementById('info-btn');
    
    infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        infoBtn.focus();
    });
    
    document.addEventListener('click', () => {
        infoBtn.blur();
    });

});