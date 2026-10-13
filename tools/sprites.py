"""Pixel-art avatar generator for Ritmo.

Frames are symmetric: each is authored as a 12-column left half and mirrored to
24 columns. Faces are applied as mood overrides on fixed head rows.
Outputs a preview PNG and src/avatar/sprites.ts.
"""
import json, sys
from PIL import Image

W = 24

def mirror(rows):
    return [r + r[::-1] for r in rows]

HEAD = {
    'm': [
        "......" + "...OOO",
        "......" + "..OHHH",
        "......" + ".OHHHH",
        "......" + ".OHHHH",
        "......" + ".OHSSS",
        "......" + ".OSSSS",
        "......" + ".OSSSS",
        "......" + ".OSSSS",
        "......" + ".OSSSS",
        "......" + ".OSSSS",
        "......" + "..OSSS",
        "......" + "...OOO",
        "......" + "....OS",
    ],
    'f': [
        "......" + "...OOO",
        "......" + "..OHHH",
        "......" + ".OHHHH",
        "......" + "OHHHHH",
        "......" + "OHHSSS",
        "......" + "OHSSSS",
        "......" + "OHSSSS",
        "......" + "OHSSSS",
        "......" + "OHSSSS",
        "......" + "OHSSSS",
        "......" + "OHHSSS",
        "......" + "OHHHOO",
        "......" + "OHHOOS",
    ],
}

# Mood overrides: row index -> (start_col, chars), absolute columns on the 24-wide canvas.
# Head occupies x6..17; inner face x8..15; chin x10..13.
MOODS = {
    'sueno': {   # 0%: asleep sitting, closed eyes, small open mouth, floating Zs
        6: (8, "SSSSSSSS"),
        7: (8, "SEESSEES"),
        8: (8, "SSSSSSSS"),
        9: (8, "SSSMMSSS"),
        10: (10, "SSSS"),
    },
    'calma': {   # 1-49%: awake and relaxed, open eyes, soft smile
        6: (8, "SESSSSES"),
        7: (8, "SESSSSES"),
        8: (8, "SSMSSMSS"),
        9: (8, "SSSMMSSS"),
        10: (10, "SSSS"),
    },
    'foco': {    # standing, determined: open eyes, straight mouth
        6: (8, "SESSSSES"),
        7: (8, "SESSSSES"),
        8: (8, "SSSSSSSS"),
        9: (8, "SSSMMSSS"),
        10: (10, "SSSS"),
    },
    'fuerza': {  # flexing: raised brows, open eyes, big grin, blush
        5: (8, "SEESSEES"),
        6: (8, "SESSSSES"),
        7: (8, "SESSSSES"),
        8: (8, "RSTTTTSR"),
        9: (8, "SSMMMMSS"),
        10: (10, "SSSS"),
    },
}

TORSO = [
    "....." + "OOOOOOD",
    "...." + "OCCCCCCD",
    "...." + "OCCOCCCD",
    "...." + "OCCOCCCC",
    "...." + "OSSOCCCC",
    "...." + "OSSODDDD",
]

STAND_LEGS = [
    "...." + "OOOOCCCC",
    "......." + "OCCCO",
    "......." + "OCCCO",
    "......." + "OCCCO",
    "......." + "OKKKO",
    "......" + "OOKKKO",
    "......" + "OOOOOO",
]

SIT_LEGS = [
    ".." + "OOOSSODDDD",
    "." + "OCCCOOCCCCC",
    "." + "OCCCCCCCCKK",
    ".." + "OOOOOOOOOO",
    "." + "BBBBBBBBBBB",
    ".." + "BBBBBBBBBB",
]

# Flexing: forearms raised beside the head, elbows out at shoulder height.
FLEX_TORSO = [
    "." + "OSSOOOOOOOD",
    "." + "OSSSSCCCCCD",
    "." + "OSSSSOOCCCD",
    ".." + "OOOO.OCCCC",
    "......." + "OCCCC",
    "......." + "ODDDD",
]
FLEX_LEGS = [
    "......." + "OCCCC",
    "......." + "OCCCO",
    "......." + "OCCCO",
    "......." + "OCCCO",
    "......." + "OKKKO",
    "......" + "OOKKKO",
    "......" + "OOOOOO",
]
FLEX_ARMS = {  # head row -> chars at x0..5
    3: ".OOOO.",
    4: "OSSSSO",
    5: "OSSSSO",
    6: ".OSSO.",
    7: ".OSSO.",
    8: ".OSSO.",
    9: ".OSSO.",
    10: ".OSSO.",
    11: ".OSSO.",
    12: ".OSSO.",
}

POSES = {'sueno': 'sit', 'calma': 'sit', 'foco': 'stand', 'fuerza': 'flex'}


def pad(rows):
    return [r.ljust(12, '.') for r in rows]


def frame(gender, mood, face=None):
    head = pad(HEAD[gender])
    pose = POSES[mood]
    if pose == 'sit':
        body = pad(TORSO[:5]) + pad(SIT_LEGS)
    elif pose == 'stand':
        body = pad(TORSO) + pad(STAND_LEGS)
    else:
        body = pad(FLEX_TORSO) + pad(FLEX_LEGS)
    left = [list(r) for r in head + body]
    if pose == 'flex':
        for y, chars in FLEX_ARMS.items():
            for i, ch in enumerate(chars):
                if ch != '.':
                    left[y][i] = ch
    rows = mirror([''.join(r) for r in left])
    rows = [list(r) for r in rows]
    for y, (x0, chars) in MOODS[face or mood].items():
        for i, ch in enumerate(chars):
            rows[y][x0 + i] = ch
    rows = [''.join(r) for r in rows]
    # Bottom-align every frame on the same canvas height.
    H = 26
    rows = ['.' * W] * (H - len(rows)) + rows
    if mood == 'sueno' and face is None:
        rows = [list(r) for r in rows]
        for y, x0, glyph in ZZZ:
            for i, ch in enumerate(glyph):
                if ch != '.':
                    rows[y][x0 + i] = ch
        rows = [''.join(r) for r in rows]
    return rows


# Two floating Zs, drawn in the detail ink so they follow the theme.
ZZZ = [
    (0, 20, "ZZZZ"), (1, 22, "Z"), (2, 21, "Z"), (3, 20, "ZZZZ"),
    (4, 18, "ZZZ"), (5, 19, "Z"), (6, 18, "ZZZ"),
]


THEMES = {
    'light': {'O': '#0A0A0B', 'C': '#FFFFFF', 'D': '#0A0A0B', 'K': '#0A0A0B', 'B': '#E4E4E8',
              'S': '#F2CDA8', 'H': '#3A2A20', 'E': '#0A0A0B', 'M': '#5E2C24', 'T': '#FFFFFF', 'R': '#F3B7A8', 'Z': '#A1A1A8'},
    'dark': {'O': '#C9C9CF', 'C': '#141416', 'D': '#E8E8EC', 'K': '#E8E8EC', 'B': '#26262A',
             'S': '#F2CDA8', 'H': '#3A2A20', 'E': '#0A0A0B', 'M': '#5E2C24', 'T': '#FFFFFF', 'R': '#F3B7A8', 'Z': '#8E8E95'},
}


def render(rows, theme, scale, bg):
    h = len(rows)
    im = Image.new('RGB', (W * scale, h * scale), bg)
    px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '.':
                continue
            col = THEMES[theme][ch]
            rgb = tuple(int(col[i:i + 2], 16) for i in (1, 3, 5))
            for dy in range(scale):
                for dx in range(scale):
                    px[x * scale + dx, y * scale + dy] = rgb
    return im


if __name__ == '__main__':
    out_png, out_ts = sys.argv[1], sys.argv[2]
    frames = {g: {m: frame(g, m) for m in MOODS} for g in ('m', 'f')}
    for g in frames:
        for m in frames[g]:
            assert all(len(r) == W for r in frames[g][m]), (g, m)
    scale = 8
    tiles = []
    for theme, bg in (('light', (255, 255, 255)), ('dark', (0, 0, 0))):
        for g in ('m', 'f'):
            for m in MOODS:
                tiles.append(render(frames[g][m], theme, scale, bg))
    tw, th = tiles[0].size
    sheet = Image.new('RGB', (tw * 8 + 70, th * 2 + 10), (128, 128, 128))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % 8) * (tw + 10), (i // 8) * (th + 10)))
    sheet.save(out_png)
    with open(out_ts, 'w') as f:
        f.write('// Generated by sprites/gen.py. Each frame is 24x26; "." is transparent.\n')
        f.write('export type Gender = "m" | "f";\nexport type Mood = "sueno" | "calma" | "foco" | "fuerza";\n')
        f.write(f'export const SPRITES: Record<Gender, Record<Mood, string[]>> = {json.dumps(frames, indent=2)};\n')
        smiles = {g: {m: frame(g, m, face='fuerza') for m in MOODS} for g in ('m', 'f')}
        f.write('/** Same poses with a big grin, shown for a moment when the character is tapped. */\n')
        f.write(f'export const SMILES: Record<Gender, Record<Mood, string[]>> = {json.dumps(smiles, indent=2)};\n')
        f.write(f'export const SPRITE_COLORS = {json.dumps(THEMES, indent=2)} as const;\n')
    print('ok')
