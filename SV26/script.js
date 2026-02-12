document.addEventListener('DOMContentLoaded', () => {
    
    // --- DATOS DEL ÁLBUM ---
    const startDate = new Date('2024-07-16'); // ¡Pon tu fecha aquí!
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
    let currentPage = 0; // 0 = Cerrado inicio, 1 = Pág 1 abierta, etc.
    const totalPages = pages.length; // 4 páginas (portada, 2 pliegos, contraportada)

    // 1. INICIALIZAR Z-INDEX
    // Las páginas deben estar ordenadas para que la portada esté encima
    pages.forEach((page, i) => {
        page.style.zIndex = totalPages - i;
    });

    // 2. CONTADOR DE DÍAS
    const diff = new Date() - startDate;
    document.getElementById('days-count').textContent = Math.floor(diff / (1000 * 60 * 60 * 24));

    // 3. GENERAR LAS FOTOS
    for (let i = 1; i <= totalPhotos; i++) {
        // Calcular en qué grid va la foto (1-4 -> grid1, 5-8 -> grid2...)
        const gridId = `grid-${Math.ceil(i / 4)}`;
        const container = document.getElementById(gridId);
        if (!container) continue;

        const imgIndex = i;
        const rot = (Math.random() * 6 - 3).toFixed(1); // Rotación sutil
        
        const card = document.createElement('div');
        card.className = 'polaroid';
        card.style.setProperty('--r', `${rot}deg`);
        // Usamos .jpeg como pediste
        card.innerHTML = `<img src="fotos/${imgIndex}.jpeg" alt="Foto ${imgIndex}" onerror="this.src='https://via.placeholder.com/150/ccc/333?text=IMG+${imgIndex}'">`;

        // --- CLIC EN FOTO PEQUEÑA ---
        card.addEventListener('click', (e) => {
            e.stopPropagation(); // ¡IMPORTANTE! Evita que el libro pase de página
            openZoom(imgIndex, phrases[imgIndex - 1]);
        });

        container.appendChild(card);
    }

    // 4. FUNCIÓN DE ZOOM (ABRIR FOTO GIGANTE)
    function openZoom(index, text) {
        // Audio
        if (currentAudio) currentAudio.pause();
        const audio = new Audio(`sonidos/audio${index}.mp3`);
        audio.play().catch(() => {}); // Ignorar error si no hay interacción previa
        currentAudio = audio;

        // Crear HTML de la tarjeta gigante
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

        // Mostrar overlay
        overlay.classList.add('active');

        // Añadir evento de giro a la tarjeta NUEVA creada
        const bigCard = zoomContent.querySelector('.big-card');
        bigCard.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita cerrar el overlay
            bigCard.classList.toggle('flipped');
        });
    }

    // CERRAR ZOOM (Clic en fondo negro)
    overlay.addEventListener('click', () => {
        overlay.classList.remove('active');
        if (currentAudio) currentAudio.pause();
        zoomContent.innerHTML = ''; // Limpiar
    });

    // 5. NAVEGACIÓN DEL LIBRO (TOUCH & CLICK)
    let startX = 0;

    document.addEventListener('touchstart', e => startX = e.touches[0].clientX);
    document.addEventListener('mousedown', e => startX = e.clientX);

    document.addEventListener('touchend', e => handleSwipe(e.changedTouches[0].clientX));
    document.addEventListener('mouseup', e => handleSwipe(e.clientX));

    function handleSwipe(endX) {
        // Si el zoom está abierto, no movemos el libro
        if (overlay.classList.contains('active')) return;

        const diff = startX - endX;
        if (Math.abs(diff) < 50) return; // Movimiento muy corto, ignorar (es un clic)

        if (diff > 0) nextPage(); // Deslizar izquierda -> Siguiente
        else prevPage();          // Deslizar derecha -> Anterior
    }

    function nextPage() {
        if (currentPage < totalPages) {
            // Girar página actual
            const page = document.getElementById(`p${currentPage + 1}`);
            page.style.transform = "rotateY(-180deg)";
            
            // Ajuste Z-Index para que se vea bien al caer
            // (La página que giramos debe quedar encima de las anteriores pero debajo de las siguientes)
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
            
            // Restaurar Z-Index original con delay para la animación
            setTimeout(() => {
                page.style.zIndex = totalPages - currentPage;
            }, 300);
            
            updateBookCenter();
        }
    }

    // --- 6. CENTRADO INTELIGENTE DEL LOMO (LA SOLUCIÓN CLAVE) ---
    function updateBookCenter() {
        // Si el libro está cerrado (inicio) o terminado (final), centro = 0
        // Si el libro está abierto (páginas intermedias), centro = 50% a la derecha
        // Esto coloca el "lomo" en el centro de la pantalla
        
        const isClosedStart = currentPage === 0;
        const isClosedEnd = currentPage === totalPages;
        
        let moveX = "50%"; // Por defecto, abierto y centrado en el lomo

        if (isClosedStart) moveX = "0%"; // Centrado en la portada
        if (isClosedEnd) moveX = "100%"; // Centrado en la contraportada (opcional, o 0%)

        // Aplicar movimiento
        book.style.transform = `translateX(${moveX})`;
    }

});