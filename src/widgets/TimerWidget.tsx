import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { formatMinutes } from '../format';
import { F, WC } from './colors';

export type TimerState =
  | { kind: 'running'; title: string; endsAt: number; remainingMs: number }
  | { kind: 'paused'; title: string; remainingMs: number }
  | { kind: 'finished'; title: string }
  | { kind: 'next'; title: string; minutes: number }
  | { kind: 'empty' };

function clock(ms: number) {
  const d = new Date(ms);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const suffix = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

function Button({ c, label, action, primary }: { c: WC; label: string; action: string; primary?: boolean }) {
  return (
    <FlexWidget
      clickAction={action.startsWith('ritmo://') ? 'OPEN_URI' : action}
      clickActionData={action.startsWith('ritmo://') ? { uri: action } : undefined}
      accessibilityLabel={label}
      style={{
        height: 40,
        paddingHorizontal: 18,
        borderRadius: 20,
        backgroundColor: primary ? c.ink : c.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
      }}
    >
      <TextWidget text={label} style={{ fontSize: 14, fontFamily: F.semibold, color: primary ? c.inkOnInk : c.text }} />
    </FlexWidget>
  );
}

/**
 * Focus widget, 4×1 or 4×2. Widgets cannot tick every second, so a running
 * block shows the clock time it ends at; the live notification shows seconds.
 */
export function TimerWidget({ c, state, height }: { c: WC; state: TimerState; height: number }) {
  const tall = height >= 100;

  let label = '';
  let title = '';
  let detail = '';
  let buttons: { label: string; action: string; primary?: boolean }[] = [];

  switch (state.kind) {
    case 'running':
      label = 'En foco';
      title = state.title;
      detail = `Termina a las ${clock(state.endsAt)}`;
      buttons = [
        { label: 'Pausar', action: 'PAUSE' },
        { label: 'Terminé', action: 'DONE', primary: true },
      ];
      break;
    case 'paused':
      label = 'En pausa';
      title = state.title;
      detail = `Quedan ${formatMinutes(Math.ceil(state.remainingMs / 60000))}`;
      buttons = [
        { label: 'Seguir', action: 'START', primary: true },
        { label: 'Terminé', action: 'DONE' },
      ];
      break;
    case 'finished':
      label = 'Tiempo cumplido';
      title = state.title;
      detail = '¿La terminaste?';
      buttons = [{ label: 'Terminé', action: 'DONE', primary: true }];
      break;
    case 'next':
      label = 'Siguiente';
      title = state.title;
      detail = formatMinutes(state.minutes);
      buttons = [{ label: 'Iniciar', action: 'START', primary: true }];
      break;
    case 'empty':
      label = 'Foco';
      title = 'Sin tareas pendientes';
      detail = 'Agrega tu próxima tarea';
      buttons = [{ label: 'Agregar', action: 'ritmo://nueva', primary: true }];
      break;
  }

  // On 4×1 there is room for one button: keep the primary one.
  const shown = tall ? buttons : buttons.filter((b) => b.primary).slice(0, 1);

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'ritmo://foco' }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: c.bg,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: tall ? 14 : 8,
        flexDirection: tall ? 'column' : 'row',
        justifyContent: tall ? 'space-between' : 'flex-start',
        alignItems: tall ? 'flex-start' : 'center',
      }}
    >
      <FlexWidget style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', width: tall ? 'match_parent' : undefined }}>
        <TextWidget text={label} style={{ fontSize: 12, fontFamily: F.medium, color: c.secondary }} />
        <TextWidget
          text={title}
          maxLines={1}
          truncate="END"
          style={{ fontSize: tall ? 20 : 16, fontFamily: F.semibold, color: c.text, letterSpacing: -0.02 }}
        />
        <TextWidget text={detail} maxLines={1} style={{ fontSize: 13, fontFamily: F.regular, color: c.secondary }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: tall ? 'match_parent' : undefined, justifyContent: 'flex-end' }}>
        {shown.map((b) => (
          <Button key={b.action} c={c} label={b.label} action={b.action} primary={b.primary} />
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
