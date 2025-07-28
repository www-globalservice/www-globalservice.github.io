<?php
// ---- CONFIGURACIÓN INICIAL ----
// 1. Indicar que la respuesta será en formato JSON
header('Content-Type: application/json; charset=utf-8');
// 2. Permitir que cualquier dominio (tu JS) pueda solicitar datos (CORS)
header('Access-Control-Allow-Origin: *');

// Desactivar la notificación de errores de HTML para que el parser no falle
libxml_use_internal_errors(true);

// ---- RESPUESTA ESTÁNDAR ----
// Se crea un array para estructurar la respuesta
$response = [
    'status' => 'error', // Puede ser 'success' o 'error'
    'message' => '',     // Mensaje descriptivo
    'data' => null       // Aquí irán los datos extraídos
];

// ---- LÓGICA PRINCIPAL ----
// 1. Validar que el parámetro 'i' exista
if (!isset($_GET['i']) || empty($_GET['i'])) {
    $response['message'] = 'Acceso denegado, Key no valida';
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit();
}

$url = filter_var($_GET['i'], FILTER_SANITIZE_URL);
// URL base para los enlaces extraídos de temporadas y capítulos
$extractor_base_url = 'https://flysistem.fast-page.org/extractor.php?i=';


// 2. Obtener el contenido de la URL con cURL
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
$htmlContent = curl_exec($ch);
curl_close($ch);

if (!$htmlContent) {
    $response['message'] = 'No se pudo obtener el contenido de la URL.';
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
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
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit();
}

$jsonData = json_decode($scriptNode->nodeValue);

if (json_last_error() !== JSON_ERROR_NONE) {
    $response['message'] = 'Error al decodificar los datos JSON de la página.';
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit();
}

// ---- PROCESAMIENTO DE DATOS ----
$pageProps = $jsonData->props->pageProps;

// Se crea un array para guardar los datos limpios
$extractedData = [
    'title' => $pageProps->name ?? 'N/A',
    'streams' => [],
    'subtitles' => [],
    'seasons' => [],  // Nuevo: para temporadas
    'episodes' => []  // Nuevo: para episodios/capítulos
];

// Extraer enlaces de streaming (desde JSON)
if (!empty($pageProps->mediaInfoList)) {
    foreach ($pageProps->mediaInfoList as $media) {
        $extractedData['streams'][] = [
            'quality' => $media->currentDefinition ?? 'N/A',
            'url' => $media->mediaUrl ?? '#'
        ];
    }
}

// Extraer subtítulos (desde JSON)
if (!empty($pageProps->episodeVo[0]->subtitlingList)) {
    foreach ($pageProps->episodeVo[0]->subtitlingList as $subtitle) {
        $extractedData['subtitles'][] = [
            'language' => $subtitle->language ?? 'N/A',
            'url' => $subtitle->subtitlingUrl ?? '#'
        ];
    }
}

// ---- NUEVA EXTRACCIÓN DE TEMPORADAS Y CAPÍTULOS (desde HTML) ----

// Extraer enlaces de Temporadas
$seasonNodes = $xpath->query('//div[contains(@class, "season-wrap")]/a');
if ($seasonNodes->length > 0) {
    foreach ($seasonNodes as $node) {
        $seasonUrl = $node->getAttribute('href');
        $extractedData['seasons'][] = [
            'name' => trim($node->nodeValue),
            'url' => $extractor_base_url . $seasonUrl,
            'is_active' => strpos($node->getAttribute('class'), 'active') !== false
        ];
    }
}

// Extraer enlaces de Capítulos/Episodios
$episodeNodes = $xpath->query('//div[contains(@class, "episode-wrap")]/a');
if ($episodeNodes->length > 0) {
    foreach ($episodeNodes as $node) {
        $episodeUrl = $node->getAttribute('href');
        $extractedData['episodes'][] = [
            'name' => trim($node->nodeValue),
            'url' => $extractor_base_url . $episodeUrl,
            'is_active' => strpos($node->getAttribute('class'), 'active') !== false
        ];
    }
}


// ---- RESPUESTA FINAL ----
$response['status'] = 'success';
$response['message'] = 'Datos extraídos correctamente.';
$response['data'] = $extractedData;

// Imprimir el array final como una cadena JSON
echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

// Limpiar errores de libxml del buffer
libxml_clear_errors();
?>
