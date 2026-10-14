<?php
// Invitation bridge: mritmo.com/u/<usuario> (rewritten here by .htaccess).
// PHP only fills the title and share tags, so WhatsApp and others show
// "@usuario te invita a MRitmo" with the share image. Nothing is stored or looked up.
$path = parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '', PHP_URL_PATH);
$user = '';
if (is_string($path) && preg_match('#^/u/([A-Za-z0-9_.]{3,20})/?$#', $path, $m) && !preg_match('/\.(html?|php)$/i', $m[1])) {
  $user = strtolower($m[1]);
}
function e($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
$title = $user !== '' ? '@' . $user . ' te invita a MRitmo' : 'Te invitaron a MRitmo';
$desc = $user !== ''
  ? 'Agrega a @' . $user . ' en MRitmo y vean en vivo el avance del día de cada uno. Solo se comparte el % y los minutos.'
  : 'Agrégalo en MRitmo: avancen juntos, con el día medido en tiempo.';
$url = 'https://mritmo.com/u/' . ($user !== '' ? $user : '');
header('Cache-Control: no-cache');
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title><?= e($title) ?></title>
  <meta name="description" content="<?= e($desc) ?>">
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#f7f3ea" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="MRitmo">
  <meta property="og:locale" content="es_CO">
  <meta property="og:title" content="<?= e($title) ?>">
  <meta property="og:description" content="<?= e($desc) ?>">
  <meta property="og:url" content="<?= e($url) ?>">
  <meta property="og:image" content="https://mritmo.com/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="El personaje de MRitmo dormido, sentado, de pie y celebrando, con el texto: Mide tu día en tiempo, no en tareas.">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.png">
  <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/style.css?v=__V__">
  <script>try{var t=localStorage.getItem('mritmo.theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
</head>
<body class="bridge">
  <!--
    Puente del enlace de invitación: mritmo.com/u/<usuario>.
    Si MRitmo está instalada y el enlace verificado (Android App Links), Android abre
    la app directo y esta página no se ve. Si no, aquí se abre la app (intent) o se descarga.
  -->
  <div class="wrap" style="width:100%">
    <header class="top">
      <a class="brand" href="/" aria-label="MRitmo, inicio"><img src="/icon.png" alt="" width="30" height="30">MRitmo</a>
    </header>
    <main id="contenido">
      <canvas data-gender="f" data-mood="fuerza" width="24" height="26" style="image-rendering:pixelated;width:96px;height:104px" aria-hidden="true"></canvas>
      <h1 id="title">Te invitaron a MRitmo.</h1>
      <p class="lead" id="lead">Agrégalo en la app y vean en vivo el avance del día de cada uno. Solo se comparte el % y los minutos, nunca las tareas.</p>
      <div class="stack" data-android-only>
        <a class="btn" id="open" href="#">Abrir en MRitmo</a>
        <a class="btn secondary" href="/descargar">Descargar MRitmo</a>
      </div>
      <div class="ios-note" data-ios-note hidden role="note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>
        <div><b>MRitmo es solo para Android por ahora.</b><p>No hay versión para iPhone. Si tienes un celular Android, abre este enlace desde él.</p></div>
      </div>
      <p class="hint" id="hint">¿Aún no tienes la app? Descárgala, instálala y vuelve a abrir este enlace: MRitmo te llevará directo a agregarlo. <a href="/#instalar">Cómo instalar</a></p>
    </main>
    <footer>
      <nav aria-label="Información legal y contacto">
        <a href="/novedades/">Novedades</a>
        <a href="/ayuda/">Ayuda</a>
        <a href="/privacidad/">Privacidad</a>
        <a href="/terminos/">Términos</a>
        <a href="/cookies/">Cookies</a>
        <a href="/reembolsos/">Reembolsos</a>
        <a href="/eliminar-cuenta/">Eliminar cuenta</a>
        <a href="mailto:soporte@mritmo.com">soporte@mritmo.com</a>
        <a href="https://github.com/s3bsbarr/MRitmo/releases">Todas las versiones</a>
      </nav>
      <p>© 2026 MRitmo · Proyecto independiente de una persona natural · Bogotá D.C., Colombia · App gratuita, sin anuncios ni rastreadores.</p>
    </footer>
  </div>
  <script src="/sprites.js?v=__V__"></script>
  <script src="/site.js?v=__V__"></script>
  <script>
    (function () {
      var m = location.pathname.match(/^\/u\/([A-Za-z0-9_.]{3,20})\/?$/);
      var user = m && !/\.html?$/i.test(m[1]) ? m[1].toLowerCase() : '';
      var android = /Android/i.test(navigator.userAgent);
      var open = document.getElementById('open');
      if (user) {
        document.title = '@' + user + ' te invita a MRitmo';
        document.getElementById('title').textContent = '@' + user + ' te invita a MRitmo.';
        document.getElementById('lead').textContent = 'Agrega a @' + user + ' y vean en vivo el avance del día de cada uno. Solo se comparte el % y los minutos, nunca las tareas.';
        document.getElementById('hint').firstChild.textContent = '¿Aún no tienes la app? Descárgala, instálala y vuelve a abrir este enlace: te mostrará "Agregar a @' + user + '". ';
      }
      if (android) {
        // Chrome on Android: opens MRitmo if installed (ritmo://agregar/<usuario>), otherwise the download.
        var fallback = encodeURIComponent(location.origin + '/descargar');
        open.href = 'intent://agregar/' + encodeURIComponent(user) + '#Intent;scheme=ritmo;package=com.sebas.ritmo;S.browser_fallback_url=' + fallback + ';end';
      } else if (document.documentElement.classList.contains('ios')) {
        // iPhone: site.js already swapped the buttons for "solo para Android".
        document.getElementById('hint').hidden = true;
      } else {
        open.href = '/';
        open.textContent = 'Conocer MRitmo';
        document.getElementById('hint').textContent = 'MRitmo es una app para Android. Abre este enlace desde tu celular Android para agregar' + (user ? ' a @' + user : '') + '.';
      }
    })();
  </script>
</body>
</html>
