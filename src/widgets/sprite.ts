import { SPRITE_COLORS, SPRITES } from '../avatar/sprites';
import type { Gender, Mood } from '../avatar/sprites';

/** The pixel avatar as a crisp SVG string for widgets (merged horizontal runs). */
export function spriteSvg(gender: Gender, mood: Mood, scheme: 'light' | 'dark') {
  const rows = SPRITES[gender][mood];
  const palette = SPRITE_COLORS[scheme] as Record<string, string>;
  const rects: string[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${palette[ch]}"/>`);
      x = end;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 26" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}
