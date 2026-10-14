#!/usr/bin/env python3
"""
Share image for mritmo.com (og:image, 1200x630): the app's pixel character in
its four states on the site's cream, with the tagline. Also used by
mritmo.com/u/<usuario>. Uses the same sprites as the app (site/sprites.js,
generated from src/avatar/sprites.ts) and Inter from node_modules.

    python3 tools/og-image.py   ->  site/og.png
"""
import json
import os
import re

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
BG = (0xF7, 0xF3, 0xEA)
SURFACE = (0xEC, 0xE6, 0xDA)
INK = (0x18, 0x16, 0x0F)
TEXT2 = (0x5E, 0x59, 0x4D)


def font(weight, size):
    base = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'inter')
    name = {'bold': '700Bold/Inter_700Bold.ttf', 'semibold': '600SemiBold/Inter_600SemiBold.ttf', 'medium': '500Medium/Inter_500Medium.ttf'}[weight]
    return ImageFont.truetype(os.path.join(base, name), size)


def sprites():
    raw = open(os.path.join(ROOT, 'site', 'sprites.js'), encoding='utf8').read()
    data = json.loads(re.search(r'=\s*(\{.*\});', raw, re.S).group(1))
    colors = dict(data['colors']['light'])
    # Same warm bench and "z" as the site's cream page.
    colors['B'] = '#E2DBCC'
    colors['Z'] = '#9F9888'
    return data['sprites'], colors


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def draw_sprite(img, rows, colors, x0, y0, px):
    d = ImageDraw.Draw(img)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '.' or ch not in colors:
                continue
            d.rectangle([x0 + x * px, y0 + y * px, x0 + (x + 1) * px - 1, y0 + (y + 1) * px - 1], fill=hexrgb(colors[ch]))


def tracked(d, xy, text, f, fill, tracking):
    """Text with tight tracking (Inter display style), letter by letter."""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += f.getlength(ch) + tracking
    return x


def main():
    sp, colors = sprites()
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)

    # Brand: app icon + name.
    icon = Image.open(os.path.join(ROOT, 'site', 'icon.png')).convert('RGBA').resize((56, 56), Image.LANCZOS)
    mask = Image.new('L', (56, 56), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 55, 55], radius=14, fill=255)
    img.paste(icon, (72, 64), mask)
    tracked(d, (142, 70), 'MRitmo', font('bold', 38), INK, -1.2)

    # Tagline, two lines, tight like the site's h1.
    big = font('bold', 64)
    tracked(d, (72, 160), 'Mide tu día en tiempo,', big, INK, -2.6)
    tracked(d, (72, 236), 'no en tareas.', big, INK, -2.6)
    d.text((74, 332), 'Foco, hábitos con racha y ranking con amigos. Para Android.', font=font('medium', 26), fill=TEXT2)

    # The four states, on a soft card along the bottom.
    d.rounded_rectangle([56, 396, W - 56, H - 24], radius=34, fill=SURFACE)
    states = [('m', 'sueno', '0 %'), ('f', 'calma', '30 %'), ('m', 'foco', '70 %'), ('f', 'fuerza', '100 %')]
    px = 6
    sw, sh = 24 * px, 26 * px
    gap = (W - 112 - 4 * sw) / 5
    label = font('semibold', 22)
    for i, (g, mood, pct) in enumerate(states):
        x = int(56 + gap * (i + 1) + sw * i)
        draw_sprite(img, sp[g][mood], colors, x, 410, px)
        tw = label.getlength(pct)
        d.text((x + (sw - tw) / 2, 410 + sh + 6), pct, font=label, fill=TEXT2)

    out = os.path.join(ROOT, 'site', 'og.png')
    img.save(out, optimize=True)
    print(out, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    main()
