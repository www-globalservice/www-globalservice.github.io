// Importar la base de datos de películas y series desde la URL proporcionada.
import { peliculas } from 'https://moc3pnj.github.io/bd/data.js';

// --- GESTIÓN DEL HISTORIAL CON LOCALSTORAGE ---

const HISTORY_KEY = 'flyTvHistory';
const MAX_HISTORY_ITEMS = 50;

/**
 * Obtiene el historial de visualización desde localStorage.
 * @returns {Array<object>} - El array del historial.
 */
function getHistory() {
    const historyJSON = localStorage.getItem(HISTORY_KEY);
    return historyJSON ? JSON.parse(historyJSON) : [];
}

/**
 * Guarda el array del historial en localStorage.
 * @param {Array<object>} historyArray - El array del historial a guardar.
 */
function saveHistory(historyArray) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historyArray));
}

/**
 * Añade un ítem al historial de visualización.
 * @param {object} item - El ítem a añadir { nombre, portada, link }.
 */
function addToHistory(item) {
    let history = getHistory();
    // Evitar duplicados: busca y elimina el ítem si ya existe.
    history = history.filter(historyItem => historyItem.link !== item.link);
    
    // Añade el nuevo ítem al principio.
    history.unshift({ ...item, watchedAt: new Date().toISOString() });
    
    // Limita el tamaño del historial.
    if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
    }
    
    saveHistory(history);
    renderHistoryCarousel();
}

/**
 * Limpia todo el historial de visualización.
 */
function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
}

// --- FUNCIÓN PARA CALCULAR TIEMPO TRANSCURRIDO ---

/**
 * Formatea una fecha ISO a un texto legible ("Hace X tiempo").
 * @param {string} isoString - La fecha en formato ISO.
 * @returns {string} - El texto formateado.
 */
function formatTimeAgo(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return `Hace ${Math.floor(interval)} años`;
    interval = seconds / 2592000;
    if (interval > 1) return `Hace ${Math.floor(interval)} meses`;
    interval = seconds / 604800;
    if (interval > 1) return `Hace ${Math.floor(interval)} sem`;
    interval = seconds / 86400;
    if (interval > 1) return `Hace ${Math.floor(interval)} días`;
    interval = seconds / 3600;
    if (interval > 1) return `Hace ${Math.floor(interval)} h`;
    interval = seconds / 60;
    if (interval > 1) return `Hace ${Math.floor(interval)} min`;
    
    return "Hace un momento";
}

// --- CREACIÓN Y RENDERIZADO DE CONTENIDO ---

/**
 * Crea el elemento HTML para una tarjeta de contenido (película o serie).
 * @param {object} item - El objeto de datos para el contenido.
 * @param {boolean} [isHistoryCard=false] - Indica si la tarjeta es para el historial.
 * @returns {HTMLElement} - El elemento <a> que representa la tarjeta.
 */
function createContentCard(item, isHistoryCard = false) {
    const cardLink = document.createElement('a');
    // REQUISITO 2: Corrección del Formato de Enlaces de Contenido
    // Se envuelve SIEMPRE la URL original en el enlace del servicio.
    cardLink.href = `https://serviciosgenerales.zya.me/service.php?i=${item.link}`;
    cardLink.target = '_blank';
    cardLink.classList.add('content-card');

    const imageUrl = item.portada && item.portada.startsWith('http') 
        ? item.portada 
        : 'https://i.ibb.co/wW3M9T4/placeholder.png';
    
    const timeOverlayHTML = isHistoryCard && item.watchedAt
        ? `<div class="time-overlay"><span>${formatTimeAgo(item.watchedAt)}</span></div>`
        : '';

    cardLink.innerHTML = `
        <div class="card-image-container">
            <img src="${imageUrl}" alt="Portada de ${item.nombre}" loading="lazy">
            ${timeOverlayHTML}
        </div>
        <h3>${item.nombre}</h3>
    `;
    
    return cardLink;
}

/**
 * Renderiza una lista de elementos en un contenedor de carrusel específico.
 * @param {Array<object>} items - La lista de elementos de contenido a renderizar.
 * @param {HTMLElement} containerElement - El elemento del DOM donde se insertarán las tarjetas.
 * @param {boolean} [isHistory=false] - Flag para saber si se renderiza el historial.
 */
function renderCarousel(items, containerElement, isHistory = false) {
    if (!containerElement) {
        console.error('El contenedor para el carrusel no fue encontrado.');
        return;
    }
    
    containerElement.innerHTML = '';
    
    items.forEach(item => {
        const card = createContentCard(item, isHistory);
        containerElement.appendChild(card);
    });
}

// --- RENDERIZAR EL CARRUSEL DEL HISTORIAL ---

function renderHistoryCarousel() {
    const history = getHistory();
    const container = document.getElementById('history-carousel');
    const viewMoreBtn = document.getElementById('history-view-more');

    if (!container || !viewMoreBtn) return;

    if (history.length === 0) {
        container.innerHTML = '<p class="empty-history-message">Tu historial de visualización está vacío.</p>';
        viewMoreBtn.style.display = 'none';
    } else {
        viewMoreBtn.style.display = 'inline-block';
        const itemsForCarousel = history.slice(0, 12);
        renderCarousel(itemsForCarousel, container, true);
    }
}

// --- LÓGICA PARA LA VISTA DE HISTORIAL COMPLETO ---

const fullHistoryView = document.getElementById('full-history-view');
const fullHistoryGrid = document.getElementById('full-history-grid');
const closeHistoryBtn = document.getElementById('close-history-view');
const viewMoreHistoryBtn = document.getElementById('history-view-more');

function showFullHistoryView() {
    const history = getHistory();
    fullHistoryGrid.innerHTML = '';
    
    history.forEach(item => {
        const card = createContentCard(item, true);
        fullHistoryGrid.appendChild(card);
    });

    fullHistoryView.classList.remove('hidden');
    document.body.classList.add('history-view-active');
}

function hideFullHistoryView() {
    fullHistoryView.classList.add('hidden');
    document.body.classList.remove('history-view-active');
}

// --- LÓGICA DE PRECARGA ---

function preloadImages(urls) {
    const promises = urls.map(url => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = url;
            img.onload = resolve;
            img.onerror = resolve;
        });
    });
    return Promise.all(promises);
}

// --- REQUISITO 1: REFACTORIZACIÓN AVANZADA DE LA LÓGICA DEL CARRUSEL ---

/**
 * @type {WeakMap<HTMLElement, {intervalId: number, isPaused: boolean}>}
 * Almacena el estado de cada carrusel (ID del intervalo y si está pausado).
 * Usar WeakMap evita fugas de memoria si un carrusel es eliminado del DOM.
 */
const carouselStates = new WeakMap();

/**
 * Inicia la animación de auto-desplazamiento para un carrusel específico.
 * @param {HTMLElement} carousel - El elemento del carrusel a animar.
 */
function startAutoScroll(carousel) {
    let scrollSpeed = 0.2;

    const scroll = () => {
        const state = carouselStates.get(carousel);
        if (state && !state.isPaused) {
            if (carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 1) {
                carousel.scrollLeft = 0;
            } else {
                carousel.scrollLeft += scrollSpeed;
            }
        }
    };
    
    const intervalId = setInterval(scroll, 16);
    carouselStates.set(carousel, { intervalId, isPaused: false });

    // Funciones específicas para este carrusel
    const pauseScroll = () => {
        const state = carouselStates.get(carousel);
        if (state) state.isPaused = true;
    };
    const resumeScroll = () => {
        const state = carouselStates.get(carousel);
        if (state) state.isPaused = false;
    };

    carousel.addEventListener('mouseenter', pauseScroll);
    carousel.addEventListener('mouseleave', resumeScroll);
    carousel.addEventListener('touchstart', pauseScroll, { passive: true });
    carousel.addEventListener('touchend', resumeScroll);
}


// --- FUNCIÓN PRINCIPAL DE INICIALIZACIÓN ---

async function initializeApp() {
    const preloader = document.getElementById('preloader');
    const mainContent = document.getElementById('main-content');
    
    renderHistoryCarousel();

    // Definir los carruseles y sus datos
    const carouselsToRender = [
        {
            id: 'recent-carousel',
            data: [...peliculas].sort((a, b) => parseInt(b.id) - parseInt(a.id)).slice(0, 12)
        },
        {
            id: 'movies-2025-carousel',
            data: peliculas.filter(item => item.tipo === 'Película' && item.año === 2025).sort((a, b) => parseInt(b.id) - parseInt(a.id)).slice(0, 12)
        },
        {
            id: 'series-2025-carousel',
            data: peliculas.filter(item => item.tipo === 'Serie' && item.año === 2025).sort((a, b) => parseInt(b.id) - parseInt(a.id)).slice(0, 12)
        },
        {
            id: 'animes-2025-carousel',
            data: peliculas.filter(item => item.tipo === 'Anime' && item.año === 2025).sort((a, b) => parseInt(b.id) - parseInt(a.id)).slice(0, 12)
        }
    ];
    
    const allItems = carouselsToRender.flatMap(c => c.data);
    const imageUrls = allItems.map(item => 
        item.portada && item.portada.startsWith('http') 
        ? item.portada 
        : 'https://i.ibb.co/wW3M9T4/placeholder.png'
    );
    
    await preloadImages(imageUrls);

    // Renderizar todos los carruseles
    carouselsToRender.forEach(carouselInfo => {
        const container = document.getElementById(carouselInfo.id);
        if (container) {
            renderCarousel(carouselInfo.data, container);
        }
    });
    
    preloader.classList.add('hidden');
    mainContent.classList.remove('hidden');

    // REQUISITO 1.2 y 1.3: Iniciar animaciones de forma independiente y escalonada
    const carouselsToAnimate = document.querySelectorAll('.carousel-container:not(#history-carousel)');
    carouselsToAnimate.forEach((carousel, index) => {
        // La animación de cada carrusel inicia con un retraso incremental.
        setTimeout(() => {
            startAutoScroll(carousel);
        }, index * 150); // 0ms, 150ms, 300ms, etc.
    });

    // CAPTURAR CLICS PARA GUARDAR EN HISTORIAL
    document.body.addEventListener('click', (e) => {
        const card = e.target.closest('.content-card');
        if (!card) return;

        const link = card.href;
        const portada = card.querySelector('img')?.src;
        const nombre = card.querySelector('h3')?.textContent;

        if (link && portada && nombre) {
            // Reconstruir la URL original para guardarla en el historial
            const originalLink = new URL(link).searchParams.get('i');
            addToHistory({ nombre, portada, link: originalLink });
        }
    });

    // Event listeners para la vista de historial completo
    viewMoreHistoryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showFullHistoryView();
    });
    closeHistoryBtn.addEventListener('click', hideFullHistoryView);
}

document.addEventListener('DOMContentLoaded', initializeApp);
