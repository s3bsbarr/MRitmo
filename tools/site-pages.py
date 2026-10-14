#!/usr/bin/env python3
"""
Shared pieces of mritmo.com (1.9): one footer, share tags (og:image) and the
page shell for the new pages. Re-runnable; edits site/ in place.

    python3 tools/site-pages.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')

FOOTER = """    <footer>
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
    </footer>"""

THEME = """      <div class="right">
        <div class="theme" role="group" aria-label="Tema">
          <button type="button" data-set-theme="system" aria-pressed="true" aria-label="Tema del sistema" title="Sistema"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/></svg></button>
          <button type="button" data-set-theme="light" aria-pressed="false" aria-label="Tema claro" title="Claro"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>
          <button type="button" data-set-theme="dark" aria-pressed="false" aria-label="Tema oscuro" title="Oscuro"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg></button>
        </div>
      </div>"""


def share_tags(title, description, path):
    return f"""  <meta property="og:type" content="website">
  <meta property="og:site_name" content="MRitmo">
  <meta property="og:locale" content="es_CO">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:url" content="https://mritmo.com{path}">
  <meta property="og:image" content="https://mritmo.com/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="El personaje de MRitmo dormido, sentado, de pie y celebrando, con el texto: Mide tu día en tiempo, no en tareas.">
  <meta name="twitter:card" content="summary_large_image">
"""


def page(path, title, description, main, extra_head='', scripts='<script src="/site.js?v=__V__"></script>'):
    return f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta name="theme-color" content="#f7f3ea" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
{share_tags(title, description, path)}  <link rel="icon" href="/favicon.png">
  <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/style.css?v=__V__">
  <script>try{{var t=localStorage.getItem('mritmo.theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}}catch(e){{}}</script>
{extra_head}</head>
<body>
  <a class="skip" href="#contenido">Saltar al contenido</a>
  <div class="wrap">
    <header class="top">
      <a class="brand" href="/" aria-label="MRitmo, inicio"><img src="/icon.png" alt="" width="30" height="30">MRitmo</a>
{THEME}
    </header>
    <main id="contenido" class="doc">
{main}
    </main>
{FOOTER}
  </div>
  {scripts}
</body>
</html>
"""


def write(rel, html):
    p = os.path.join(SITE, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf8').write(html)
    print('escrito', rel)


def unify_existing():
    """Same footer on every page; share image tags where a page has none."""
    for dirpath, _, files in os.walk(SITE):
        for f in files:
            if not (f.endswith('.html') or f.endswith('.php')):
                continue
            p = os.path.join(dirpath, f)
            s = open(p, encoding='utf8').read()
            s2 = re.sub(r'    <footer>.*?</footer>', FOOTER, s, flags=re.S)
            if 'og:image' not in s2:
                rel = '/' + os.path.relpath(dirpath, SITE).replace('.', '').strip('/')
                rel = (rel.rstrip('/') + '/') if rel != '/' else '/'
                t = re.search(r'<title>(.*?)</title>', s2).group(1)
                d = re.search(r'<meta name="description" content="(.*?)">', s2).group(1)
                s2 = s2.replace('  <link rel="icon"', share_tags(t, d, rel) + '  <link rel="icon"', 1)
            if s2 != s:
                open(p, 'w', encoding='utf8').write(s2)
                print('pie/etiquetas', os.path.relpath(p, SITE))


# ─── Pages ───────────────────────────────────────────────────────────────────

AYUDA = open(os.path.join(ROOT, 'tools', 'pages', 'ayuda.html'), encoding='utf8').read()
ELIMINAR = open(os.path.join(ROOT, 'tools', 'pages', 'eliminar-cuenta.html'), encoding='utf8').read()
NOVEDADES = open(os.path.join(ROOT, 'tools', 'pages', 'novedades.html'), encoding='utf8').read()

if __name__ == '__main__':
    write('ayuda/index.html', page('/ayuda/', 'Ayuda · MRitmo',
        'Instalar el APK, Play Protect, apps desconocidas, ahorro de batería de Samsung, Now Bar, widgets y cómo agregar amigos en MRitmo.', AYUDA))
    write('eliminar-cuenta/index.html', page('/eliminar-cuenta/', 'Eliminar tu cuenta · MRitmo',
        'Cómo eliminar tu cuenta de MRitmo y todos tus datos, desde la app o por correo, qué se borra y en cuánto tiempo.', ELIMINAR))
    write('novedades/index.html', page('/novedades/', 'Novedades · MRitmo',
        'Qué cambió en cada versión de MRitmo, explicado para quien la usa.', NOVEDADES))
    unify_existing()
