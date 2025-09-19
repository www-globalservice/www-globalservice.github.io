/**
 * Se ejecuta cuando el contenido del DOM ha sido completamente cargado.
 * Inicializa la lógica de redirección y otros manejadores de eventos.
 */
document.addEventListener('DOMContentLoaded', () => {

    // Clave única para el sessionStorage para evitar colisiones.
    const SESSION_STORAGE_KEY = 'redirectData';

    /**
     * Gestiona la funcionalidad de "Mostrar más / Mostrar menos" para el texto legal.
     */
    const initToggleLegal = () => {
        const toggleButton = document.getElementById('toggle-legal');
        const legalText = document.getElementById('legal-text');

        if (toggleButton && legalText) {
            toggleButton.addEventListener('click', (event) => {
                event.preventDefault();
                const isExpanded = legalText.classList.toggle('is-expanded');
                toggleButton.textContent = isExpanded ? 'Mostrar menos' : 'Mostrar más';
            });
        }
    };

    /**
     * Inicia la cuenta regresiva para la redirección.
     * @param {string} finalUrl - La URL final a la que se redirigirá.
     */
    const startCountdown = (finalUrl) => {
        const countdownElement = document.getElementById('countdown');
        const loaderElement = document.querySelector('.redirect-loader');

        if (!countdownElement || !loaderElement) return;

        // Muestra el loader por si estaba oculto.
        loaderElement.style.display = 'block';
        let secondsLeft = 5;
        countdownElement.textContent = secondsLeft;

        const countdownInterval = setInterval(() => {
            secondsLeft--;
            countdownElement.textContent = secondsLeft;

            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
                window.location.href = finalUrl;
            }
        }, 1000);
    };
    
    /**
     * Muestra un mensaje de error y redirige a una URL de fallback tras 2 segundos.
     */
    const redirectToErrorPage = () => {
        const termsView = document.getElementById('terms-view');
        const errorView = document.getElementById('error-view');

        if (termsView) {
            termsView.style.display = 'none'; // Oculta la vista normal
        }
        if (errorView) {
            errorView.style.display = 'block'; // Muestra el mensaje de error
        }

        // Redirige después de 2 segundos
        setTimeout(() => {
            window.location.href = 'go:direct';
        }, 2000);
    };


    /**
     * Lógica principal de redirección.
     * Implementa el flujo de dos pasos para proteger la URL.
     */
    const handleRedirectLogic = () => {
        // --- PASO 1: Captura y Almacenamiento (Primera Carga) ---
        // Verificamos si PHP inyectó la configuración y una URL de contenido válida.
        if (window.APP_CONFIG && window.APP_CONFIG.contentUrl) {
            
            // Si hay un error inyectado por PHP, detenemos el proceso y redirigimos a fallback.
            if (window.APP_CONFIG.error) {
                console.error('Error de validación desde el servidor:', window.APP_CONFIG.error);
                window.location.href = window.APP_CONFIG.fallbackUrl;
                return;
            }

            // Guardamos los datos necesarios en sessionStorage.
            // Usamos JSON.stringify para guardar el objeto completo.
            const dataToStore = {
                contentUrl: window.APP_CONFIG.contentUrl,
                domainList: window.APP_CONFIG.domainList
            };
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(dataToStore));

            // Forzamos la recarga de la página sin el parámetro '?i=' para limpiar la URL.
            // window.location.pathname obtiene la ruta actual (ej. /service.php).
            // replace() es mejor que `href =` porque no crea una entrada en el historial.
            window.location.replace(window.location.pathname);
            return; // Detenemos la ejecución para esperar la recarga.
        }

        // --- PASO 2: Lectura y Redirección Final (Segunda Carga) ---
        // En la segunda carga, buscamos los datos en sessionStorage.
        const storedDataJSON = sessionStorage.getItem(SESSION_STORAGE_KEY);

        if (storedDataJSON) {
            // Inmediatamente después de leer, eliminamos los datos para que no se reutilicen.
            sessionStorage.removeItem(SESSION_STORAGE_KEY);

            try {
                const storedData = JSON.parse(storedDataJSON);
                const { contentUrl, domainList } = storedData;

                // Verificamos que los datos recuperados son válidos.
                if (contentUrl && Array.isArray(domainList) && domainList.length > 0) {
                    
                    // 1. Selecciona un dominio aleatorio.
                    const randomDomain = domainList[Math.floor(Math.random() * domainList.length)];

                    // 2. Construye la URL final, codificando la URL de contenido de forma segura.
                    const finalUrl = `${randomDomain}?contenido=${encodeURIComponent(contentUrl)}`;

                    // 3. Inicia la cuenta regresiva.
                    startCountdown(finalUrl);

                } else {
                    // Si los datos en sessionStorage están corruptos, redirige a la página de error.
                    console.error('Los datos en sessionStorage son inválidos.');
                    redirectToErrorPage();
                }
            } catch (error) {
                console.error('Error al parsear los datos de sessionStorage:', error);
                redirectToErrorPage();
            }
        } else {
            // Si el usuario llega sin el parámetro 'i' y sin sessionStorage,
            // es un error o una primera solicitud fallida.
            console.warn('No se encontró información de redirección. Redirigiendo a la página de error.');
            redirectToErrorPage();
        }
    };

    // Inicializa todas las funcionalidades.
    initToggleLegal();
    handleRedirectLogic();
});
