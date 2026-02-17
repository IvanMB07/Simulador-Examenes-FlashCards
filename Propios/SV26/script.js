document.addEventListener('DOMContentLoaded', () => {
    
    // --- DATOS DEL ÁLBUM ---
    const startDate = new Date('2024-07-16'); 
    const totalPhotos = 16;
    const phrases = [
        "Esta es porque verte feliz en sitios así me hace infinitamente feliz, y también porque quizá seas mi Medialuna, o mi Polaris o Supernova, quién sabe.", 
        "Esta es porque me encanta lo bien que salimos y lo bien que nos lo pasamos ese día.", 
        "Esta no creo que necesite explicación; es tu sitio y me gusta que lo compartas conmigo.", 
        "Esta es porque, no sé, creo que siempre nos ha representado. Además, se la puse a la primera canción que te escribí.",
        "Esta es porque fue probablemente la primera foto así, seria, que nos hicimos. Es muy bonita y ya, xd.", 
        "Esta es porque, aunque no sea un 5 estrellas, nunca falla y siempre estará ahí para nosotros, como tú para mí y yo para ti.", 
        "Esta es porque fue un día inolvidable y te estoy muy agradecido por acompañarme a tantos conciertos de cantantes que no te gustaban, pero que has empezado a escuchar al estar conmigo.", 
        "Esta es porque creo que podríamos llamarla \"nuestra foto\".",
        "Esta es porque simplemente sales guapísima, y así cuando la veas te puedes hacer una idea de cómo te ves a través de mis ojos.", 
        "Esta es porque, aunque contigo no sea capaz de dormir del tirón toda la noche, es algo que no se puede describir; es algo indescriptible lo que se siente al estar a tu lado por las noches.", 
        "Esta es porque gracias a él podríamos decir que comenzó todo y, como sabes, es una película muy importante para mí, y fue una experiencia increíble.", 
        "Esta es porque me apetece, un besazo.",
        "Esta es porque la vi y fue de cuando empezamos, dos jóvenes alocados por aquel entonces... ahora no tanto, o sí (tristemente no).", 
        "Esta es porque, aunque no terminó como nos hubiera gustado, mirándolo con perspectiva fue un viaje inolvidable. Fue nuestro primer viaje de novios, aunque no solos, ya tocará (AHORRA).", 
        "Esta es porque creo que es de las cosas que más nos unió desde el principio de todo, desde Villasequilla. Y el resto, pues bueno, es historia como se suele decir.", 
        "Esta es porque me lo pasé muy bien en tu pueblo y pudimos arreglar un poco las cosas con tu amiga. Aunque no me termina de convencer el resto, lo importante es que me lo pasé genial ese día."
    ];

    const photoDates = [
        "31/01/2026", 
        "20/06/2025", 
        "31/08/2023", 
        "11/09/2023", 
        "07/10/2023", 
        "06/12/2023", 
        "26/05/2024", 
        "14/07/2024", 
        "12/09/2024", 
        "13/09/2024", 
        "17/09/2024", 
        "24/11/2024", 
        "17/07/2023", 
        "31/07/2025", 
        "28/07/2023", 
        "27/08/2025"
    ]
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

// 2. CONTADOR (Corregido)
    const today = new Date();
    const diffTime = today - startDate; 
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const counterElement = document.getElementById('days-count');
    if (counterElement) {
        counterElement.textContent = diffDays;
    }

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
            openZoom(imgIndex, phrases[imgIndex - 1], photoDates[imgIndex - 1]);
        });

        container.appendChild(card);
    }

    // 4. ZOOM
    function openZoom(index, text, date) {
        if (currentAudio) currentAudio.pause();
        
        // Usamos la carpeta "musica" como me has dicho
        const audio = new Audio(`musica/${index}.mp3`);
        audio.play().catch(() => {});
        currentAudio = audio;

        zoomContent.innerHTML = `
            <div class="big-card">
                <div class="big-face big-front">
                    <div class="zoom-date">${date}</div>
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

    // --- LÓGICA DE INTERRUPTOR SIMPLE ---
const infoBtn = document.getElementById('info-btn');
const infoTooltip = document.getElementById('info-tooltip');

if (infoBtn && infoTooltip) {
    infoBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que el clic "atraviese" el botón
        
        // El 'toggle' añade la clase si no está, y la quita si está. 
        // Es el interruptor perfecto.
        infoBtn.classList.toggle('active');
        infoTooltip.classList.toggle('active');
    });
}

// Si pulsas en cualquier otra parte del libro, se apaga todo
document.addEventListener('click', () => {
    infoBtn.classList.remove('active');
    infoTooltip.classList.remove('active');
});

    

});