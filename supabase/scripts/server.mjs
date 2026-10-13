#!/usr/bin/env node
/**
 * Ritmo's server, driven from GitHub Actions with a single secret
 * (SUPABASE_ACCESS_TOKEN, a personal access token of the Supabase account).
 *
 *   node supabase/scripts/server.mjs migrate          apply new files in supabase/migrations
 *   node supabase/scripts/server.mjs auth             emails (templates + SMTP), redirect URLs, OTP
 *   node supabase/scripts/server.mjs bot <action> [@usuario]
 *        actions: preparar · solicitud · avanzar · completar · quitar · estado
 *
 * Everything goes through the Supabase Management API, so no database
 * password, Docker or local install is needed.
 */
import { appendFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REF = process.env.SUPABASE_PROJECT_REF || 'qehkinjwkpfmmmyxqjxm';
const API = `https://api.supabase.com/v1/projects/${REF}`;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const BOT_EMAIL = 'amigo.bot@ritmo.app';

function summary(line) {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = typeof body === 'object' && body ? body.message ?? JSON.stringify(body) : String(body);
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${msg}`);
  }
  return body;
}

export const sql = (query) => api('/database/query', { method: 'POST', body: JSON.stringify({ query }) });

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

/* ─── migrate ─────────────────────────────────────────────────────────── */

async function migrate() {
  await sql(`
    create schema if not exists ritmo_admin;
    revoke all on schema ritmo_admin from public;
    create table if not exists ritmo_admin.migrations (name text primary key, applied_at timestamptz not null default now());
  `);
  const applied = new Set(((await sql('select name from ritmo_admin.migrations')) ?? []).map((r) => r.name));
  const dir = join(ROOT, 'supabase', 'migrations');
  const files = (await readdir(dir)).filter((f) => /^\d+_[a-z0-9_]+\.sql$/.test(f)).sort();
  let n = 0;
  for (const f of files) {
    if (applied.has(f)) continue;
    const body = await readFile(join(dir, f), 'utf8');
    try {
      await sql(`begin;\n${body}\n;\ninsert into ritmo_admin.migrations (name) values (${lit(f)});\ncommit;`);
    } catch (e) {
      throw new Error(`La migración ${f} falló y no se aplicó nada de ella.\n${e.message}`);
    }
    summary(`- Migración aplicada: \`${f}\``);
    n++;
  }
  if (n === 0) summary('- Base de datos al día (sin migraciones nuevas).');
}

/* ─── auth ────────────────────────────────────────────────────────────── */

async function auth() {
  const { emails } = await import(join(ROOT, 'supabase', 'templates', 'emails.mjs'));
  const current = await api('/config/auth');

  const patch = {
    mailer_otp_length: 6,
    mailer_otp_exp: 3600,
  };
  for (const [kind, { subject, content }] of Object.entries(emails)) {
    patch[`mailer_subjects_${kind}`] = subject;
    patch[`mailer_templates_${kind}_content`] = content;
  }

  // The app's deep link must be an allowed redirect, or links fall back to the site URL.
  const allow = new Set(String(current.uri_allow_list ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  for (const u of ['ritmo://auth', 'ritmo://**']) allow.add(u);
  patch.uri_allow_list = [...allow].join(',');

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (user && pass) {
    Object.assign(patch, {
      smtp_host: process.env.SMTP_HOST || 'smtp.gmail.com',
      smtp_port: String(process.env.SMTP_PORT || '465'),
      smtp_user: user,
      smtp_pass: pass.replace(/\s+/g, ''),
      smtp_admin_email: process.env.SMTP_FROM || user,
      smtp_sender_name: process.env.SMTP_SENDER_NAME || 'Ritmo',
      smtp_max_frequency: 30,
    });
    // Custom SMTP starts at a low hourly cap; Gmail allows ~500 a day.
    if (!current.rate_limit_email_sent || current.rate_limit_email_sent < 60) patch.rate_limit_email_sent = 60;
    summary(`- Correo: SMTP propio con ${patch.smtp_admin_email} (${patch.smtp_host}:${patch.smtp_port}).`);
  } else {
    summary('- Correo: sin SMTP_USER/SMTP_PASS en los secretos; se mantiene el SMTP que ya tenga el proyecto.');
  }

  await api('/config/auth', { method: 'PATCH', body: JSON.stringify(patch) });
  summary(`- Plantillas en español subidas (${Object.keys(emails).length}). Código de 6 dígitos, válido 1 hora.`);
  summary(`- Redirecciones permitidas: ${patch.uri_allow_list}`);
}

/* ─── bot ─────────────────────────────────────────────────────────────── */

async function secretKey() {
  const keys = await api('/api-keys?reveal=true');
  const k = keys.find((x) => x.type === 'secret') ?? keys.find((x) => x.name === 'service_role');
  if (!k?.api_key) throw new Error('No se encontró una llave secreta del proyecto.');
  return k.api_key;
}

async function ensureBotUser() {
  const found = await sql(`select id from auth.users where email = ${lit(BOT_EMAIL)}`);
  if (found?.[0]?.id) return found[0].id;
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(`https://${REF}.supabase.co`, await secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.createUser({
    email: BOT_EMAIL,
    password: crypto.randomUUID() + crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { bot: true },
  });
  if (error) throw new Error(`No se pudo crear la cuenta del bot: ${error.message}`);
  return data.user.id;
}

const one = async (q) => {
  const rows = await sql(q);
  const row = rows?.[0] ?? {};
  return Object.values(row)[0];
};

async function bot(action, rawUser) {
  switch (action) {
    case 'preparar': {
      const u = String(rawUser ?? '').trim().replace(/^@/, '').toLowerCase();
      if (!/^[a-z0-9_.]{3,20}$/.test(u)) throw new Error('Escribe tu @usuario de Ritmo en el campo "usuario".');
      const id = await ensureBotUser();
      summary(`- ${await one(`select public.ritmo_bot_setup(${lit(id)}, ${lit(u)})`)}`);
      summary(`- ${await one('select public.ritmo_bot_request()')}`);
      summary('- Desde ahora su avance se mueve solo cada minuto entre 7:00 y 21:00 (hora de Bogotá).');
      break;
    }
    case 'solicitud':
      summary(`- ${await one('select public.ritmo_bot_request()')}`);
      break;
    case 'avanzar':
      summary(`- ${await one('select public.ritmo_bot_nudge(30)')}`);
      break;
    case 'completar':
      summary(`- ${await one('select public.ritmo_bot_nudge(100000)')}`);
      break;
    case 'quitar':
      summary(`- ${await one('select public.ritmo_bot_remove()')}`);
      break;
    case 'estado': {
      const rows = await sql(`
        select p.day, p.done_minutes, p.total_minutes, p.focus_until > now() as en_foco
          from public.day_progress p join public.ritmo_bot b on b.id = p.user_id
         order by p.day desc limit 8`);
      summary('| Día | Minutos | % | En foco |\n|---|---|---|---|');
      for (const r of rows ?? []) {
        summary(`| ${r.day} | ${r.done_minutes} de ${r.total_minutes} | ${Math.round((100 * r.done_minutes) / Math.max(1, r.total_minutes))} % | ${r.en_foco ? 'sí' : ''} |`);
      }
      const ev = await sql(`select kind, created_at, result from public.push_events order by id desc limit 5`);
      summary('\n**Últimas notificaciones**\n\n| Tipo | Cuándo (UTC) | Resultado |\n|---|---|---|');
      for (const r of ev ?? []) summary(`| ${r.kind} | ${String(r.created_at).slice(0, 19)} | ${r.result ?? 'pendiente'} |`);
      break;
    }
    default:
      throw new Error(`Acción desconocida: ${action}`);
  }
}

/* ─── main ────────────────────────────────────────────────────────────── */

const [cmd, ...args] = process.argv.slice(2);
if (!TOKEN) {
  summary('Falta el secreto SUPABASE_ACCESS_TOKEN en GitHub (Settings → Secrets and variables → Actions). No se hizo nada.');
  process.exit(cmd === 'bot' ? 1 : 0);
}
try {
  if (cmd === 'migrate') await migrate();
  else if (cmd === 'auth') await auth();
  else if (cmd === 'bot') await bot(args[0], args[1]);
  else throw new Error(`Uso: server.mjs migrate | auth | bot <acción> [@usuario]`);
} catch (e) {
  summary(`**Error:** ${e.message}`);
  process.exit(1);
}
