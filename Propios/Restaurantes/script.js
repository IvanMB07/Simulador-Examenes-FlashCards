// ==========================================
// VARIABLES GLOBALES Y CONFIGURACIÓN
// ==========================================
let restaurants = [];
let editingId = null;
let useFirebase = false;

// ==========================================
// SISTEMA DE ALMACENAMIENTO (FIREBASE / LOCALSTORAGE)
// ==========================================

function initStorage() {
    // Detecta si Firebase se ha cargado en el HTML
    useFirebase = Boolean(window.firebaseDB && window.firebaseRef);
}

async function loadRestaurants() {
    if (useFirebase) {
        try {
            const dbRef = window.firebaseRef(window.firebaseDB, 'restaurants');
            const snapshot = await window.firebaseGet(dbRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                restaurants = Object.values(data);
            } else {
                restaurants = [];
            }
        } catch (error) {
            console.warn('Firebase no disponible o error, usando localStorage');
            restaurants = JSON.parse(localStorage.getItem('restaurants')) || [];
        }
    } else {
        restaurants = JSON.parse(localStorage.getItem('restaurants')) || [];
    }
    
    // Migración de datos: asegurar que todos tengan orderItems como array
    restaurants.forEach(r => {
        if (!('orderItems' in r) || !Array.isArray(r.orderItems)) {
            r.orderItems = [];
        }
    });
    
    // Renderizado inicial (sin filtro)
    renderRestaurants();
}

async function saveRestaurantsToStorage() {
    if (useFirebase) {
        const dbRef = window.firebaseRef(window.firebaseDB, 'restaurants');
        const data = {};
        restaurants.forEach(r => {
            data[r.id] = r; // Usamos el ID como clave
        });
        await window.firebaseSet(dbRef, data);
    } else {
        localStorage.setItem('restaurants', JSON.stringify(restaurants));
    }
}

function listenFirebaseUpdates() {
    if (!useFirebase) return;
    const dbRef = window.firebaseRef(window.firebaseDB, 'restaurants');
    window.firebaseOnValue(dbRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            restaurants = Object.values(data);
        } else {
            restaurants = [];
        }
        // Recargamos la vista manteniendo el filtro de búsqueda actual si existe
        const currentSearch = document.getElementById('search').value;
        renderRestaurants(currentSearch);
    });
}

// ==========================================
// INICIALIZACIÓN DE LA APP
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    initStorage();
    await loadRestaurants();
    
    setupTabs();
    setupStarRatings();
    setupCustomSelects();
    setupForm();
    setupExcelFunctions(); // Nueva función de Excel
    
    // Listener para actualizaciones en tiempo real
    listenFirebaseUpdates();

    // Listener para Búsqueda
    document.getElementById('search').addEventListener('input', (e) => {
        renderRestaurants(e.target.value);
    });

    // Listener para Ordenación (NUEVO)
    document.getElementById('sort-order').addEventListener('change', () => {
        const searchValue = document.getElementById('search').value;
        renderRestaurants(searchValue);
    });
});

// ==========================================
// TABS (PESTAÑAS)
// ==========================================
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // UI Update
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(`${targetTab}-section`).classList.add('active');
        });
    });
}

// ==========================================
// LÓGICA DE ESTRELLAS (INPUTS)
// ==========================================
function setupStarRatings() {
    const starContainers = document.querySelectorAll('.stars');
    
    starContainers.forEach(container => {
        const stars = container.querySelectorAll('.star');
        const ratingName = container.dataset.rating;
        const hiddenInput = document.getElementById(ratingName);
        
        // Si no hay input oculto, es solo visualización (no hacemos nada)
        if (!hiddenInput) return;

        stars.forEach((star, index) => {
            // Click
            star.addEventListener('click', (e) => {
                handleStarInteraction(e, star, index, hiddenInput, stars, true);
            });
            
            // Hover
            star.addEventListener('mousemove', (e) => {
                handleStarInteraction(e, star, index, hiddenInput, stars, false);
            });
        });
        
        // Mouse leave (reset al valor guardado)
        container.addEventListener('mouseleave', () => {
            const currentValue = parseFloat(hiddenInput.value) || 0;
            updateStarDisplay(stars, currentValue);
        });
    });
}

function handleStarInteraction(e, star, index, input, stars, isClick) {
    // Calculamos si el click fue a la izquierda o derecha del SVG
    // Necesario porque SVG no tiene offsetLeft simple como div
    const svgEl = star.closest('svg') || star; 
    const rect = svgEl.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const starWidth = rect.width;
    
    let value;
    // Mitad izquierda (0-50%) o derecha (50-100%)
    if (clickX < starWidth / 2) {
        value = index + 0.5;
    } else {
        value = index + 1;
    }
    
    if (isClick) {
        input.value = value;
    }
    updateStarDisplay(stars, value);
}

function updateStarDisplay(stars, value) {
    stars.forEach((star, index) => {
        const fullValue = index + 1;
        const halfValue = index + 0.5;
        
        star.classList.remove('active', 'half');
        
        if (value >= fullValue) {
            star.classList.add('active');
        } else if (value >= halfValue) {
            star.classList.add('half');
        }
    });
}

// ==========================================
// FORMULARIO: SELECTORES CUSTOM Y GUARDADO
// ==========================================
function setupCustomSelects() {
    const selects = [
        { main: 'type', custom: 'type-custom' },
        { main: 'subtype', custom: 'subtype-custom' }
    ];
    
    selects.forEach(pair => {
        const mainEl = document.getElementById(pair.main);
        const customEl = document.getElementById(pair.custom);
        
        mainEl.addEventListener('change', () => {
            if (mainEl.value === 'custom') {
                customEl.style.display = 'block';
                customEl.required = true;
            } else {
                customEl.style.display = 'none';
                customEl.required = false;
                customEl.value = '';
            }
        });
    });
}

function setupForm() {
    const form = document.getElementById('restaurant-form');
    const cancelBtn = document.getElementById('cancel-edit');
    const orderItemsField = document.getElementById('order-items');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveRestaurant();
    });
    
    cancelBtn.addEventListener('click', () => {
        resetForm();
    });
    
    // Evitar envío al pulsar Enter en el textarea
    if (orderItemsField) {
        orderItemsField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.stopPropagation();
            }
        });
    }
}

function saveRestaurant() {
    // Recopilar valores
    const typeSelect = document.getElementById('type');
    const typeCustom = document.getElementById('type-custom');
    const subtypeSelect = document.getElementById('subtype');
    const subtypeCustom = document.getElementById('subtype-custom');
    
    // Procesar pedido
    let orderItems = [];
    const orderItemsField = document.getElementById('order-items');
    if (orderItemsField && orderItemsField.value.trim()) {
        orderItems = orderItemsField.value.split('\n').map(item => item.trim()).filter(Boolean);
    }
    
    const restaurant = {
        id: editingId || Date.now(), // ID único basado en fecha
        name: document.getElementById('name').value,
        location: document.getElementById('location').value,
        type: typeSelect.value === 'custom' ? typeCustom.value : typeSelect.value,
        subtype: subtypeSelect.value === 'custom' ? subtypeCustom.value : subtypeSelect.value,
        
        // Puntuaciones
        quality: parseFloat(document.getElementById('quality').value) || 0,
        quantity: parseFloat(document.getElementById('quantity').value) || 0,
        variety: parseFloat(document.getElementById('variety').value) || 0,
        aesthetics: parseFloat(document.getElementById('aesthetics').value) || 0,
        service: parseFloat(document.getElementById('service').value) || 0,
        qualityPrice: parseFloat(document.getElementById('quality-price').value) || 0,
        totalScore: parseFloat(document.getElementById('total-score').value) || 0,
        
        // Extras
        returnVisit: document.querySelector('input[name="return"]:checked')?.value || '',
        timesVisited: parseInt(document.getElementById('times-visited').value) || 0,
        notes: document.getElementById('notes').value,
        reservation: document.getElementById('reservation').value,
        orderItems: orderItems
    };
    
    // Guardar (Nuevo o Edición)
    if (editingId) {
        const index = restaurants.findIndex(r => r.id === editingId);
        if (index !== -1) restaurants[index] = restaurant;
    } else {
        restaurants.push(restaurant);
    }
    
    saveRestaurantsToStorage();
    resetForm();
    
    // Volver a la lista
    document.querySelector('[data-tab="list"]').click();
    renderRestaurants();
}

function resetForm() {
    document.getElementById('restaurant-form').reset();
    document.getElementById('edit-id').value = '';
    editingId = null;
    
    // Resetear visualmente las estrellas
    document.querySelectorAll('.star').forEach(star => {
        star.classList.remove('active', 'half');
    });
    // Resetear inputs ocultos de estrellas
    document.querySelectorAll('.stars + input[type="hidden"]').forEach(input => {
        input.value = '0';
    });
    
    // Resetear selects custom
    document.getElementById('type-custom').style.display = 'none';
    document.getElementById('subtype-custom').style.display = 'none';
    
    // Ocultar cancelar
    document.getElementById('cancel-edit').style.display = 'none';
}

// ==========================================
// EXCEL: EXPORTAR E IMPORTAR
// ==========================================
function setupExcelFunctions() {
    const btnExport = document.getElementById('btn-export');
    const btnImportTrigger = document.getElementById('btn-import-trigger');
    const fileInput = document.getElementById('file-import');

    if(!btnExport || !btnImportTrigger) return;

    // 1. EXPORTAR
    btnExport.addEventListener('click', () => {
        if (restaurants.length === 0) {
            alert("¡No hay restaurantes para exportar!");
            return;
        }

        // Clonamos y formateamos para Excel (arrays a string)
        const dataToExport = restaurants.map(r => ({
            ...r,
            orderItems: r.orderItems ? r.orderItems.join(', ') : '' 
        }));

        // Crear hoja y libro
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Restaurantes");

        // Descargar
        XLSX.writeFile(wb, "Restaurantes_Hada_Limon.xlsx");
    });

    // 2. IMPORTAR (Disparar input file)
    btnImportTrigger.addEventListener('click', () => {
        fileInput.click();
    });

    // 3. PROCESAR ARCHIVO
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonResults = XLSX.utils.sheet_to_json(worksheet);

                // Procesar datos importados
                const importedRestaurants = jsonResults.map(r => {
                    // Convertir string de pedido a array
                    let items = [];
                    if (r.orderItems && typeof r.orderItems === 'string') {
                        items = r.orderItems.split(',').map(s => s.trim());
                    }
                    
                    return {
                        ...r,
                        orderItems: items,
                        // Convertir a números
                        quality: Number(r.quality) || 0,
                        quantity: Number(r.quantity) || 0,
                        variety: Number(r.variety) || 0,
                        aesthetics: Number(r.aesthetics) || 0,
                        service: Number(r.service) || 0,
                        qualityPrice: Number(r.qualityPrice) || 0,
                        totalScore: Number(r.totalScore) || 0,
                        timesVisited: Number(r.timesVisited) || 0,
                        // Nuevo ID para evitar conflictos
                        id: Date.now() + Math.random() 
                    };
                });

                if (importedRestaurants.length > 0) {
                    if (confirm(`Se han encontrado ${importedRestaurants.length} restaurantes. ¿Importarlos?`)) {
                        restaurants = [...restaurants, ...importedRestaurants];
                        saveRestaurantsToStorage();
                        renderRestaurants();
                        alert("¡Importación completada!");
                    }
                } else {
                    alert("El archivo parece estar vacío o no tiene el formato correcto.");
                }
            } catch (err) {
                console.error(err);
                alert("Error al leer el archivo Excel.");
            }
            fileInput.value = ""; // Limpiar input
        };

        reader.readAsArrayBuffer(file);
    });
}

// ==========================================
// RENDERIZADO (LISTA DE TARJETAS)
// ==========================================
// RENDER
function renderRestaurants(filter = '') {
    const container = document.getElementById('restaurants-list');
    
    // 1. Filtrar
    let processedList = restaurants.filter(r => 
        r.name.toLowerCase().includes(filter.toLowerCase())
    );
    
    // 2. Ordenar
    const sortMode = document.getElementById('sort-order').value;
    
    processedList.sort((a, b) => {
        switch (sortMode) {
            case 'score-desc': return b.totalScore - a.totalScore;
            case 'score-asc': return a.totalScore - b.totalScore;
            case 'name-asc': return a.name.localeCompare(b.name);
            case 'visits-desc': return b.timesVisited - a.timesVisited;
            case 'newest':
            default: return b.id - a.id;
        }
    });

    // 3. Estado vacío
    if (processedList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3 style="color:var(--turquoise); font-family: 'Caveat Brush', cursive;">No hay resultados...</h3>
                <p>¡Prueba con otra búsqueda o añade uno nuevo!</p>
            </div>
        `;
        return;
    }
    
    // 4. Generar HTML
    container.innerHTML = processedList.map(restaurant => `
        <div class="restaurant-card">
            <div class="card-header">
                <h3>${restaurant.name}</h3>
                <div class="location">
                    <span>📍</span> ${restaurant.location || 'Sin ubicación'}
                </div>
                <div class="type-badges">
                    ${restaurant.type ? `<span class="badge badge-type">${restaurant.type}</span>` : ''}
                    ${restaurant.subtype ? `<span class="badge badge-subtype">${restaurant.subtype}</span>` : ''}
                </div>
            </div>

            <div class="card-body">
                <div class="total-rating">
                    <div>Puntuación Total</div>
                    <div>${renderStarsSVG(restaurant.totalScore)}</div>
                </div>

                <div class="ratings-grid">
                    ${renderRatingItemHTML('Calidad', restaurant.quality)}
                    ${renderRatingItemHTML('Cantidad', restaurant.quantity)}
                    ${renderRatingItemHTML('Variedad', restaurant.variety)}
                    ${renderRatingItemHTML('Estética', restaurant.aesthetics)}
                    ${renderRatingItemHTML('Servicio', restaurant.service)}
                    ${renderRatingItemHTML('Calidad/Precio', restaurant.qualityPrice)}
                </div>

                <div class="stats-row">
                    <div class="stat-badge return ${restaurant.returnVisit === 'yes' ? 'yes' : restaurant.returnVisit === 'no' ? 'no' : 'undefined'}">
                        <span class="stat-value">
                            ${restaurant.returnVisit === 'yes' ? '¡SÍ VOLVER!' : restaurant.returnVisit === 'no' ? 'NO VOLVER' : '¿Volver? -'}
                            ${restaurant.returnVisit === 'yes' ? '❤️' : restaurant.returnVisit === 'no' ? '💀' : ''}
                        </span>
                    </div>
                    <div class="stat-badge visits">
                        <span class="stat-label">Visitas</span>
                        <span class="stat-value">${restaurant.timesVisited}</span>
                    </div>
                </div>

                <div class="order-section">
                    <button class="btn-order" onclick="toggleOrder(${restaurant.id})">📋 Ver pedido</button>
                    <div id="order-${restaurant.id}" class="order-display" style="display: none;">
                        <div class="paper-note">
                            <h4>Lo que pedimos:</h4>
                            ${restaurant.orderItems && restaurant.orderItems.length ? 
                                `<ul class="order-list">${restaurant.orderItems.map(item => `<li>${item}</li>`).join('')}</ul>` : 
                                '<p class="no-order">Nada apuntado</p>'}
                        </div>
                    </div>
                </div>

                ${restaurant.reservation ? `
                    <div class="reservation-box">
                        📞 Reserva: ${restaurant.reservation}
                    </div>
                ` : ''}

                ${restaurant.notes ? `
                    <div class="notes-container">
                        <p>“${restaurant.notes}”</p>
                    </div>
                ` : ''}

            </div>

            <div class="card-footer">
                <div class="card-actions">
                    <button class="btn-edit" onclick="editRestaurant(${restaurant.id})">Editar</button>
                    <button class="btn-delete" onclick="deleteRestaurant(${restaurant.id})">Borrar</button>
                </div>
            </div>
        </div>
    `).join('');
}

// ==========================================
// HELPERS DE RENDERIZADO
// ==========================================

// Renderiza las 5 estrellas SVG
function renderStarsSVG(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        const starValue = i;
        let starClass = '';
        
        if (rating >= starValue) {
            starClass = 'active';
        } else if (rating >= starValue - 0.5) {
            starClass = 'half';
        }
        
        html += `
        <svg class="star ${starClass}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>`;
    }
    return `<div class="stars">${html}</div>`;
}

// Renderiza un item pequeño de la grid (Calidad, etc)
function renderRatingItemHTML(label, value) {
    if (!value) return '';
    return `
        <div class="rating-item">
            <span>${label}</span>
            ${renderStarsSVG(value)}
        </div>
    `;
}

// Muestra/Oculta el pedido (Global para poder llamarse desde HTML)
window.toggleOrder = function(id) {
    const orderDisplay = document.getElementById(`order-${id}`);
    if (orderDisplay) {
        orderDisplay.style.display = (orderDisplay.style.display === 'none') ? 'block' : 'none';
    }
};

// ==========================================
// ACCIONES (EDITAR / BORRAR)
// ==========================================

window.editRestaurant = function(id) {
    const restaurant = restaurants.find(r => r.id === id);
    if (!restaurant) return;
    
    editingId = id;
    
    // Rellenar campos básicos
    document.getElementById('name').value = restaurant.name;
    document.getElementById('location').value = restaurant.location || '';
    document.getElementById('times-visited').value = restaurant.timesVisited;
    document.getElementById('notes').value = restaurant.notes || '';
    document.getElementById('reservation').value = restaurant.reservation || '';
    
    // Selects Inteligentes (Detectar si es custom o predefinido)
    handleSelectPopulation('type', 'type-custom', restaurant.type);
    handleSelectPopulation('subtype', 'subtype-custom', restaurant.subtype);
    
    // Estrellas
    const ratings = ['quality', 'quantity', 'variety', 'aesthetics', 'service', 'quality-price', 'total-score'];
    ratings.forEach(r => setStarRatingInput(r, restaurant[rToKey(r)]));
    
    // Radio button
    if (restaurant.returnVisit) {
        const radio = document.querySelector(`input[name="return"][value="${restaurant.returnVisit}"]`);
        if(radio) radio.checked = true;
    }
    
    // Pedido
    const orderItemsField = document.getElementById('order-items');
    if (orderItemsField) {
        orderItemsField.value = (restaurant.orderItems && Array.isArray(restaurant.orderItems)) 
            ? restaurant.orderItems.join('\n') 
            : '';
    }
    
    // UI: Mostrar botón cancelar y cambiar tab
    document.getElementById('cancel-edit').style.display = 'block';
    document.querySelector('[data-tab="form"]').click();
};

window.deleteRestaurant = function(id) {
    if (!confirm('¿Seguro que quieres borrar este restaurante?')) return;
    
    restaurants = restaurants.filter(r => r.id !== id);
    saveRestaurantsToStorage();
    renderRestaurants();
};

// Helper para rellenar selects y mostrar campo custom si es necesario
function handleSelectPopulation(selectId, customInputId, value) {
    const select = document.getElementById(selectId);
    const customInput = document.getElementById(customInputId);
    
    // Ver si el valor existe en las opciones del select
    const options = Array.from(select.options).map(o => o.value);
    
    if (options.includes(value)) {
        select.value = value;
        customInput.style.display = 'none';
    } else if (value) {
        select.value = 'custom';
        customInput.style.display = 'block';
        customInput.value = value;
    } else {
        select.value = "";
        customInput.style.display = 'none';
    }
}

// Helper para rellenar las estrellas visualmente al editar
function setStarRatingInput(ratingName, value) {
    const input = document.getElementById(ratingName);
    if(input) input.value = value || 0;
    
    const container = document.querySelector(`[data-rating="${ratingName}"]`);
    if(container) {
        const stars = container.querySelectorAll('.star');
        updateStarDisplay(stars, value || 0);
    }
}

// Helper para convertir id HTML (quality-price) a key de objeto (qualityPrice)
function rToKey(str) {
    if(str === 'quality-price') return 'qualityPrice';
    if(str === 'total-score') return 'totalScore';
    return str;
}