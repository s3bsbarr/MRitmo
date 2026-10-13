export function formatMinutes(min: number) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

export function formatShort(min: number) {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function longDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const name = DAYS[date.getDay()];
  return `${name[0].toUpperCase()}${name.slice(1)}, ${d} de ${MONTHS[m - 1]}`;
}

export function dayInitial(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return DAYS_SHORT[new Date(y, m - 1, d).getDay()];
}

/** "3:05 p. m." from epoch ms. */
export function timeLabel(at: number) {
  const d = new Date(at);
  return clock12(d.getHours(), d.getMinutes());
}

/** "8:30 a. m." from "HH:MM". */
export function hhmmLabel(time: string) {
  const [h, m] = time.split(':').map(Number);
  return clock12(h || 0, m || 0);
}

export function clock12(h: number, m: number) {
  const suffix = h >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** "Hoy", "Mañana", or "Mié 14" relative to `today`. */
export function dayChip(key: string, today: string) {
  if (key === today) return 'Hoy';
  const [y, m, d] = key.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const diff = Math.round((new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86_400_000);
  if (diff === 1) return 'Mañana';
  return `${SHORT_DAYS[new Date(y, m - 1, d).getDay()]} ${d}`;
}
