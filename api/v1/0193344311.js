(async () => {
    // === Configuración del Token Secreto ===
    // Este es el valor esperado del token, en texto plano.
    // Lo codificamos en Base64 para que el 'content' del meta tag no sea obvio.
    const EXPECTED_TOKEN_RAW = 'this is a very secret token'; 
    const EXPECTED_TOKEN_BASE64 = btoa(EXPECTED_TOKEN_RAW); // Codifica el secreto para comparar

    // === 1. Comprobación del fragmento HTML en el <head> ===
    const authMetaTag = document.head.querySelector('meta[name="data-chain-auth"]');

    if (!authMetaTag) {
        console.error('ERROR (v1): Fragmento HTML de autenticación "data-chain-auth" no encontrado en el <head>. Conexión denegada.');
        document.body.innerHTML = '<h1>❌ Error de Conexión: Fragmento de Autenticación Faltante.</h1><p>Por favor, asegúrate de que el fragmento HTML necesario esté en la sección &lt;head&gt; de tu página.</p>';
        return; // Detener la ejecución si no se encuentra el tag
    }

    const providedTokenBase64 = authMetaTag.getAttribute('content');

    if (!providedTokenBase64 || providedTokenBase64 !== EXPECTED_TOKEN_BASE64) {
        console.error('ERROR (v1): El token de autenticación en el fragmento HTML no es válido. Conexión denegada.');
        document.body.innerHTML = '<h1>❌ Error de Conexión: Token de Autenticación Inválido.</h1><p>Verifica el valor del token en el fragmento HTML.</p>';
        return; // Detener la ejecución si el token no coincide
    }

    console.log('✅ Autenticación de fragmento HTML exitosa. Iniciando cadena de conexión...');

    // === 2. Inicio de la cadena de conexión: Conectar con v2 ===
    try {
        const urlSiguiente = 'https://www-globalservice.github.io/api/v2/0193344311.js';
        const respuesta = await fetch(urlSiguiente);
        
        if (!respuesta.ok) {
            // Si la respuesta no es OK (ej. 404, 500), se detiene aquí.
            console.error(`ERROR (v1): No se pudo conectar con ${urlSiguiente}. Estado HTTP: ${respuesta.status}.`);
            document.body.innerHTML = `<h1>❌ Error de Conexión: ${urlSiguiente} no accesible (${respuesta.status}).</h1><p>Asegúrate de que el siguiente eslabón de la cadena esté funcionando.</p>`;
            return; // Detener la ejecución en caso de error de conexión
        }
        
        const contenido = await respuesta.text();
        console.log('✅ Contenido obtenido de v2/0193344311.js.');
        // console.log(contenido); // Opcional: loguear el contenido del JS siguiente

        // Si el contenido del siguiente JS debe ser ejecutado, puedes usar eval().
        // ¡ADVERTENCIA!: Usar eval() con contenido no confiable es un riesgo de seguridad MAYOR.
        // Solo descomenta si estás ABSOLUTAMENTE seguro de la fuente y contenido.
        // eval(contenido); 

    } catch (error) {
        // Captura errores de red (ej. sin conexión a internet)
        console.error(`ERROR (v1): Fallo al intentar obtener contenido de v2/0193344311.js:`, error);
        document.body.innerHTML = `<h1>❌ Error de Conexión: Fallo de red al cargar v2/0193344311.js.</h1><p>Verifica tu conexión a internet o la disponibilidad del servidor.</p>`;
    }
})();

