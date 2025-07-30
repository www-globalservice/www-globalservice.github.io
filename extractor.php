<?php

/**
 * Professional Web Scraper for Movies and TV Series
 *
 * This script fetches data from a given URL, intelligently determines if the content
 * is a movie or a TV series, and performs a deep extraction. For series, it
 * concurrently fetches data for all episodes across all seasons to ensure
 * high performance.
 *
 * @version 2.0
 * @author Gemini
 */

// ---- CONFIGURACIÓN INICIAL ----

// 1. Indicar que la respuesta será en formato JSON con codificación UTF-8
header('Content-Type: application/json; charset=utf-8');
// 2. Permitir que cualquier dominio (tu JS) pueda solicitar datos (CORS)
header('Access-Control-Allow-Origin: *');

// Desactivar la notificación de errores de HTML para que el parser no falle
libxml_use_internal_errors(true);

// ---- RESPUESTA ESTÁNDAR ----
$response = [
    'status' => 'error', // Puede ser 'success' o 'error'
    'message' => '',     // Mensaje descriptivo
    'data' => null       // Aquí irán los datos extraídos
];

// ---- FUNCIONES MODULARES ----

/**
 * Realiza una solicitud cURL a una URL y devuelve el contenido HTML.
 *
 * @param string $url La URL a la que se va a solicitar.
 * @return string|false El contenido HTML o false en caso de error.
 */
function fetch_page_content(string $url): string|false
{
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15); // Timeout de 15 segundos
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    $htmlContent = curl_exec($ch);
    if (curl_errno($ch)) {
        // En un entorno de producción, aquí se podría registrar el error específico.
        // error_log('cURL error fetching ' . $url . ': ' . curl_error($ch));
        curl_close($ch);
        return false;
    }
    curl_close($ch);
    return $htmlContent;
}

/**
 * Realiza múltiples solicitudes cURL de forma concurrente.
 *
 * @param array $urls Array de URLs a solicitar.
 * @return array Array asociativo de ['url' => 'contenido_html']. Las URLs que fallaron no estarán en el resultado.
 */
function fetch_multiple_pages(array $urls): array
{
    $multi_handle = curl_multi_init();
    $handles = [];
    $results = [];

    foreach ($urls as $url) {
        if (empty($url)) continue;
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        $handles[$url] = $ch;
        curl_multi_add_handle($multi_handle, $ch);
    }

    $running = null;
    do {
        curl_multi_exec($multi_handle, $running);
        curl_multi_select($multi_handle); // Evita el uso intensivo de la CPU
    } while ($running > 0);

    foreach ($handles as $url => $ch) {
        $html = curl_multi_getcontent($ch);
        if ($html !== false && !empty($html)) {
            $results[$url] = $html;
        }
        curl_multi_remove_handle($multi_handle, $ch);
    }

    curl_multi_close($multi_handle);
    return $results;
}

/**
 * Extrae y decodifica el bloque JSON __NEXT_DATA__ del HTML.
 *
 * @param string $htmlContent El HTML de la página.
 * @return object|null El objeto JSON decodificado o null si no se encuentra o hay un error.
 */
function extract_next_data_from_html(string $htmlContent): ?object
{
    if (empty($htmlContent)) return null;
    $doc = new DOMDocument();
    @$doc->loadHTML($htmlContent);
    $xpath = new DOMXPath($doc);
    $scriptNode = $xpath->query('//script[@id="__NEXT_DATA__"]')->item(0);

    if (!$scriptNode) return null;

    $jsonData = json_decode($scriptNode->nodeValue);
    return (json_last_error() === JSON_ERROR_NONE) ? $jsonData : null;
}

/**
 * Resuelve una URL relativa o absoluta a una URL completa.
 *
 * @param string $baseUrl La URL base de la página actual.
 * @param string $href El valor del atributo href.
 * @return string La URL absoluta y completa.
 */
function resolve_url(string $baseUrl, string $href): string
{
    if (str_starts_with($href, 'http')) {
        return $href;
    }
    $base_parts = parse_url($baseUrl);
    $scheme = $base_parts['scheme'] ?? 'http';
    $host = $base_parts['host'] ?? '';
    if (str_starts_with($href, '/')) {
        return $scheme . '://' . $host . $href;
    }
    $path = dirname($base_parts['path'] ?? '');
    return $scheme . '://' . $host . $path . '/' . $href;
}


/**
 * Extrae los enlaces de streaming de un objeto de datos __NEXT_DATA__.
 *
 * @param object $pageProps La sección pageProps del JSON.
 * @return array La lista de streams.
 */
function extract_streams(object $pageProps): array
{
    $streams = [];
    if (!empty($pageProps->mediaInfoList)) {
        foreach ($pageProps->mediaInfoList as $media) {
            $streams[] = [
                'quality' => $media->currentDefinition ?? 'N/A',
                'url' => $media->mediaUrl ?? '#'
            ];
        }
    }
    return $streams;
}

/**
 * Extrae los enlaces de subtítulos de un objeto de datos __NEXT_DATA__.
 *
 * @param object $pageProps La sección pageProps del JSON.
 * @return array La lista de subtítulos.
 */
function extract_subtitles(object $pageProps): array
{
    $subtitles = [];
    if (!empty($pageProps->episodeVo[0]->subtitlingList)) {
        foreach ($pageProps->episodeVo[0]->subtitlingList as $subtitle) {
            $subtitles[] = [
                'language' => $subtitle->language ?? 'N/A',
                'url' => $subtitle->subtitlingUrl ?? '#'
            ];
        }
    }
    return $subtitles;
}

// ---- LÓGICA PRINCIPAL ----

// 1. Validar y sanitizar la URL de entrada
if (!isset($_GET['i']) || empty($_GET['i'])) {
    $response['message'] = 'Acceso denegado, se requiere un parámetro de URL válido.';
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit();
}
$mainUrl = filter_var($_GET['i'], FILTER_SANITIZE_URL);

// 2. Obtener el contenido de la URL principal
$initialHtml = fetch_page_content($mainUrl);
if (!$initialHtml) {
    $response['message'] = 'No se pudo obtener el contenido de la URL principal.';
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit();
}

// 3. Parsear el HTML y el JSON principal
$initialNextData = extract_next_data_from_html($initialHtml);
if (!$initialNextData) {
    $response['message'] = 'No se encontró o no se pudo decodificar el bloque de datos JSON (__NEXT_DATA__) en la página principal.';
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit();
}

$doc = new DOMDocument();
@$doc->loadHTML($initialHtml);
$xpath = new DOMXPath($doc);

// 4. Detección Inteligente: ¿Película o Serie?
$seasonNodes = $xpath->query('//div[contains(@class, "season-wrap")]/a');
$isSeries = $seasonNodes && $seasonNodes->length > 0;

$extractedData = [];

if ($isSeries) {
    // --- FLUJO PARA SERIES DE TV ---
    $pageProps = $initialNextData->props->pageProps;
    $extractedData = [
        'type' => 'series',
        'title' => $pageProps->name ?? 'N/A',
        'seasons' => []
    ];

    // Se asume que la página inicial muestra los episodios de la primera temporada o de la temporada activa.
    // El scraper visitará cada página de temporada para obtener la lista completa de episodios.
    
    $seasons_info = [];
    foreach ($seasonNodes as $node) {
        $seasons_info[] = [
            'name' => trim($node->nodeValue),
            'url' => resolve_url($mainUrl, $node->getAttribute('href'))
        ];
    }

    $episode_jobs = []; // Almacenará la información de todos los episodios a procesar
    $seasons_map = []; // Estructura final de temporadas y episodios (solo nombres)

    // Es más eficiente obtener la lista de episodios de cada temporada secuencialmente
    // para luego hacer una única gran petición concurrente para todos los episodios.
    foreach ($seasons_info as $season) {
        $season_html = fetch_page_content($season['url']);
        if (!$season_html) continue;

        $season_doc = new DOMDocument();
        @$season_doc->loadHTML($season_html);
        $season_xpath = new DOMXPath($season_doc);
        $episodeNodes = $season_xpath->query('//div[contains(@class, "episode-wrap")]/a');
        
        $current_season_episodes = [];
        if ($episodeNodes->length > 0) {
            foreach ($episodeNodes as $ep_node) {
                $episode_name = trim($ep_node->nodeValue);
                $episode_url = resolve_url($season['url'], $ep_node->getAttribute('href'));
                
                // Añadir a la lista de trabajos
                $episode_jobs[$episode_url] = [
                    'season_name' => $season['name'],
                    'episode_name' => $episode_name
                ];
                
                // Añadir placeholder a la estructura
                $current_season_episodes[] = [
                    'name' => $episode_name,
                    'streams' => [],
                    'subtitles' => []
                ];
            }
        }
        $seasons_map[$season['name']] = ['name' => $season['name'], 'episodes' => $current_season_episodes];
    }
    
    // Ahora, procesar todos los episodios de forma concurrente
    $episode_urls = array_keys($episode_jobs);
    $episode_html_results = fetch_multiple_pages($episode_urls);

    foreach ($episode_html_results as $url => $html) {
        $job_info = $episode_jobs[$url];
        $episode_data = extract_next_data_from_html($html);

        if ($episode_data && isset($episode_data->props->pageProps)) {
            $streams = extract_streams($episode_data->props->pageProps);
            $subtitles = extract_subtitles($episode_data->props->pageProps);

            // Encontrar y actualizar el episodio en el mapa de temporadas
            $season_key = $job_info['season_name'];
            if(isset($seasons_map[$season_key])) {
                foreach ($seasons_map[$season_key]['episodes'] as $ep_index => &$ep) {
                    if ($ep['name'] === $job_info['episode_name']) {
                        $ep['streams'] = $streams;
                        $ep['subtitles'] = $subtitles;
                        break;
                    }
                }
            }
        }
    }
    
    // Transferir el mapa a la estructura de datos final
    $extractedData['seasons'] = array_values($seasons_map);

} else {
    // --- FLUJO PARA PELÍCULAS ---
    $pageProps = $initialNextData->props->pageProps;
    $extractedData = [
        'type' => 'movie',
        'title' => $pageProps->name ?? 'N/A',
        'streams' => extract_streams($pageProps),
        'subtitles' => extract_subtitles($pageProps)
    ];
}


// ---- RESPUESTA FINAL ----
$response['status'] = 'success';
$response['message'] = 'Datos extraídos correctamente.';
$response['data'] = $extractedData;

// Imprimir el array final como una cadena JSON bien formateada
echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

// Limpiar errores de libxml del buffer
libxml_clear_errors();
?>
