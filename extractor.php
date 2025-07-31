<?php
// fly_player.php

// ---- CONFIGURACIÓN INICIAL ----
header('Access-Control-Allow-Origin: *');
if (isset($_GET['json']) && $_GET['json'] == '1') {
    header('Content-Type: application/json; charset=utf-8');
}
libxml_use_internal_errors(true);

// ---- RESPUESTA ESTÁNDAR ----
$response = [
    'status' => 'error',
    'message' => '',
    'data' => null
];

// ---- FUNCIÓN CLAVE PARA RESOLVER URLS ----
/**
 * Resuelve una URL relativa o absoluta a partir de una URL base.
 * @param string $baseUrl La URL completa de la página actual.
 * @param string $relativeUrl La URL encontrada en el atributo href.
 * @return string La URL absoluta y completa.
 */
function resolve_url($baseUrl, $relativeUrl) {
    // Si la URL relativa ya es absoluta, la devolvemos tal cual.
    if (parse_url($relativeUrl, PHP_URL_SCHEME) != '') {
        return $relativeUrl;
    }

    $baseParts = parse_url($baseUrl);
    $host = ($baseParts['scheme'] ?? 'http') . '://' . ($baseParts['host'] ?? '');

    // Si la URL relativa empieza con '/', es relativa al dominio.
    if ($relativeUrl[0] == '/') {
        return $host . $relativeUrl;
    }

    // Si no, es relativa a la ruta actual.
    $path = dirname($baseParts['path'] ?? '/');
    if ($path == '.' || $path == '\\') {
        $path = '/';
    }
    if (substr($path, -1) != '/') {
        $path .= '/';
    }
    
    // Eliminar segmentos innecesarios como ./ o ../
    $absolute = $host . $path . $relativeUrl;
    $parts = explode('/', $absolute);
    $stack = [];
    foreach ($parts as $i => $part) {
        if ($part == '' && $i > 0) continue; // Ignorar slashes dobles, excepto en http://
        if ($part == '.') continue;
        if ($part == '..') {
            array_pop($stack);
        } else {
            $stack[] = $part;
        }
    }
    return implode('/', $stack);
}


// ---- LÓGICA PRINCIPAL ----
if (!isset($_GET['i']) || empty($_GET['i'])) {
    $response['message'] = 'Acceso denegado. Parámetro de URL no proporcionado.';
    if (isset($_GET['json']) && $_GET['json'] == '1') {
        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
        die('<h1>Error: URL no proporcionada. Use el parámetro ?i=...</h1>');
    }
    exit();
}

$url = filter_var($_GET['i'], FILTER_SANITIZE_URL);
if (!filter_var($url, FILTER_VALIDATE_URL)) {
    $response['message'] = 'La URL proporcionada no es válida.';
    if (isset($_GET['json']) && $_GET['json'] == '1') {
        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
        die('<h1>Error: La URL proporcionada no es válida.</h1>');
    }
    exit();
}


// 2. Obtener el contenido de la URL con cURL
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
$htmlContent = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$htmlContent || $httpCode != 200) {
    $response['message'] = 'No se pudo obtener el contenido de la URL de origen (Código: '.$httpCode.').';
    if (isset($_GET['json']) && $_GET['json'] == '1') {
        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
        echo "<h1>Error: No se pudo obtener el contenido de la URL de origen.</h1>";
    }
    exit();
}

// 3. Parsear el HTML
$doc = new DOMDocument();
$doc->loadHTML($htmlContent);
$xpath = new DOMXPath($doc);

// ---- EXTRACCIÓN DE DATOS JSON (__NEXT_DATA__) ----
$scriptNode = $xpath->query('//script[@id="__NEXT_DATA__"]')->item(0);

if (!$scriptNode) {
    $response['message'] = 'No se encontró el bloque de datos JSON (__NEXT_DATA__). La estructura del sitio pudo haber cambiado.';
     if (isset($_GET['json']) && $_GET['json'] == '1') {
        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
        echo "<h1>Error: No se encontró el bloque de datos JSON.</h1>";
    }
    exit();
}

$jsonData = json_decode($scriptNode->nodeValue);

if (json_last_error() !== JSON_ERROR_NONE) {
    $response['message'] = 'Error al decodificar los datos JSON de la página.';
    if (isset($_GET['json']) && $_GET['json'] == '1') {
        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
        echo "<h1>Error: No se pudieron decodificar los datos JSON.</h1>";
    }
    exit();
}

// ---- PROCESAMIENTO DE DATOS ----
$pageProps = $jsonData->props->pageProps ?? null;

if (!$pageProps) {
    $response['message'] = 'Los datos esperados (pageProps) no se encontraron en el JSON.';
     if (isset($_GET['json']) && $_GET['json'] == '1') {
        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
        echo "<h1>Error: La estructura de datos del sitio ha cambiado.</h1>";
    }
    exit();
}


$extractedData = [
    'title' => $pageProps->name ?? 'N/A',
    'streams' => [],
    'subtitles' => [],
    'seasons' => [],
    'episodes' => []
];

// Extraer enlaces de streaming
if (!empty($pageProps->mediaInfoList)) {
    foreach ($pageProps->mediaInfoList as $media) {
        $extractedData['streams'][] = [
            'quality' => $media->currentDefinition ?? 'N/A',
            'url' => $media->mediaUrl ?? '#'
        ];
    }
}

// Extraer subtítulos
if (!empty($pageProps->episodeVo[0]->subtitlingList)) {
    foreach ($pageProps->episodeVo[0]->subtitlingList as $subtitle) {
        $extractedData['subtitles'][] = [
            'language' => $subtitle->languageAbbr ?? 'N/A',
            'label' => $subtitle->language ?? 'Unknown',
            'url' => $subtitle->subtitlingUrl ?? '#'
        ];
    }
}

// Extraer enlaces de Temporadas
$seasonNodes = $xpath->query('//div[contains(@class, "season-wrap")]/a');
if ($seasonNodes->length > 0) {
    foreach ($seasonNodes as $node) {
        $seasonHref = $node->getAttribute('href');
        $extractedData['seasons'][] = [
            'name' => trim($node->nodeValue),
            // ✨ SOLUCIÓN: Usar la función para resolver la URL correctamente
            'url' => resolve_url($url, $seasonHref),
            'is_active' => strpos($node->getAttribute('class'), 'active') !== false
        ];
    }
}

// Extraer enlaces de Capítulos/Episodios
$episodeNodes = $xpath->query('//div[contains(@class, "episode-wrap")]/a');
if ($episodeNodes->length > 0) {
    foreach ($episodeNodes as $node) {
        $episodeHref = $node->getAttribute('href');
        $extractedData['episodes'][] = [
            'name' => trim($node->nodeValue),
            // ✨ SOLUCIÓN: Usar la función para resolver la URL correctamente
            'url' => resolve_url($url, $episodeHref),
            'is_active' => strpos($node->getAttribute('class'), 'active') !== false
        ];
    }
}

// ---- RESPUESTA FINAL ----
$response['status'] = 'success';
$response['message'] = 'Datos extraídos correctamente.';
$response['data'] = $extractedData;

if (isset($_GET['json']) && $_GET['json'] == '1') {
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    libxml_clear_errors();
    exit();
}

?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fly TV Player</title>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css">
    <style>
        :root {
            --primary-color: #00aaff;
            --background-color: #000;
            --controls-background: rgba(20, 20, 20, 0.85);
            --text-color: #fff;
            --icon-color: #fff;
            --hover-color: #00aaff;
            --popup-background: rgba(30, 30, 30, 0.95);
            --error-color: #ff4757;
        }

        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background-color: var(--background-color);
            font-family: 'Roboto', sans-serif;
            overflow: hidden;
        }

        #fly-player-container {
            width: 100%;
            height: 100%;
            position: relative;
            background-color: black;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        #main-video {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        
        #player-ui-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            color: var(--text-color);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            opacity: 1;
            transition: opacity 0.4s ease;
        }
        
        #fly-player-container.inactive #player-ui-overlay .hidable {
            opacity: 0;
            pointer-events: none;
        }

        #watermark {
            position: absolute;
            top: 15px;
            right: 20px;
            font-size: 1.8em; 
            font-weight: bold;
            color: var(--text-color);
            text-shadow: 1px 1px 4px rgba(0,0,0,0.8);
            opacity: 0.7;
        }
        
        #video-title {
            padding: 20px;
            font-size: 1.8em;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            transition: opacity 0.4s ease;
        }

        #controls-bar {
            padding: 10px 15px;
            background: var(--controls-background);
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: opacity 0.4s ease;
        }
        
        .left-controls, .center-controls, .right-controls {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        #controls-bar button {
            background: none;
            border: none;
            color: var(--icon-color);
            font-size: 1.4em;
            cursor: pointer;
            transition: color 0.2s ease, transform 0.2s ease;
            padding: 5px;
        }
        
        #controls-bar button:hover {
            color: var(--hover-color);
            transform: scale(1.1);
        }

        .popup-menu {
            position: absolute;
            bottom: 65px;
            right: 20px;
            background: var(--popup-background);
            border-radius: 5px;
            padding: 10px;
            display: none;
            flex-direction: column;
            gap: 5px;
            min-width: 180px;
            box-shadow: 0 0 15px rgba(0,0,0,0.5);
            animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .popup-menu div, .popup-menu button {
            background: none;
            border: none;
            color: var(--text-color);
            text-align: left;
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 3px;
            white-space: nowrap;
        }
        
        .popup-menu div:hover, .popup-menu button:hover {
            background-color: var(--primary-color);
        }
        
        .popup-menu .active {
             font-weight: bold;
             color: var(--primary-color);
        }
        
        #playlist-menu {
            max-height: 40vh;
            overflow-y: auto;
        }

        #loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 100;
        }

        .spinner {
            border: 8px solid #f3f3f3;
            border-top: 8px solid var(--primary-color);
            border-radius: 50%;
            width: 60px;
            height: 60px;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

    </style>
</head>
<body>

    <div id="fly-player-container">
        <video id="main-video"></video>
        
        <div id="loading-overlay">
            <div class="spinner"></div>
        </div>

        <div id="player-ui-overlay">
            <div id="watermark">Fly Tv</div>
            <div id="video-title" class="hidable"></div>

            <div id="controls-bar" class="hidable">
                <div class="left-controls">
                    <button id="play-pause-btn" class="icon" title="Reproducir/Pausar"><i class="fas fa-play"></i></button>
                </div>
                <div class="center-controls"></div>
                <div class="right-controls">
                    <button id="subtitles-btn" class="icon" title="Subtítulos"><i class="fas fa-closed-captioning"></i></button>
                    <button id="settings-btn" class="icon" title="Ajustes"><i class="fas fa-cog"></i></button>
                    <button id="playlist-btn" class="icon" title="Lista de Episodios"><i class="fas fa-list"></i></button>
                    <button id="cast-btn" class="icon" title="Transmitir"><i class="fas fa-satellite-dish"></i></button>
                    <button id="fullscreen-btn" class="icon" title="Pantalla Completa"><i class="fas fa-expand"></i></button>
                </div>
            </div>

            <div id="subtitles-menu" class="popup-menu"></div>
            <div id="settings-menu" class="popup-menu">
                <div id="quality-submenu"></div>
            </div>
            <div id="playlist-menu" class="popup-menu"></div>
        </div>
    </div>

    <script type="application/json" id="videoData">
        <?php echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>
    </script>

    <script>
    document.addEventListener('DOMContentLoaded', () => {
        // --- ELEMENTOS DEL DOM ---
        const playerContainer = document.getElementById('fly-player-container');
        const video = document.getElementById('main-video');
        const videoTitle = document.getElementById('video-title');
        const playPauseBtn = document.getElementById('play-pause-btn');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const subtitlesBtn = document.getElementById('subtitles-btn');
        const settingsBtn = document.getElementById('settings-btn');
        const playlistBtn = document.getElementById('playlist-btn');
        const castBtn = document.getElementById('cast-btn');
        const subtitlesMenu = document.getElementById('subtitles-menu');
        const settingsMenu = document.getElementById('settings-menu');
        const qualitySubmenu = document.getElementById('quality-submenu');
        const playlistMenu = document.getElementById('playlist-menu');
        const loadingOverlay = document.getElementById('loading-overlay');
        
        let inactivityTimer;

        // --- INICIALIZACIÓN Y ACTUALIZACIÓN ---
        function initPlayer(data) {
            videoTitle.textContent = data.title;
            videoTitle.style.color = 'var(--text-color)'; // Reset color on new load

            video.innerHTML = '';
            
            if (data.streams && data.streams.length > 0) {
                video.src = data.streams[0].url; 
            } else {
                console.error("No se encontraron streams de video.");
                videoTitle.textContent += " (Video no disponible)";
                return;
            }
            
            data.subtitles.forEach(sub => {
                const track = document.createElement('track');
                track.kind = 'subtitles';
                track.label = sub.label;
                track.srclang = sub.language;
                track.src = sub.url;
                track.mode = 'disabled';
                video.appendChild(track);
            });
            
            populateQualityMenu(data.streams);
            populateSubtitlesMenu(data.subtitles);
            populatePlaylistMenu(data.seasons, data.episodes);
        }

        // --- CONTROL DE EVENTOS ---
        playPauseBtn.addEventListener('click', togglePlayPause);
        video.addEventListener('play', () => playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>');
        video.addEventListener('pause', () => playPauseBtn.innerHTML = '<i class="fas fa-play"></i>');
        video.addEventListener('click', togglePlayPause);
        fullscreenBtn.addEventListener('click', toggleFullscreen);

        settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(settingsMenu); });
        subtitlesBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(subtitlesMenu); });
        playlistBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(playlistMenu); });
        
        document.addEventListener('click', () => hideAllPopups());

        playerContainer.addEventListener('mousemove', resetInactivityTimer);
        playerContainer.addEventListener('click', (e) => {
            if (e.target === playerContainer || e.target === video) {
                hideAllPopups();
            }
             resetInactivityTimer();
        });
        resetInactivityTimer();

        castBtn.addEventListener('click', () => {
             if (typeof video.remote === 'object' && video.remote.prompt) {
                video.remote.prompt().catch(error => console.error('Error al iniciar cast:', error));
            } else {
                alert('La transmisión remota no es compatible o no hay dispositivos disponibles.');
            }
        });


        // --- FUNCIONES DE CONTROL ---
        function togglePlayPause() {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
        
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                playerContainer.requestFullscreen().catch(err => alert(`Error: ${err.message}`));
            } else {
                document.exitFullscreen();
            }
        }
        
        function hideAllPopups(){
            subtitlesMenu.style.display = 'none';
            settingsMenu.style.display = 'none';
            playlistMenu.style.display = 'none';
        }
        
        function toggleMenu(menu) {
            const isVisible = menu.style.display === 'block';
            hideAllPopups();
            if (!isVisible) {
                menu.style.display = 'block';
            }
        }

        function resetInactivityTimer() {
            playerContainer.classList.remove('inactive');
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                if (video.paused || subtitlesMenu.style.display === 'block' || settingsMenu.style.display === 'block' || playlistMenu.style.display === 'block') {
                    resetInactivityTimer();
                    return;
                }
                playerContainer.classList.add('inactive');
            }, 4000);
        }

        // --- MENÚS DINÁMICOS ---
        function populateQualityMenu(streams) {
            qualitySubmenu.innerHTML = '<h4>Calidad</h4>';
            streams.forEach((stream) => {
                const item = document.createElement('div');
                item.textContent = stream.quality;
                if (video.src === stream.url) item.classList.add('active');
                item.onclick = () => changeQuality(stream.url, item);
                qualitySubmenu.appendChild(item);
            });
        }

        function changeQuality(newUrl, selectedItem) {
            const currentTime = video.currentTime;
            const wasPlaying = !video.paused;
            video.src = newUrl;
            video.load();
            video.addEventListener('loadeddata', () => {
                video.currentTime = currentTime;
                if (wasPlaying) video.play();
            }, { once: true });
            
            Array.from(qualitySubmenu.children).forEach(child => child.classList.remove('active'));
            selectedItem.classList.add('active');
            settingsMenu.style.display = 'none';
        }

        function populateSubtitlesMenu(subtitles) {
            subtitlesMenu.innerHTML = '<h4>Subtítulos</h4>';
            const offItem = document.createElement('div');
            offItem.textContent = 'Desactivado';
            offItem.classList.add('active');
            offItem.onclick = () => {
                Array.from(video.textTracks).forEach(track => track.mode = 'disabled');
                Array.from(subtitlesMenu.children).forEach(child => child.classList.remove('active'));
                offItem.classList.add('active');
                hideAllPopups();
            };
            subtitlesMenu.appendChild(offItem);

            subtitles.forEach(sub => {
                const item = document.createElement('div');
                item.textContent = sub.label;
                item.onclick = () => {
                    Array.from(video.textTracks).forEach(track => {
                        track.mode = (track.language === sub.language && track.label === sub.label) ? 'showing' : 'disabled';
                    });
                    Array.from(subtitlesMenu.children).forEach(child => child.classList.remove('active'));
                    item.classList.add('active');
                    hideAllPopups();
                };
                subtitlesMenu.appendChild(item);
            });
        }
        
        function populatePlaylistMenu(seasons, episodes) {
            playlistMenu.innerHTML = '';
            const hasSeasons = seasons && seasons.length > 0;
            const hasEpisodes = episodes && episodes.length > 0;

            if (!hasSeasons && !hasEpisodes) {
                playlistBtn.style.display = 'none';
                return;
            }
            playlistBtn.style.display = 'inline-block';

            if (hasSeasons) {
                playlistMenu.appendChild(Object.assign(document.createElement('h4'), { textContent: 'Temporadas' }));
                seasons.forEach(season => {
                    const item = Object.assign(document.createElement('div'), { textContent: season.name });
                    if(season.is_active) item.classList.add('active');
                    item.onclick = (e) => {
                        e.stopPropagation();
                        if (!season.is_active) loadMedia(season.url);
                    };
                    playlistMenu.appendChild(item);
                });
            }
            
             if (hasEpisodes) {
                playlistMenu.appendChild(Object.assign(document.createElement('h4'), { textContent: hasSeasons ? 'Episodios' : 'Partes' }));
                episodes.forEach(ep => {
                    const item = Object.assign(document.createElement('div'), { textContent: ep.name });
                    if (ep.is_active) item.classList.add('active');
                    item.onclick = (e) => {
                         e.stopPropagation();
                         if (!ep.is_active) loadMedia(ep.url);
                    };
                    playlistMenu.appendChild(item);
                });
             }
        }
        
        // --- FUNCIÓN CLAVE PARA CARGAR NUEVO CONTENIDO ---
        function loadMedia(mediaUrl) {
            console.log(`Solicitando nueva URL: ${mediaUrl}`);
            loadingOverlay.style.display = 'flex';
            hideAllPopups();
            
            const fetchUrl = `?i=${encodeURIComponent(mediaUrl)}&json=1`;
            
            fetch(fetchUrl)
                .then(response => {
                    if (!response.ok) throw new Error(`Error de red: ${response.statusText}`);
                    return response.json();
                })
                .then(newData => {
                    if (newData.status === 'success' && newData.data) {
                        initPlayer(newData.data);
                        video.play();
                    } else {
                        throw new Error(newData.message || 'La respuesta no contenía datos válidos.');
                    }
                })
                .catch(error => {
                    // ✨ MEJORA: Mostrar error en la UI en lugar de un alert
                    console.error('Error al cargar nuevo contenido:', error);
                    videoTitle.textContent = `Error: ${error.message}`;
                    videoTitle.style.color = 'var(--error-color)';
                })
                .finally(() => {
                    loadingOverlay.style.display = 'none';
                });
        }


        // --- ARRANQUE INICIAL ---
        const dataScript = document.getElementById('videoData');
        try {
            const parsedData = JSON.parse(dataScript.textContent);
            if (parsedData.status !== 'success' || !parsedData.data) {
                throw new Error(parsedData.message || "No se pudieron cargar los datos iniciales.");
            }
            initPlayer(parsedData.data);
        } catch (e) {
            playerContainer.innerHTML = `<h1>Error al iniciar el reproductor: ${e.message}</h1>`;
            console.error(e);
        }
    });
    </script>

</body>
</html>
<?php
libxml_clear_errors();
?>
