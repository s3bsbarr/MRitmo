/* MRitmo · mritmo.com — draws the app's pixel character and shows the latest version. */
(function () {
  var REPO = 's3bsbarr/MRitmo';
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');

  function draw() {
    var data = window.MRITMO_SPRITES;
    if (!data) return;
    var palette = data.colors[dark && dark.matches ? 'dark' : 'light'];
    var list = document.querySelectorAll('canvas[data-mood]');
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var rows = (data.sprites[c.getAttribute('data-gender') || 'm'] || {})[c.getAttribute('data-mood')];
      if (!rows) continue;
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

  function version() {
    var spots = document.querySelectorAll('[data-version]');
    if (!spots.length || !window.fetch) return;
    fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rel) {
        if (!rel) return;
        var apk = (rel.assets || []).filter(function (a) { return /\.apk$/i.test(a.name); })[0];
        var v = String(rel.tag_name || '').replace(/^v/, '');
        var mb = apk ? Math.round(apk.size / 1048576) + ' MB' : '';
        var when = rel.published_at ? new Date(rel.published_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
        for (var i = 0; i < spots.length; i++) {
          spots[i].textContent = ['Versión ' + v, mb, when].filter(Boolean).join(' · ');
        }
      })
      .catch(function () {});
  }

  draw();
  version();
  if (dark && dark.addEventListener) dark.addEventListener('change', draw);
})();
