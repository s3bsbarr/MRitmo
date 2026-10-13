import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { moodFor } from '../avatar/mood';
import type { Gender } from '../data';
import { formatMinutes } from '../format';
import { F, WC } from './colors';
import { spriteSvg } from './sprite';

export type StatusProps = {
  c: WC;
  gender: Gender;
  done: number;
  total: number;
  ratio: number;
  hasTasks: boolean;
  width: number;
  height: number;
};

/**
 * Status widget. Small sizes show only the character; from about 3 cells wide
 * it adds the day's percentage and a progress bar next to it.
 */
export function StatusWidget({ c, gender, done, total, ratio, hasTasks, width, height }: StatusProps) {
  const mood = moodFor(ratio, hasTasks);
  const wide = width >= 180;
  const pct = Math.round(ratio * 100);
  const spriteH = Math.max(48, Math.min(height - 24, wide ? 120 : 140));
  const spriteW = Math.round((spriteH * 24) / 26);
  const barW = Math.max(60, width - spriteW - 64);

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'ritmo://hoy' }}
      accessibilityLabel={hasTasks ? `Ritmo, ${pct} por ciento del día` : 'Ritmo, sin tareas hoy'}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: c.bg,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: wide ? 'flex-start' : 'center',
        paddingHorizontal: wide ? 16 : 8,
      }}
    >
      <SvgWidget svg={spriteSvg(gender, mood, c.scheme)} style={{ height: spriteH, width: spriteW }} />
      {wide && (
        <FlexWidget style={{ marginLeft: 16, flexDirection: 'column', justifyContent: 'center' }}>
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <TextWidget
              text={hasTasks ? String(pct) : '—'}
              style={{ fontSize: height >= 140 ? 44 : 34, fontFamily: F.semibold, color: c.text, letterSpacing: -0.04 }}
            />
            <TextWidget text={hasTasks ? ' %' : ''} style={{ fontSize: 16, fontFamily: F.medium, color: c.secondary, marginBottom: 6 }} />
          </FlexWidget>
          <TextWidget
            text={hasTasks ? `${formatMinutes(done)} de ${formatMinutes(total)}` : 'Toca para planear tu día'}
            style={{ fontSize: 13, fontFamily: F.regular, color: c.secondary }}
          />
          <FlexWidget style={{ width: barW, height: 5, borderRadius: 3, backgroundColor: c.track, marginTop: 10, flexDirection: 'row' }}>
            {ratio > 0 && (
              <FlexWidget style={{ width: Math.max(5, Math.round(barW * Math.min(1, ratio))), height: 5, borderRadius: 3, backgroundColor: c.ink }} />
            )}
          </FlexWidget>
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
