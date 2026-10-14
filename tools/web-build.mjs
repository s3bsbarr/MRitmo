#!/usr/bin/env node
/**
 * mritmo.com build step (1.9), run by the "Web" flow before publishing site/:
 *
 *   node tools/web-build.mjs [release.json] [sha256]
 *
 * - Renders site/novedades/index.html from site/novedades/notas.json (the one
 *   place where release notes for people are written).
 * - With the latest release's data, writes site/version.json: version, size,
 *   date, the APK's SHA-256 and that version's notes. The site shows it next to
 *   the download button and the app reads it to offer updates.
 *
 * Without arguments it only renders /novedades (handy locally).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = (p) => join(root, 'site', p);
const notes = JSON.parse(readFileSync(site('novedades/notas.json'), 'utf8'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const longDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
};
const anchor = (v) => `v${v.replace(/\./g, '-')}`;

const html = notes
  .map(
    (n, i) => `      <article class="release" id="${anchor(n.version)}">
        <h2>MRitmo ${esc(n.version)}${i === 0 ? ' <span class="tag">La más reciente</span>' : ''}</h2>
        <p class="when"><time datetime="${esc(n.date)}">${longDate(n.date)}</time></p>
        <p>${esc(n.title)}</p>
        <ul>
${n.items.map((it) => `          <li>${esc(it)}</li>`).join('\n')}
        </ul>
      </article>`,
  )
  .join('\n');

const page = site('novedades/index.html');
const before = readFileSync(page, 'utf8');
const after = before.replace(/<!-- notas:inicio -->[\s\S]*?<!-- notas:fin -->/, `<!-- notas:inicio -->\n${html}\n      <!-- notas:fin -->`);
if (after === before && !before.includes('<!-- notas:inicio -->')) throw new Error('Faltan las marcas <!-- notas:inicio/fin --> en novedades/index.html');
writeFileSync(page, after);
console.log(`novedades: ${notes.length} versiones`);

const [releaseFile, sha] = process.argv.slice(2);
if (releaseFile) {
  let rel = {};
  try {
    rel = JSON.parse(readFileSync(releaseFile, 'utf8'));
  } catch {}
  const version = rel.version;
  const n = notes.find((x) => x.version === version);
  const out = version
    ? {
        version,
        bytes: rel.bytes || 0,
        published: rel.published || null,
        sha256: /^[0-9a-f]{64}$/.test(sha ?? '') ? sha : null,
        title: n?.title ?? null,
        notes: n?.items ?? [],
        url: 'https://mritmo.com/descargar',
        news: `https://mritmo.com/novedades/#${anchor(version)}`,
      }
    : {};
  writeFileSync(site('version.json'), `${JSON.stringify(out, null, 2)}\n`);
  console.log('version.json', JSON.stringify({ ...out, notes: `${out.notes?.length ?? 0} notas` }));
}
