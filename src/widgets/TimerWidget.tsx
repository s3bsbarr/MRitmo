import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { formatMinutes } from '../format';
import { F, WC } from './colors';

export type TimerState =
  | { kind: 'running'; title: string; endsAt: number; remainingMs: number }
  | { kind: 'paused'; title: string; remainingMs: number }
  | { kind: 'finished'; title: string }
  | { kind: 'next'; title: string; minutes: number }
  | { kind: 'empty' };

type Icon = 'play' | 'pause' | 'check' | 'plus' | 'plus5';

function clock(ms: number) {
  const d = new Date(ms);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const suffix = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

/** 24×24 glyphs drawn as SVG so they stay crisp at any widget density. */
function glyph(icon: Icon, color: string) {
  const stroke = `stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const body: Record<Icon, string> = {
    play: `<path d="M8 5.5v13l10.5-6.5z" fill="${color}"/>`,
    pause: `<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="${color}"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="${color}"/>`,
    check: `<path d="M5 12.5l4.5 4.5L19 7.5" ${stroke}/>`,
    plus: `<path d="M12 5v14M5 12h14" ${stroke}/>`,
    plus5: `<text x="12" y="16.5" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11" fill="${color}">+5</text>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body[icon]}</svg>`;
}

type Btn = { label: string; icon: Icon; action: string; primary?: boolean };

function clickProps(action: string) {
  return action.startsWith('ritmo://')
    ? { clickAction: 'OPEN_URI' as const, clickActionData: { uri: action } }
    : { clickAction: action };
}

/** Round icon button for the 4×1 size. */
function IconButton({ c, b, size }: { c: WC; b: Btn; size: number }) {
  return (
    <FlexWidget
      {...clickProps(b.action)}
      accessibilityLabel={b.label}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: b.primary ? c.ink : c.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
      }}
    >
      <SvgWidget svg={glyph(b.icon, b.primary ? c.inkOnInk : c.text)} style={{ width: size * 0.5, height: size * 0.5 }} />
    </FlexWidget>
  );
}

/** Labelled pill button for the 4×2 size. */
function PillButton({ c, b, width }: { c: WC; b: Btn; width: number }) {
  return (
    <FlexWidget
      {...clickProps(b.action)}
      accessibilityLabel={b.label}
      style={{
        width,
        height: 42,
        borderRadius: 21,
        backgroundColor: b.primary ? c.ink : c.surface,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
      }}
    >
      <SvgWidget svg={glyph(b.icon, b.primary ? c.inkOnInk : c.text)} style={{ width: 16, height: 16 }} />
      <TextWidget text={` ${b.label}`} style={{ fontSize: 14, fontFamily: F.semibold, color: b.primary ? c.inkOnInk : c.text }} />
    </FlexWidget>
  );
}

function contentOf(state: TimerState): { label: string; title: string; detail: string; buttons: Btn[] } {
  switch (state.kind) {
    case 'running':
      return {
        label: 'En foco',
        title: state.title,
        detail: `Termina a las ${clock(state.endsAt)}`,
        buttons: [
          { label: 'Pausar', icon: 'pause', action: 'PAUSE' },
          { label: 'Terminé', icon: 'check', action: 'DONE', primary: true },
        ],
      };
    case 'paused':
      return {
        label: 'En pausa',
        title: state.title,
        detail: `Quedan ${formatMinutes(Math.ceil(state.remainingMs / 60000))}`,
        buttons: [
          { label: 'Seguir', icon: 'play', action: 'START', primary: true },
          { label: 'Terminé', icon: 'check', action: 'DONE' },
        ],
      };
    case 'finished':
      return {
        label: 'Tiempo cumplido',
        title: state.title,
        detail: '¿La terminaste o le das más?',
        buttons: [
          { label: '+5 min', icon: 'plus5', action: 'PLUS5' },
          { label: 'Terminé', icon: 'check', action: 'DONE', primary: true },
        ],
      };
    case 'next':
      return {
        label: 'Siguiente',
        title: state.title,
        detail: formatMinutes(state.minutes),
        buttons: [{ label: 'Iniciar', icon: 'play', action: 'START', primary: true }],
      };
    case 'empty':
      return {
        label: 'Foco',
        title: 'Sin tareas pendientes',
        detail: 'Agrega tu próxima tarea',
        buttons: [{ label: 'Agregar', icon: 'plus', action: 'ritmo://nueva', primary: true }],
      };
  }
}

/**
 * Focus widget, 4×1 or 4×2. Every width is computed from the real widget size,
 * so buttons are never pushed off the edge. Widgets cannot tick every second:
 * a running block shows the time it ends at; the live notification has seconds.
 */
export function TimerWidget({ c, state, width, height }: { c: WC; state: TimerState; width: number; height: number }) {
  // Portrait reports the landscape height, so a 4×1 can claim ~110 dp; only real 2-row widgets pass this.
  const tall = height >= 160;
  const { label, title, detail, buttons } = contentOf(state);
  const padH = 16;
  const inner = Math.max(120, width - padH * 2);

  const root = {
    height: 'match_parent' as const,
    width: 'match_parent' as const,
    backgroundColor: c.bg,
    borderRadius: 24,
    paddingHorizontal: padH,
  };

  if (!tall) {
    const size = 40;
    const buttonsW = buttons.length * (size + 8);
    const textW = Math.max(60, inner - buttonsW - 4);
    return (
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'ritmo://foco' }} style={{ ...root, flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ width: textW, flexDirection: 'column', justifyContent: 'center' }}>
          <TextWidget text={title} maxLines={1} truncate="END" style={{ fontSize: 15, fontFamily: F.semibold, color: c.text }} />
          <TextWidget text={`${label} · ${detail}`} maxLines={1} truncate="END" style={{ fontSize: 12, fontFamily: F.regular, color: c.secondary }} />
        </FlexWidget>
        {buttons.map((b) => (
          <IconButton key={b.action} c={c} b={b} size={size} />
        ))}
      </FlexWidget>
    );
  }

  const pillW = Math.floor((inner - 8 * buttons.length) / Math.max(2, buttons.length));
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'ritmo://foco' }}
      style={{ ...root, paddingVertical: 14, flexDirection: 'column', justifyContent: 'space-between' }}
    >
      <FlexWidget style={{ width: inner, flexDirection: 'column' }}>
        <TextWidget text={label} style={{ fontSize: 12, fontFamily: F.medium, color: c.secondary }} />
        <TextWidget text={title} maxLines={1} truncate="END" style={{ fontSize: 20, fontFamily: F.semibold, color: c.text }} />
        <TextWidget text={detail} maxLines={1} style={{ fontSize: 13, fontFamily: F.regular, color: c.secondary }} />
      </FlexWidget>
      <FlexWidget style={{ width: inner, flexDirection: 'row', justifyContent: 'flex-end' }}>
        {buttons.map((b) => (
          <PillButton key={b.action} c={c} b={b} width={Math.min(150, pillW)} />
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
