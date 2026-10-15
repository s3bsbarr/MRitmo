import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { moodFor } from '../avatar/mood';
import type { Gender } from '../data';
import { formatShort } from '../format';
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
 * Status widget in three shapes by real width:
 *  - narrow (1×1): the character alone
 *  - square (2×2): character on top, percentage and bar underneath
 *  - wide (3+ cells): character beside the percentage, bar and minutes
 * Android reports the landscape (larger) height in portrait, so layouts are
 * chosen by width and sized conservatively in height.
 */
export function StatusWidget({ c, gender, done, total, ratio, hasTasks, width, height }: StatusProps) {
  const mood = moodFor(ratio, hasTasks);
  const pct = Math.round(ratio * 100);
  const sprite = spriteSvg(gender, mood, c.scheme, c.sprite);
  const label = hasTasks ? `MRitmo, ${pct} por ciento del día` : 'MRitmo, sin tareas hoy';
  const base = {
    height: 'match_parent' as const,
    width: 'match_parent' as const,
    backgroundColor: c.bg,
    borderRadius: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  const Bar = ({ w }: { w: number }) => (
    <FlexWidget style={{ width: w, height: 5, borderRadius: 3, backgroundColor: c.track, flexDirection: 'row' }}>
      {ratio > 0 ? <FlexWidget style={{ width: Math.max(5, Math.round(w * Math.min(1, ratio))), height: 5, borderRadius: 3, backgroundColor: c.ink }} /> : null}
    </FlexWidget>
  );

  const Pct = ({ size }: { size: number }) => (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <TextWidget text={hasTasks ? String(pct) : '—'} style={{ fontSize: size, fontFamily: F.semibold, color: c.text }} />
      {hasTasks ? <TextWidget text=" %" style={{ fontSize: Math.round(size * 0.42), fontFamily: F.medium, color: c.secondary, marginBottom: Math.round(size * 0.12) }} /> : null}
    </FlexWidget>
  );

  // Wide: three or more cells across.
  if (width >= 250) {
    // One row reports ~110 dp in portrait but is ~80 dp on screen.
    const oneRow = height < 160;
    const spriteH = oneRow ? 64 : 96;
    const spriteW = Math.round((spriteH * 24) / 26);
    const infoW = width - spriteW - 16 * 2 - 16;
    return (
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'ritmo://hoy' }} accessibilityLabel={label} style={{ ...base, flexDirection: 'row', paddingHorizontal: 16 }}>
        <SvgWidget svg={sprite} style={{ height: spriteH, width: spriteW }} />
        <FlexWidget style={{ width: infoW, marginLeft: 16, flexDirection: 'column', justifyContent: 'center' }}>
          <Pct size={oneRow ? 30 : 40} />
          <TextWidget
            text={hasTasks ? `${formatShort(done)} de ${formatShort(total)}` : 'Toca para planear tu día'}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 13, fontFamily: F.regular, color: c.secondary }}
          />
          <FlexWidget style={{ marginTop: oneRow ? 6 : 10 }}>
            <Bar w={infoW} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    );
  }

  // Square: two cells across and tall enough for a second row.
  if (width >= 130 && height >= 130) {
    const spriteH = 76;
    const spriteW = Math.round((spriteH * 24) / 26);
    const barW = Math.min(110, width - 40);
    return (
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'ritmo://hoy' }} accessibilityLabel={label} style={{ ...base, flexDirection: 'column' }}>
        <SvgWidget svg={sprite} style={{ height: spriteH, width: spriteW }} />
        <FlexWidget style={{ marginTop: 6 }}>
          <Pct size={26} />
        </FlexWidget>
        <FlexWidget style={{ marginTop: 6 }}>
          <Bar w={barW} />
        </FlexWidget>
      </FlexWidget>
    );
  }

  // Narrow: the character alone.
  const spriteH = Math.max(44, Math.min(height, width) - 16);
  return (
    <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'ritmo://hoy' }} accessibilityLabel={label} style={base}>
      <SvgWidget svg={sprite} style={{ height: spriteH, width: Math.round((spriteH * 24) / 26) }} />
    </FlexWidget>
  );
}
