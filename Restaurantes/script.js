// Base de datos de restaurantes
let restaurants = [];
let editingId = null;
let useFirebase = false;

function initStorage() {
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
            console.warn('Firebase no disponible, usando localStorage');
            restaurants = JSON.parse(localStorage.getItem('restaurants')) || [];
        }
    } else {
        restaurants = JSON.parse(localStorage.getItem('restaurants')) || [];
    }
    // Migración: asegurar que todos tengan orderItems como array
    restaurants.forEach(r => {
        if (!('orderItems' in r) || !Array.isArray(r.orderItems)) {
            r.orderItems = [];
        }
    });
    renderRestaurants();
}

async function saveRestaurantsToStorage() {
    if (useFirebase) {
        const dbRef = window.firebaseRef(window.firebaseDB, 'restaurants');
        const data = {};
        restaurants.forEach(r => {
            data[r.id] = r;
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
        renderRestaurants();
    });
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', async () => {
    initStorage();
    await loadRestaurants();
    setupTabs();
    setupStarRatings();
    setupCustomSelects();
    setupForm();
    listenFirebaseUpdates();
});

// TABS
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Cambiar tab activa
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Cambiar sección activa
            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(`${targetTab}-section`).classList.add('active');
        });
    });
}

// SISTEMA DE ESTRELLAS
function setupStarRatings() {
    const starContainers = document.querySelectorAll('.stars');
    
    starContainers.forEach(container => {
        const stars = container.querySelectorAll('.star');
        const ratingName = container.dataset.rating;
        const hiddenInput = document.getElementById(ratingName);
        
        // Si no es un input de formulario (es decir, solo visualización), saltar listeners
        if (!hiddenInput) return;

        stars.forEach((star, index) => {
            star.addEventListener('click', (e) => {
                // En SVG el click target puede ser path o svg, aseguramos obtener el SVG
                const svgEl = star.closest('svg');
                const rect = svgEl.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const starWidth = rect.width;
                
                // Detectar si el click es en la mitad izquierda o derecha
                let value;
                if (clickX < starWidth / 2) {
                    // Mitad izquierda - dar medio punto
                    value = index + 0.5;
                } else {
                    // Mitad derecha - dar punto completo
                    value = index + 1;
                }
                
                hiddenInput.value = value;
                updateStarDisplay(stars, value);
            });
            
            star.addEventListener('mousemove', (e) => {
                const svgEl = star.closest('svg');
                const rect = svgEl.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const starWidth = rect.width;
                
                let value;
                if (clickX < starWidth / 2) {
                    value = index + 0.5;
                } else {
                    value = index + 1;
                }
                
                updateStarDisplay(stars, value);
            });
        });
        
        container.addEventListener('mouseleave', () => {
            const currentValue = parseFloat(hiddenInput.value) || 0;
            updateStarDisplay(stars, currentValue);
        });
    });
}

// Actualizar visualización de estrellas (soporta medias estrellas)
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

// SELECTORES PERSONALIZADOS
function setupCustomSelects() {
    const typeSelect = document.getElementById('type');
    const typeCustom = document.getElementById('type-custom');
    const subtypeSelect = document.getElementById('subtype');
    const subtypeCustom = document.getElementById('subtype-custom');
    
    typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'custom') {
            typeCustom.style.display = 'block';
            typeCustom.required = true;
        } else {
            typeCustom.style.display = 'none';
            typeCustom.required = false;
            typeCustom.value = '';
        }
    });
    
    subtypeSelect.addEventListener('change', () => {
        if (subtypeSelect.value === 'custom') {
            subtypeCustom.style.display = 'block';
            subtypeCustom.required = true;
        } else {
            subtypeCustom.style.display = 'none';
            subtypeCustom.required = false;
            subtypeCustom.value = '';
        }
    });
}

// FORMULARIO
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
    
    // Prevenir envío del formulario al presionar Enter en el textarea de pedido
    if (orderItemsField) {
        orderItemsField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.stopPropagation();
            }
        });
    }
}

// GUARDAR RESTAURANTE
function saveRestaurant() {
    const typeSelect = document.getElementById('type');
    const typeCustom = document.getElementById('type-custom');
    const subtypeSelect = document.getElementById('subtype');
    const subtypeCustom = document.getElementById('subtype-custom');
    
    // Procesar pedido (orderItems)
    let orderItems = [];
    const orderItemsField = document.getElementById('order-items');
    if (orderItemsField) {
        const orderItemsRaw = orderItemsField.value;
        orderItems = orderItemsRaw
            ? orderItemsRaw.split('\n').map(item => item.trim()).filter(Boolean)
            : [];
    }
    
    const restaurant = {
        id: editingId || Date.now(),
        name: document.getElementById('name').value,
        location: document.getElementById('location').value,
        type: typeSelect.value === 'custom' ? typeCustom.value : typeSelect.value,
        subtype: subtypeSelect.value === 'custom' ? subtypeCustom.value : subtypeSelect.value,
        quality: parseFloat(document.getElementById('quality').value) || 0,
        quantity: parseFloat(document.getElementById('quantity').value) || 0,
        variety: parseFloat(document.getElementById('variety').value) || 0,
        aesthetics: parseFloat(document.getElementById('aesthetics').value) || 0,
        service: parseFloat(document.getElementById('service').value) || 0,
        qualityPrice: parseFloat(document.getElementById('quality-price').value) || 0,
        returnVisit: document.querySelector('input[name="return"]:checked')?.value || '',
        timesVisited: parseInt(document.getElementById('times-visited').value) || 0,
        totalScore: parseFloat(document.getElementById('total-score').value) || 0,
        notes: document.getElementById('notes').value,
        reservation: document.getElementById('reservation').value,
        orderItems
    };
    
    if (editingId) {
        // Editar restaurante existente
        const index = restaurants.findIndex(r => r.id === editingId);
        restaurants[index] = restaurant;
    } else {
        // Agregar nuevo restaurante
        restaurants.push(restaurant);
    }
    
    // Guardar en Firebase o localStorage
    saveRestaurantsToStorage();
    
    // Resetear formulario y mostrar lista
    resetForm();
    document.querySelector('[data-tab="list"]').click();
    renderRestaurants();
}

// RESETEAR FORMULARIO
function resetForm() {
    document.getElementById('restaurant-form').reset();
    document.getElementById('edit-id').value = '';
    editingId = null;
    
    // Resetear estrellas
    document.querySelectorAll('.star').forEach(star => {
        star.classList.remove('active', 'half');
    });
    document.querySelectorAll('.stars + input[type="hidden"]').forEach(input => {
        input.value = '0';
    });
    
    // Ocultar campos custom
    document.getElementById('type-custom').style.display = 'none';
    document.getElementById('subtype-custom').style.display = 'none';
    
    // Ocultar botón cancelar
    document.getElementById('cancel-edit').style.display = 'none';
}

// RENDERIZAR RESTAURANTES
function renderRestaurants(filter = '') {
    const container = document.getElementById('restaurants-list');
    const filteredRestaurants = restaurants.filter(r => 
        r.name.toLowerCase().includes(filter.toLowerCase())
    );
    
    if (filteredRestaurants.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>🍽️</h3>
                <p>No hay restaurantes registrados aún.</p>
                <p>¡Añade tu primer restaurante!</p>
            </div>
        `;
        return;
    }
    
        container.innerHTML = filteredRestaurants.map(restaurant => `
            <div class="restaurant-card">
                <h3>${restaurant.name}</h3>
                ${restaurant.location ? `<p class="location">📍 ${restaurant.location}</p>` : ''}
                <div class="type-badges">
                    ${restaurant.type ? `<span class="badge badge-type">${restaurant.type}</span>` : ''}
                    ${restaurant.subtype ? `<span class="badge badge-subtype">${restaurant.subtype}</span>` : ''}
                </div>
                <div class="total-rating">
                    <div>Puntuación Total</div>
                    <div>${renderStars(restaurant.totalScore)}</div>
                </div>
                <div class="ratings">
                    ${renderRatingItem('Calidad', restaurant.quality)}
                    ${renderRatingItem('Cantidad', restaurant.quantity)}
                    ${renderRatingItem('Variedad', restaurant.variety)}
                    ${renderRatingItem('Estética', restaurant.aesthetics)}
                    ${renderRatingItem('Servicio', restaurant.service)}
                    ${renderRatingItem('Calidad/Precio', restaurant.qualityPrice)}
                </div>
                <div class="info-item">
                    <strong>¿Volveríamos?</strong> 
                    ${restaurant.returnVisit === 'yes' ? '✅ Sí' : restaurant.returnVisit === 'no' ? '❌ No' : '-'}
                </div>
                <div class="info-item">
                    <strong>Veces visitado:</strong> ${restaurant.timesVisited}
                </div>
                ${restaurant.notes ? `<div class="notes">💭 ${restaurant.notes}</div>` : ''}
                ${restaurant.reservation ? `<div class="info-item">📞 ${restaurant.reservation}</div>` : ''}
                <div class="order-section">
                    <button class="btn-order" onclick="toggleOrder(${restaurant.id})">📋 Ver pedido</button>
                    <div id="order-${restaurant.id}" class="order-display" style="display: none;">
                        <div class="paper-note">
                            <h4>Pedido</h4>
                            ${restaurant.orderItems && restaurant.orderItems.length ? 
                                `<ul class="order-list">${restaurant.orderItems.map(item => `<li>${item}</li>`).join('')}</ul>` : 
                                '<p class="no-order">No hay pedido registrado</p>'}
                        </div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-edit" onclick="editRestaurant(${restaurant.id})">✏️ Editar</button>
                    <button class="btn-delete" onclick="deleteRestaurant(${restaurant.id})">🗑️ Eliminar</button>
                </div>
            </div>
        `).join('');
}

// Toggle order display (global function)
window.toggleOrder = function(id) {
    const orderDisplay = document.getElementById(`order-${id}`);
    if (orderDisplay) {
        if (orderDisplay.style.display === 'none') {
            orderDisplay.style.display = 'block';
        } else {
            orderDisplay.style.display = 'none';
        }
    }
};

// RENDERIZAR ESTRELLAS - Versión SVG
function renderStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        const starValue = i;
        let starClass = '';
        
        if (rating >= starValue) {
            starClass = 'active';
        } else if (rating >= starValue - 0.5) {
            starClass = 'half';
        }
        
        // Usamos un icono SVG de estrella en lugar de un carácter de texto
        html += `
        <svg class="star ${starClass}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>`;
    }
    return `<div class="stars">${html}</div>`;
}

// RENDERIZAR ITEM DE VALORACIÓN
function renderRatingItem(label, value) {
    if (value === 0) return '';
    return `
        <div class="rating-item">
            <span>${label}</span>
            ${renderStars(value)}
        </div>
    `;
}

// EDITAR RESTAURANTE
function editRestaurant(id) {
    const restaurant = restaurants.find(r => r.id === id);
    if (!restaurant) return;
    
    editingId = id;
    
    // Llenar formulario
    document.getElementById('name').value = restaurant.name;
    document.getElementById('location').value = restaurant.location || '';
    
    // Tipo y Subtipo
    const typeSelect = document.getElementById('type');
    const typeOptions = Array.from(typeSelect.options).map(o => o.value);
    if (typeOptions.includes(restaurant.type)) {
        typeSelect.value = restaurant.type;
    } else if (restaurant.type) {
        typeSelect.value = 'custom';
        document.getElementById('type-custom').style.display = 'block';
        document.getElementById('type-custom').value = restaurant.type;
    }
    
    const subtypeSelect = document.getElementById('subtype');
    const subtypeOptions = Array.from(subtypeSelect.options).map(o => o.value);
    if (subtypeOptions.includes(restaurant.subtype)) {
        subtypeSelect.value = restaurant.subtype;
    } else if (restaurant.subtype) {
        subtypeSelect.value = 'custom';
        document.getElementById('subtype-custom').style.display = 'block';
        document.getElementById('subtype-custom').value = restaurant.subtype;
    }
    
    // Valoraciones
    setStarRating('quality', restaurant.quality);
    setStarRating('quantity', restaurant.quantity);
    setStarRating('variety', restaurant.variety);
    setStarRating('aesthetics', restaurant.aesthetics);
    setStarRating('service', restaurant.service);
    setStarRating('quality-price', restaurant.qualityPrice);
    setStarRating('total-score', restaurant.totalScore);
    
    // Volver
    if (restaurant.returnVisit) {
        document.querySelector(`input[name="return"][value="${restaurant.returnVisit}"]`).checked = true;
    }
    
    document.getElementById('times-visited').value = restaurant.timesVisited;
    document.getElementById('notes').value = restaurant.notes || '';
    document.getElementById('reservation').value = restaurant.reservation || '';
    
    // Cargar pedido (orderItems)
    const orderItemsField = document.getElementById('order-items');
    if (orderItemsField) {
        orderItemsField.value = (restaurant.orderItems && Array.isArray(restaurant.orderItems) && restaurant.orderItems.length)
            ? restaurant.orderItems.join('\n') : '';
    }
    
    // Mostrar botón cancelar
    document.getElementById('cancel-edit').style.display = 'block';
    
    // Cambiar a tab de formulario
    document.querySelector('[data-tab="form"]').click();
}

// ESTABLECER VALORACIÓN DE ESTRELLAS
function setStarRating(ratingName, value) {
    const input = document.getElementById(ratingName);
    input.value = value;
    
    const container = document.querySelector(`[data-rating="${ratingName}"]`);
    const stars = container.querySelectorAll('.star');
    updateStarDisplay(stars, value);
}

// ELIMINAR RESTAURANTE
function deleteRestaurant(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este restaurante?')) return;
    
    restaurants = restaurants.filter(r => r.id !== id);
    saveRestaurantsToStorage();
    renderRestaurants();
}

// BÚSQUEDA
document.getElementById('search').addEventListener('input', (e) => {
    renderRestaurants(e.target.value);
});