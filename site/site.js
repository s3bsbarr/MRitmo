/* MRitmo · mritmo.com — theme switch, the app's pixel character and the latest version.
   No cookies, no analytics, no third-party requests: the only thing stored is the theme
   the visitor picks (localStorage "mritmo.theme"), and it never leaves the browser. */
(function () {
  var KEY = 'mritmo.theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var COLORS = { light: '#f7f3ea', dark: '#000000' };

  function stored() {
    try {
      var t = window.localStorage.getItem(KEY);
      return t === 'light' || t === 'dark' ? t : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function effective(choice) {
    if (choice === 'light' || choice === 'dark') return choice;
    return media && media.matches ? 'dark' : 'light';
  }

  function apply(choice) {
    if (choice === 'light' || choice === 'dark') root.setAttribute('data-theme', choice);
    else root.removeAttribute('data-theme');
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      // An explicit choice overrides both system-specific metas.
      var m = metas[i];
      var scheme = m.getAttribute('data-scheme') || (/dark/.test(m.getAttribute('media') || '') ? 'dark' : 'light');
      m.setAttribute('data-scheme', scheme);
      m.setAttribute('content', choice === 'system' ? COLORS[scheme] : COLORS[choice]);
    }
    var buttons = document.querySelectorAll('[data-set-theme]');
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].setAttribute('aria-pressed', buttons[j].getAttribute('data-set-theme') === choice ? 'true' : 'false');
    }
    draw();
  }

  function choose(choice) {
    try {
      if (choice === 'system') window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, choice);
    } catch (e) {}
    apply(choice);
  }

  function draw() {
    var data = window.MRITMO_SPRITES;
    if (!data) return;
    var mode = effective(stored());
    var palette = data.colors[mode];
    if (mode === 'light') {
      // Warm the cool greys (bench and "z") so they sit on the cream page.
      var warm = {};
      for (var k in palette) warm[k] = palette[k];
      warm.B = '#e2dbcc';
      warm.Z = '#9f9888';
      palette = warm;
    }
    var list = document.querySelectorAll('canvas[data-mood]');
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var rows = (data.sprites[c.getAttribute('data-gender') || 'm'] || {})[c.getAttribute('data-mood')];
      if (!rows || !c.getContext) continue;
      c.width = 24;
      c.height = 26;
      var ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 24, 26);
      for (var y = 0; y < rows.length; y++) {
        for (var x = 0; x < rows[y].length; x++) {
          var ch = rows[y][x];
          if (ch === '.' || !palette[ch]) continue;
          ctx.fillStyle = palette[ch];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  // Version, size and date of the latest APK. /version.json is written on mritmo.com
  // itself every time a release is published, so visitors never call GitHub's API.
  function version() {
    var spots = document.querySelectorAll('[data-version]');
    if (!spots.length || !window.fetch) return;
    fetch('/version.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rel) {
        if (!rel || !rel.version) return;
        var mb = rel.bytes ? Math.round(rel.bytes / 1048576) + ' MB' : '';
        var when = rel.published ? new Date(rel.published).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
        for (var i = 0; i < spots.length; i++) {
          spots[i].textContent = ['Versión ' + rel.version, mb, when].filter(Boolean).join(' · ');
        }
      })
      .catch(function () {});
  }

  var buttons = document.querySelectorAll('[data-set-theme]');
  for (var b = 0; b < buttons.length; b++) {
    buttons[b].addEventListener('click', function (e) {
      choose(e.currentTarget.getAttribute('data-set-theme'));
    });
  }
  if (media) {
    var onChange = function () { if (stored() === 'system') draw(); };
    if (media.addEventListener) media.addEventListener('change', onChange);
    else if (media.addListener) media.addListener(onChange);
  }

  apply(stored());
  version();
})();
