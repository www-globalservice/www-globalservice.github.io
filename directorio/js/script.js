import { peliculas } from 'https://raw.githack.com/MOC3PNJ/moc3pnj.github.io/refs/heads/main/bd/data.js';

// --- Elementos del DOM ---
const contentGrid = document.getElementById('content-grid');
const categoryFilter = document.getElementById('category-filter');
const yearFilter = document.getElementById('year-filter');
const typeFilter = document.getElementById('type-filter');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const paginationControls = document.querySelector('.pagination-controls');

// --- ELIMINADO: Se quitaron las constantes para sidebar, menu-toggle y overlay ---

// --- Estado de la aplicación ---
let allContent = [];
let currentFilteredItems = [];
let currentPage = 1;
let itemsPerPage = 20;

// Determina cuántos elementos mostrar por página según el ancho de la pantalla
const setItemsPerPage = () => {
    if (window.innerWidth <= 480) {
        itemsPerPage = 18;
    } else if (window.innerWidth <= 768) {
        itemsPerPage = 20;
    } else {
        itemsPerPage = 25;
    }
};

// Función principal para obtener y mostrar datos iniciales
async function initializeApp() {
    try {
        allContent = peliculas.sort((a, b) => b.año - a.año);
        currentFilteredItems = [...allContent];

        setItemsPerPage();
        populateFilters();
        displayPaginatedContent();
    } catch (error) {
        console.error('Error al cargar la base de datos:', error);
        contentGrid.innerHTML = '<p>Error al cargar el contenido. Por favor, inténtalo de nuevo más tarde.</p>';
    }
}

// Rellena los menús desplegables de los filtros
function populateFilters() {
    const categories = new Set();
    allContent.forEach(item => {
        if (item.categoria) {
            item.categoria.split(',').forEach(cat => categories.add(cat.trim()));
        }
    });
    const sortedCategories = Array.from(categories).sort((a, b) => a.localeCompare(b));
    categoryFilter.innerHTML = '<option value="all">Todas las Categorías</option>';
    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });

    const years = new Set(allContent.map(item => item.año));
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    yearFilter.innerHTML = '<option value="all">Todos los Años</option>';
    sortedYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
}

// Muestra el contenido de la página actual
function displayPaginatedContent() {
    contentGrid.innerHTML = '';
    if (currentFilteredItems.length === 0) {
        contentGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; font-size: 1.2rem;">No se encontraron resultados.</p>';
        paginationControls.style.display = 'none';
        return;
    }

    paginationControls.style.display = 'flex';
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = currentFilteredItems.slice(startIndex, endIndex);

    paginatedItems.forEach(item => {
        const contentItem = document.createElement('div');
        contentItem.classList.add('content-item');
        
        const imageUrl = item.portada && item.portada.startsWith('http') ? item.portada : 'https://i.ibb.co/bFqfL5Q/placeholder.png';

        contentItem.innerHTML = `
            <div class="image-container">
                <img src="${imageUrl}" alt="Portada de ${item.nombre}" loading="lazy">
            </div>
            <h3>${item.nombre}</h3>
        `;
        
        contentItem.addEventListener('click', () => {
            if (item.link) {
                const playerUrl = `https://serviciosgenerales.zya.me/service.php?i=${item.link}`;
                window.open(playerUrl, '_blank');
            } else {
                // Podríamos mostrar una notificación más elegante en el futuro
                console.warn('No hay un enlace disponible para este contenido.');
            }
        });
       
        contentGrid.appendChild(contentItem);
    });

    updatePaginationButtons();
}

// Actualiza el estado (habilitado/deshabilitado) de los botones de paginación
function updatePaginationButtons() {
    const totalPages = Math.ceil(currentFilteredItems.length / itemsPerPage);
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages || totalPages === 0;
    
    if (totalPages <= 1) {
        paginationControls.style.display = 'none';
    } else {
        paginationControls.style.display = 'flex';
    }
}

// Filtra el contenido basado en la selección del usuario
function filterContent() {
    const selectedCategory = categoryFilter.value;
    const selectedYear = yearFilter.value;
    const selectedType = typeFilter.value;

    currentFilteredItems = allContent.filter(item => {
        const itemCategories = item.categoria ? item.categoria.split(',').map(cat => cat.trim()) : [];
        const matchesCategory = selectedCategory === 'all' || itemCategories.includes(selectedCategory);
        const matchesYear = selectedYear === 'all' || (item.año && item.año.toString() === selectedYear);
        const matchesType = selectedType === 'all' || item.tipo === selectedType;
        return matchesCategory && matchesYear && matchesType;
    });
    currentPage = 1;
    displayPaginatedContent();
}

// --- Event Listeners ---
categoryFilter.addEventListener('change', filterContent);
yearFilter.addEventListener('change', filterContent);
typeFilter.addEventListener('change', filterContent);

prevButton.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        displayPaginatedContent();
        window.scrollTo(0, 0);
    }
});

nextButton.addEventListener('click', () => {
    const totalPages = Math.ceil(currentFilteredItems.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayPaginatedContent();
        window.scrollTo(0, 0);
    }
});

window.addEventListener('resize', () => {
    setItemsPerPage();
    // Re-renderizar para ajustar el número de items si cambia la paginación
    displayPaginatedContent();
});

// --- ELIMINADO: Se quitaron los event listeners para el menú ---

// --- Inicialización ---
initializeApp();
