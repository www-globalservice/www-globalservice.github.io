// Importar la base de datos de películas y series desde la URL proporcionada.
import { peliculas } from 'https://moc3pnj.github.io/bd/data.js';

/**
 * Variable de Control: Determina qué categoría se muestra en la grilla.
 * 1: Recién Agregadas
 * 2: Movies 2025
 * 3: Series 2025
 * 4: Animes 2025
 */
const categoriaVisible = 2; // Cambia este valor para mostrar otra categoría por defecto

/**
 * Crea el elemento HTML para una tarjeta de contenido (película o serie).
 * @param {object} item - El objeto de datos para el contenido (debe tener link, portada y nombre).
 * @returns {HTMLElement} - El elemento <a> que representa la tarjeta.
 */
function createContentCard(item) {
    const cardLink = document.createElement('a');
    cardLink.href = `https://serviciosgenerales.zya.me/service.php?i=${item.link}`;
    cardLink.target = '_blank';
    cardLink.classList.add('content-card');

    const imageUrl = item.portada && item.portada.startsWith('http') 
        ? item.portada 
        : 'https://i.ibb.co/wW3M9T4/placeholder.png';

    cardLink.innerHTML = `
        <div class="card-image-container">
            <img src="${imageUrl}" alt="Portada de ${item.nombre}" loading="lazy">
        </div>
        <h3>${item.nombre}</h3>
    `;
    
    return cardLink;
}

/**
 * Renderiza una lista de elementos en un contenedor de grilla específico.
 * @param {Array<object>} items - La lista de elementos de contenido a renderizar.
 * @param {HTMLElement} containerElement - El elemento del DOM donde se insertarán las tarjetas.
 */
function renderContentGrid(items, containerElement) {
    if (!containerElement) {
        console.error('El contenedor para la grilla no fue encontrado.');
        return;
    }
    
    containerElement.innerHTML = ''; // Limpiar contenido previo
    
    items.forEach(item => {
        const card = createContentCard(item);
        containerElement.appendChild(card);
    });
}

/**
 * Función para precargar imágenes.
 * @param {string[]} urls - Un array con las URLs de las imágenes a precargar.
 * @returns {Promise<void>}
 */
function preloadImages(urls) {
    const promises = urls.map(url => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = url;
            img.onload = resolve;
            img.onerror = resolve; // Resuelve incluso si hay error para no bloquear el preloader
        });
    });
    return Promise.all(promises);
}

async function initializeApp() {
    const preloader = document.getElementById('preloader');
    const mainContent = document.getElementById('main-content');
    
    // Arrays con toda la data disponible
    const recentlyAdded = [...peliculas].sort((a, b) => parseInt(b.id) - parseInt(a.id));
    const movies2025 = peliculas.filter(item => item.tipo === 'Película' && item.año === 2025).sort((a, b) => parseInt(b.id) - parseInt(a.id));
    const series2025 = peliculas.filter(item => item.tipo === 'Serie' && item.año === 2025).sort((a, b) => parseInt(b.id) - parseInt(a.id));
    const animes2025 = peliculas.filter(item => item.tipo === 'Anime' && item.año === 2025).sort((a, b) => parseInt(b.id) - parseInt(a.id));

    let datosParaMostrar;
    let tituloDeCategoria;

    // Selección de datos basado en la variable de control
    switch (categoriaVisible) {
        case 1:
            datosParaMostrar = recentlyAdded;
            tituloDeCategoria = "Recién Agregadas";
            break;
        case 2:
            datosParaMostrar = movies2025;
            tituloDeCategoria = "Movies 2025";
            break;
        case 3:
            datosParaMostrar = series2025;
            tituloDeCategoria = "Series 2025";
            break;
        case 4:
            datosParaMostrar = animes2025;
            tituloDeCategoria = "Animes 2025";
            break;
        default:
            datosParaMostrar = recentlyAdded;
            tituloDeCategoria = "Recién Agregadas";
    }

    // Limitar el contenido a un máximo de 30 elementos
    const itemsToShow = datosParaMostrar.slice(0, 30);
    
    const imageUrls = itemsToShow.map(item => 
        item.portada && item.portada.startsWith('http') 
        ? item.portada 
        : 'https://i.ibb.co/wW3M9T4/placeholder.png'
    );
    
    // Precargar imágenes antes de mostrar el contenido
    await preloadImages(imageUrls);

    // Actualizar el título en el HTML
    const categoryTitleElement = document.getElementById('category-title');
    if (categoryTitleElement) {
        categoryTitleElement.textContent = tituloDeCategoria;
    }

    // Renderizar la grilla única
    renderContentGrid(itemsToShow, document.getElementById('content-grid'));
    
    // Ocultar preloader y mostrar contenido
    preloader.classList.add('hidden');
    mainContent.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', initializeApp);
