#!/usr/bin/env python3
"""Generates every SVG in assets/ (characters, costumes, scenes, icons).

Run from anywhere:  python3 halloween/tools/make_art.py

Each asset is a standalone SVG file, so any single file can also be hand
edited or replaced later without touching the game code. Re-running this
script overwrites the generated files, so if you hand-edit one, move the
change into this script too (or stop regenerating that file).

Style rules: bold dark outlines, flat bright colours, big friendly eyes.
Sniper and every costume share one coordinate system (viewBox
"0 -100 400 580") so costume layers stack exactly on top of him.
"""
import math
import os
import random

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')

OUT = '#2b1b17'   # outline colour used everywhere
SW = 6            # outline width


def write(folder, name, viewbox, body, extra_style=''):
    path = os.path.join(ROOT, folder, name + '.svg')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">'
           f'{extra_style}'
           f'<g stroke="{OUT}" stroke-width="{SW}" stroke-linejoin="round" stroke-linecap="round">'
           f'{body}</g></svg>\n')
    with open(path, 'w') as f:
        f.write(svg)


def mirror(body, width):
    """Mirror a fragment horizontally across x = width / 2."""
    return f'<g transform="translate({width},0) scale(-1,1)">{body}</g>'


def limb(d, colour, w=24):
    """A cartoon arm/leg: a thick outline stroke under a coloured stroke."""
    return (f'<path d="{d}" fill="none" stroke="{OUT}" stroke-width="{w + 2 * SW}"/>'
            f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="{w}"/>')


def fluffy(cx, cy, rx, ry, n, amp, amp_fn=None, start=0.0):
    """A scalloped, furry outline around an ellipse."""
    pts = []
    for i in range(n * 2 + 1):
        a = start + math.pi * 2 * i / (n * 2)
        k = amp_fn(a) if amp_fn else 1.0
        r = 1 + (amp * k if i % 2 else -amp * k * 0.3)
        pts.append((cx + math.cos(a) * rx * r, cy + math.sin(a) * ry * r))
    d = f'M{pts[0][0]:.1f},{pts[0][1]:.1f}'
    for i in range(1, len(pts) - 1, 2):
        c, e = pts[i], pts[i + 1]
        d += f' Q{c[0]:.1f},{c[1]:.1f} {e[0]:.1f},{e[1]:.1f}'
    return d + ' Z'


# ---------------------------------------------------------------- Goldie
# Strawberry-blonde toddler: wispy shoulder-length hair, full bangs, a
# little top-knot sprout with a red tie, big blue eyes, rosy cheeks and a
# few freckles. Navy dress with pink flowers, cream sneakers.
SKIN = '#FFE1CC'
SKIN_SH = '#E9B79C'
HAIR = '#F4C762'
HAIR_HI = '#FCE29A'
HAIR_SH = '#DFA647'
DRESS = '#2F3B6E'
FLOWER = '#F27BA6'
LEAF = '#7AD6BC'
SHOE = '#F6EFE3'
TIE = '#E8443A'
EYE = '#5B9BD5'


def goldie(pose):
    p = []
    # hair behind the head (shoulder length, wispy ends)
    p.append(f'<path fill="{HAIR_SH}" d="M150,44 C60,44 52,128 60,196 C62,226 74,246 92,240 '
             f'C100,252 116,250 124,238 L176,238 C184,250 200,252 208,240 C226,246 238,226 240,196 '
             f'C248,128 240,44 150,44 Z"/>')
    # legs + shoes
    p.append(limb('M132,330 L130,380', SKIN, 22))
    p.append(limb('M168,330 L170,380', SKIN, 22))
    p.append(f'<path fill="{SHOE}" d="M104,392 C104,376 120,374 132,376 C142,378 146,386 146,394 '
             f'C146,402 106,404 104,392 Z"/>')
    p.append(mirror(f'<path fill="{SHOE}" d="M104,392 C104,376 120,374 132,376 C142,378 146,386 146,394 '
                    f'C146,402 106,404 104,392 Z"/>', 300))
    # arms
    if pose == 'wave':
        p.append(limb('M108,234 Q90,266 96,300', SKIN))
        p.append(f'<circle cx="97" cy="306" r="13" fill="{SKIN}"/>')
        wave = (limb('M192,234 Q232,214 238,166', SKIN) +
                ''.join(f'<ellipse cx="{240 + math.cos(a) * 20:.1f}" cy="{150 + math.sin(a) * 20:.1f}" '
                        f'rx="6" ry="10" transform="rotate({math.degrees(a) + 90:.0f} '
                        f'{240 + math.cos(a) * 20:.1f} {150 + math.sin(a) * 20:.1f})" fill="{SKIN}"/>'
                        for a in [math.radians(d) for d in (-150, -115, -85, -55, -20)]) +
                f'<circle cx="240" cy="152" r="17" fill="{SKIN}"/>')
        p.append(f'<g class="goldie-wave" style="transform-origin:192px 234px">{wave}</g>')
    else:  # cheer: both arms up
        for side in ('', 'm'):
            arm = (limb('M108,234 Q74,206 66,156', SKIN) +
                   ''.join(f'<ellipse cx="{62 + math.cos(a) * 19:.1f}" cy="{138 + math.sin(a) * 19:.1f}" '
                           f'rx="6" ry="10" transform="rotate({math.degrees(a) + 90:.0f} '
                           f'{62 + math.cos(a) * 19:.1f} {138 + math.sin(a) * 19:.1f})" fill="{SKIN}"/>'
                           for a in [math.radians(d) for d in (-160, -125, -95, -65, -30)]) +
                   f'<circle cx="62" cy="140" r="16" fill="{SKIN}"/>')
            p.append(mirror(arm, 300) if side else arm)
    # dress
    p.append(f'<path fill="{DRESS}" d="M114,212 Q150,202 186,212 L218,330 Q150,354 82,330 Z"/>')
    rnd = random.Random(3)
    for (x, y) in [(118, 240), (170, 236), (146, 270), (104, 304), (192, 296), (130, 322), (168, 318),
                   (204, 262), (98, 270)]:
        rot = rnd.randint(0, 72)
        petals = ''.join(f'<circle cx="{x + math.cos(math.radians(rot + k * 72)) * 6:.1f}" '
                         f'cy="{y + math.sin(math.radians(rot + k * 72)) * 6:.1f}" r="5" fill="{FLOWER}"/>'
                         for k in range(5))
        p.append(f'<g stroke="none">{petals}<circle cx="{x}" cy="{y}" r="3.2" fill="#FFE07A"/>'
                 f'<ellipse cx="{x + 11}" cy="{y + 7}" rx="5" ry="2.6" fill="{LEAF}" '
                 f'transform="rotate(30 {x + 11} {y + 7})"/></g>')
    # puffy sleeves
    p.append(f'<path fill="{DRESS}" d="M98,236 C94,214 116,206 128,216 C124,226 116,236 98,236 Z"/>')
    p.append(mirror(f'<path fill="{DRESS}" d="M98,236 C94,214 116,206 128,216 C124,226 116,236 98,236 Z"/>', 300))
    # neck + head
    p.append(f'<rect x="136" y="196" width="28" height="20" fill="{SKIN}" stroke="none"/>')
    p.append(f'<ellipse cx="150" cy="128" rx="78" ry="74" fill="{SKIN}"/>')
    # side hair strands falling in front
    strand = f'<path fill="{HAIR}" d="M78,110 C60,150 62,198 86,226 C94,198 90,160 98,126 Z"/>'
    p.append(strand + mirror(strand, 300))
    # bangs
    p.append(f'<path fill="{HAIR}" d="M72,126 C64,66 106,42 150,42 C194,42 236,66 228,126 '
             f'C218,114 210,102 206,90 C200,104 188,112 174,114 C172,102 168,94 162,88 '
             f'C154,104 140,110 126,110 C124,100 120,92 116,88 C108,104 92,118 72,126 Z"/>')
    p.append(f'<path d="M100,68 Q150,46 200,68" fill="none" stroke="{HAIR_HI}" stroke-width="7"/>')
    # top-knot sprout + red hair tie (from the park photo)
    p.append(f'<path fill="{HAIR}" d="M146,50 C136,24 118,12 102,18 C120,24 130,36 138,52 Z"/>')
    p.append(f'<path fill="{HAIR}" d="M150,48 C150,20 162,6 178,4 C166,16 160,30 158,50 Z"/>')
    p.append(f'<path fill="{HAIR}" d="M154,50 C168,32 190,28 200,34 C186,36 172,44 162,54 Z"/>')
    p.append(f'<ellipse cx="151" cy="50" rx="11" ry="7" fill="{TIE}"/>')
    # face
    for x in (120, 180):
        p.append(f'<path d="M{x - 13},116 Q{x},108 {x + 13},116" fill="none" stroke="{HAIR_SH}" stroke-width="4"/>')
        p.append(f'<ellipse cx="{x}" cy="144" rx="16" ry="19" fill="#fff" stroke-width="4"/>')
        p.append(f'<circle cx="{x}" cy="146" r="12.5" fill="{EYE}" stroke="none"/>')
        p.append(f'<circle cx="{x}" cy="147" r="7" fill="#1f2b3d" stroke="none"/>')
        p.append(f'<circle cx="{x - 4}" cy="141" r="4.2" fill="#fff" stroke="none"/>')
        p.append(f'<circle cx="{x + 4}" cy="151" r="2" fill="#fff" stroke="none"/>')
    p.append('<g stroke="none" fill="#F59D9D" opacity="0.65"><ellipse cx="100" cy="170" rx="15" ry="10"/>'
             '<ellipse cx="200" cy="170" rx="15" ry="10"/></g>')
    p.append('<g stroke="none" fill="#DDA07C">' +
             ''.join(f'<circle cx="{x}" cy="{y}" r="1.8"/>' for x, y in
                     [(128, 160), (134, 166), (122, 166), (172, 160), (166, 166), (178, 166)]) + '</g>')
    p.append(f'<path d="M145,160 Q150,166 155,160" fill="none" stroke="{SKIN_SH}" stroke-width="4"/>')
    if pose == 'wave':
        p.append('<path d="M124,176 Q150,208 176,176 Q150,184 124,176 Z" fill="#9E2F3A" stroke-width="4"/>')
        p.append('<path d="M130,179 Q150,185 170,179 L168,183 Q150,189 132,183 Z" fill="#fff" stroke="none"/>')
        p.append('<ellipse cx="150" cy="189" rx="9" ry="4" fill="#F27C8E" stroke="none"/>')
    else:
        p.append('<path d="M118,172 Q150,226 182,172 Q150,182 118,172 Z" fill="#9E2F3A" stroke-width="4"/>')
        p.append('<path d="M125,176 Q150,184 175,176 L172,182 Q150,190 128,182 Z" fill="#fff" stroke="none"/>')
        p.append('<ellipse cx="150" cy="194" rx="12" ry="6" fill="#F27C8E" stroke="none"/>')
    return ''.join(p)


write('characters', 'goldie-wave', '0 0 300 410', goldie('wave'))
write('characters', 'goldie-cheer', '0 0 300 410', goldie('cheer'))

# ---------------------------------------------------------------- Sniper
# Liver-and-white pointer: solid liver head and long floppy ears, white
# blaze running up the forehead, white muzzle with liver ticking, white
# body covered in fine liver ticking, long thin tail, orange collar with
# a brass name plate.
WHITE = '#FFFBF4'
LIVER = '#6E3B2C'
LIVER_D = '#5A2E22'
TICK = '#8A5443'
NOSE = '#4A2620'
COLLAR = '#FF6A1A'
TAG = '#D8B45A'
DOG_VB = '0 -100 400 580'

BODY_D = ('M152,190 C138,250 116,300 116,362 C116,414 136,446 168,450 L232,450 '
          'C264,446 284,414 284,362 C284,300 262,250 248,190 Z')


def ticks(rnd, n, box, inside, r=(2.2, 4.2)):
    out = []
    tries = 0
    while len(out) < n and tries < 5000:
        tries += 1
        x, y = rnd.uniform(box[0], box[2]), rnd.uniform(box[1], box[3])
        if inside(x, y):
            out.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rnd.uniform(*r):.1f}" '
                       f'ry="{rnd.uniform(*r) * 0.8:.1f}"/>')
    return f'<g fill="{TICK}" stroke="none">{"".join(out)}</g>'


def in_body(x, y):
    # rough body + haunch test; the chest stays lighter
    if 230 < y < 330 and 170 < x < 230:
        return False
    body = 190 < y < 448 and abs(x - 200) < (48 + (y - 190) * 0.33)
    haunch = ((x - 128) / 44) ** 2 + ((y - 404) / 48) ** 2 < 1 or ((x - 272) / 44) ** 2 + ((y - 404) / 48) ** 2 < 1
    return body or haunch


def sniper_head(with_collar=True):
    p = []
    if with_collar:
        p.append(f'<path fill="{COLLAR}" d="M144,194 Q200,226 256,194 L258,216 Q200,250 142,216 Z"/>')
        p.append(f'<circle cx="200" cy="236" r="8" fill="none" stroke="#9a9a9a" stroke-width="4"/>')
        p.append(f'<rect x="184" y="240" width="32" height="20" rx="5" fill="{TAG}" stroke-width="4"/>')
    p.append(f'<path fill="{LIVER}" d="M138,96 C136,48 168,28 200,28 C232,28 264,48 262,96 '
             f'C262,134 250,160 238,180 C228,200 216,214 200,214 C184,214 172,200 162,180 '
             f'C150,160 138,134 138,96 Z"/>')
    # blaze + muzzle (inner marking, no outline)
    p.append(f'<path fill="{WHITE}" stroke="none" d="M195,40 C196,34 204,34 205,40 L211,118 '
             f'C232,138 236,180 220,202 C212,212 188,212 180,202 C164,180 168,138 189,118 Z"/>')
    rnd = random.Random(11)
    p.append(ticks(rnd, 22, (172, 140, 228, 205),
                   lambda x, y: abs(x - 200) < 10 + (y - 120) * 0.42 and not (186 < x < 214 and y > 172),
                   (1.6, 3.0)))
    for x in (172, 228):
        p.append(f'<ellipse cx="{x}" cy="112" rx="14" ry="15" fill="#fff" stroke-width="4"/>')
        p.append(f'<circle cx="{x}" cy="114" r="10.5" fill="#B0733A" stroke="none"/>')
        p.append(f'<circle cx="{x}" cy="115" r="6" fill="#1d120f" stroke="none"/>')
        p.append(f'<circle cx="{x - 3}" cy="110" r="3.6" fill="#fff" stroke="none"/>')
    p.append(f'<path fill="{NOSE}" d="M182,178 Q200,168 218,178 Q220,194 200,198 Q180,194 182,178 Z"/>')
    p.append('<ellipse cx="193" cy="179" rx="6" ry="3" fill="#8a5a50" stroke="none"/>')
    p.append('<path d="M193,210 Q200,232 207,210 Z" fill="#F27C8E" stroke-width="4"/>')
    p.append('<path d="M200,198 L200,206 M184,204 Q200,216 216,204" fill="none" stroke-width="4"/>')
    ear = (f'<g class="sniper-ear"><path fill="{LIVER_D}" d="M150,64 C112,66 98,104 100,156 '
           f'C102,202 116,228 136,228 C156,228 162,196 160,160 C158,120 166,88 150,64 Z"/></g>')
    p.append(ear + mirror(ear, 400))
    return ''.join(p)


def sniper():
    p = []
    rnd = random.Random(5)
    # haunches + back paws
    for x in (128, 272):
        p.append(f'<ellipse cx="{x}" cy="404" rx="46" ry="50" fill="{WHITE}"/>')
    for x in (94, 306):
        p.append(f'<ellipse cx="{x}" cy="452" rx="26" ry="12" fill="{WHITE}"/>')
    # tail (wags via CSS on .sniper-tail)
    p.append(f'<g class="sniper-tail" style="transform-origin:270px 438px">'
             f'<path fill="{WHITE}" d="M266,428 C322,428 350,396 360,346 C363,334 378,336 376,350 '
             f'C366,410 330,448 270,448 Z"/>'
             '</g>')
    p.append(f'<path fill="{WHITE}" d="{BODY_D}"/>')
    p.append(ticks(rnd, 120, (84, 190, 316, 450), in_body))
    # a couple of liver patches on the haunches
    p.append(f'<path fill="{LIVER}" stroke="none" d="M98,384 C104,366 126,364 134,376 C142,390 130,404 116,404 C104,404 96,396 98,384 Z"/>')
    p.append(f'<path fill="{LIVER}" stroke="none" d="M286,372 C298,368 310,380 306,394 C302,406 286,404 282,394 C278,384 278,376 286,372 Z"/>')
    # front legs and paws
    p.append('<path d="M156,330 C152,380 152,420 152,446 M196,336 C196,380 194,420 194,446" fill="none" stroke-width="5"/>')
    p.append('<path d="M244,330 C248,380 248,420 248,446 M204,336 C204,380 206,420 206,446" fill="none" stroke-width="5"/>')
    p.append(f'<rect x="196" y="380" width="8" height="68" fill="{WHITE}" stroke="none"/>')
    for x in (172, 228):
        p.append(f'<ellipse cx="{x}" cy="452" rx="27" ry="14" fill="{WHITE}"/>')
        p.append(f'<path d="M{x - 9},446 L{x - 9},458 M{x + 9},446 L{x + 9},458" fill="none" stroke-width="3"/>')
    p.append(sniper_head())
    return ''.join(p)


write('characters', 'sniper', DOG_VB, sniper())
write('characters', 'sniper-head', '86 14 228 256', sniper_head())

# ---------------------------------------------------------------- Costumes
# Same viewBox as Sniper. Slot is in the file name table in js/games/dressup.js.
PURPLE = '#6B3FA0'
ORANGE = '#FF8A1F'

write('costumes', 'witch-hat', DOG_VB,
      f'<ellipse cx="200" cy="46" rx="100" ry="22" fill="{PURPLE}"/>'
      f'<path fill="{PURPLE}" d="M146,46 C162,0 176,-48 196,-84 C204,-98 226,-94 236,-78 '
      f'C224,-74 214,-64 214,-48 C222,-8 240,22 256,46 Z"/>'
      f'<path fill="{ORANGE}" d="M152,26 L248,26 L256,46 L146,46 Z"/>'
      f'<rect x="187" y="24" width="26" height="22" rx="3" fill="none" stroke="#FFD23F" stroke-width="5"/>'
      f'<path d="M150,-30 l4,8 8,2 -8,3 -2,8 -3,-8 -8,-2 8,-3Z M232,-10 l3,6 6,2 -6,2 -2,6 -2,-6 -6,-2 6,-2Z" '
      f'fill="#FFD23F" stroke="none"/>')

spring = 'M168,30 ' + ' '.join(f'L{168 - i * 2 + (8 if i % 2 else -8)},{30 - i * 8}' for i in range(1, 10))
spring2 = 'M232,30 ' + ' '.join(f'L{232 + i * 2 + (8 if i % 2 else -8)},{30 - i * 8}' for i in range(1, 10))


def spider(cx, cy):
    legs = ''.join(f'<path d="M{cx},{cy} Q{cx + s * 26},{cy - 18 + k * 12} {cx + s * 34},{cy - 4 + k * 14}" '
                   f'fill="none" stroke-width="5"/>' for s in (-1, 1) for k in range(4))
    return (legs + f'<circle cx="{cx}" cy="{cy}" r="22" fill="#2a2333"/>'
            f'<circle cx="{cx - 8}" cy="{cy - 4}" r="7" fill="#fff" stroke-width="3"/>'
            f'<circle cx="{cx + 8}" cy="{cy - 4}" r="7" fill="#fff" stroke-width="3"/>'
            f'<circle cx="{cx - 7}" cy="{cy - 3}" r="3" fill="#111" stroke="none"/>'
            f'<circle cx="{cx + 9}" cy="{cy - 3}" r="3" fill="#111" stroke="none"/>'
            f'<path d="M{cx - 7},{cy + 8} Q{cx},{cy + 14} {cx + 7},{cy + 8}" fill="none" stroke="#fff" stroke-width="3"/>')


band = ('<path d="M140,96 C140,42 170,24 200,24 C230,24 260,42 260,96" fill="none" stroke-width="22"/>'
        '<path d="M140,96 C140,42 170,24 200,24 C230,24 260,42 260,96" fill="none" stroke="{c}" stroke-width="10"/>')

write('costumes', 'spider-headband', DOG_VB,
      band.format(c='#7B3FB8') +
      f'<path d="{spring}" fill="none" stroke-width="5"/><path d="{spring2}" fill="none" stroke-width="5"/>' +
      f'<g class="bob">{spider(150, -52)}</g><g class="bob bob2">{spider(250, -52)}</g>')

cat_ear = ('<path d="M144,62 L146,-8 L198,34 Z" fill="#2E2A3A"/>'
           '<path d="M156,46 L158,12 L184,34 Z" fill="#F7A1C4" stroke="none"/>')
write('costumes', 'cat-ears', DOG_VB, band.format(c='#2E2A3A') + cat_ear + mirror(cat_ear, 400))

write('costumes', 'bow-tie', DOG_VB,
      f'<path fill="{PURPLE}" d="M200,236 L152,206 Q142,236 152,266 Z"/>' +
      mirror(f'<path fill="{PURPLE}" d="M200,236 L152,206 Q142,236 152,266 Z"/>', 400) +
      '<g fill="#FF8A1F" stroke="none"><circle cx="164" cy="226" r="5"/><circle cx="164" cy="248" r="5"/>'
      '<circle cx="236" cy="226" r="5"/><circle cx="236" cy="248" r="5"/><circle cx="178" cy="238" r="4"/>'
      '<circle cx="222" cy="238" r="4"/></g>'
      f'<rect x="186" y="222" width="28" height="28" rx="8" fill="{ORANGE}"/>')

hem = 'C100,440 100,410 100,370'
waves = ''.join(f' Q{x + 16},{456 if i % 2 else 458} {x + 32},{470 - (i % 2) * 4}'
                for i, x in enumerate(range(92, 300, 32)))
write('costumes', 'ghost-sheet', DOG_VB,
      f'<path fill="#F7F6FF" d="M150,198 Q200,228 250,198 C278,236 298,300 302,370 C304,420 306,446 312,466 '
      f'L92,466 C100,440 100,410 100,370 C104,300 124,236 150,198 Z"/>'
      f'<path fill="#F7F6FF" d="M92,462 {waves[1:]} L312,462 Z" stroke="none"/>'
      f'<path fill="none" d="M92,466 {waves[1:]}"/>'
      '<path d="M268,250 C286,300 292,360 290,440" fill="none" stroke="#DCD8F0" stroke-width="10"/>'
      '<ellipse cx="174" cy="326" rx="14" ry="20" fill="#2b1b17"/>'
      '<ellipse cx="226" cy="326" rx="14" ry="20" fill="#2b1b17"/>'
      '<ellipse cx="200" cy="378" rx="15" ry="19" fill="#2b1b17"/>'
      '<g fill="#F7B6C8" stroke="none" opacity=".8"><ellipse cx="152" cy="356" rx="12" ry="7"/>'
      '<ellipse cx="248" cy="356" rx="12" ry="7"/></g>')

write('costumes', 'pumpkin-suit', DOG_VB,
      '<path d="M200,258 C196,240 200,226 212,218" fill="none" stroke="#3E8E41" stroke-width="16"/>'
      '<path d="M200,258 C196,240 200,226 212,218" fill="none" stroke="#2b1b17" stroke-width="4"/>'
      '<ellipse cx="200" cy="356" rx="116" ry="100" fill="#FF8C1A"/>'
      '<path d="M200,258 C164,290 160,420 200,454 M200,258 C236,290 240,420 200,454 '
      'M136,276 C110,320 116,410 146,440 M264,276 C290,320 284,410 254,440" fill="none" stroke="#D9650A" stroke-width="5"/>'
      '<path d="M146,330 L170,296 L194,330 Z M206,330 L230,296 L254,330 Z" fill="#5A2A00"/>'
      '<path d="M140,370 Q200,430 260,370 Q240,384 228,382 L222,394 L208,384 Q200,386 192,384 L178,394 L172,382 '
      'Q160,384 140,370 Z" fill="#5A2A00"/>'
      '<path d="M236,252 C256,236 276,244 282,252 C268,250 254,256 244,262" fill="#4CAF50"/>')

wing = ('<path fill="#4B2E6E" d="M162,256 C120,206 70,172 16,176 C32,196 34,216 26,236 '
        'C48,228 64,240 64,262 C80,250 100,254 104,274 C120,262 144,266 154,288 Z"/>'
        '<path d="M150,262 L28,190 M146,268 L66,250 M150,278 L104,268" fill="none" stroke="#7E5AAE" stroke-width="4"/>')
write('costumes', 'bat-wings', DOG_VB, f'<g class="flap-l" style="transform-origin:160px 262px">{wing}</g>' +
      mirror(f'<g class="flap-l" style="transform-origin:160px 262px">{wing}</g>', 400))

write('costumes', 'vampire-cape', DOG_VB,
      '<path fill="#C8263A" d="M164,196 C130,170 104,136 88,100 C120,124 148,134 182,150 Z"/>'
      '<path fill="#C8263A" d="M236,196 C270,170 296,136 312,100 C280,124 252,134 218,150 Z"/>'
      '<path fill="#231A2E" d="M150,196 C108,240 76,360 56,472 L344,472 C324,360 292,240 250,196 Z"/>'
      '<path fill="#C8263A" stroke="none" d="M158,214 C126,256 102,360 88,466 L312,466 C298,360 274,256 242,214 Z"/>')

# ---------------------------------------------------------------- Cats
ORANGE_CAT = '#F2A34E'
STRIPE = '#D7752A'
CREAM = '#FCE6C0'


def cat_head(cx, cy, fur, inner_ear, eye, pupil, fluffy_fur, extra=''):
    p = []
    ear = (f'<path fill="{fur}" d="M{cx - 64},{cy - 30} L{cx - 64},{cy - 102} L{cx - 14},{cy - 64} Z"/>'
           f'<path fill="{inner_ear}" stroke="none" d="M{cx - 54},{cy - 44} L{cx - 55},{cy - 86} L{cx - 26},{cy - 62} Z"/>')
    if fluffy_fur:
        ear += (f'<path d="M{cx - 50},{cy - 50} l-6,-14 M{cx - 44},{cy - 52} l-2,-16" fill="none" '
                f'stroke="{CREAM}" stroke-width="3"/>')
    p.append(ear + f'<g transform="translate({2 * cx},0) scale(-1,1)">{ear}</g>')
    if fluffy_fur:
        cheek = lambda a: 1.6 if abs(math.cos(a)) > 0.55 and math.sin(a) > -0.2 else 0.6
        p.append(f'<path fill="{fur}" d="{fluffy(cx, cy, 72, 62, 18, 0.07, cheek)}"/>')
    else:
        p.append(f'<ellipse cx="{cx}" cy="{cy}" rx="70" ry="60" fill="{fur}"/>')
    if fluffy_fur:  # tabby stripes + cream muzzle
        p.append(f'<g fill="none" stroke="{STRIPE}" stroke-width="6">'
                 f'<path d="M{cx - 12},{cy - 58} L{cx - 9},{cy - 38} M{cx},{cy - 60} L{cx},{cy - 36} M{cx + 12},{cy - 58} L{cx + 9},{cy - 38}"/>'
                 f'<path d="M{cx - 70},{cy + 4} L{cx - 48},{cy + 6} M{cx - 68},{cy + 18} L{cx - 48},{cy + 16}"/>'
                 f'<path d="M{cx + 70},{cy + 4} L{cx + 48},{cy + 6} M{cx + 68},{cy + 18} L{cx + 48},{cy + 16}"/></g>')
        p.append(f'<ellipse cx="{cx}" cy="{cy + 26}" rx="34" ry="24" fill="{CREAM}" stroke="none"/>')
    for s in (-1, 1):
        x = cx + s * 27
        p.append(f'<ellipse cx="{x}" cy="{cy - 6}" rx="17" ry="17" fill="{eye}" stroke-width="4"/>')
        p.append(f'<ellipse cx="{x}" cy="{cy - 5}" rx="{pupil}" ry="11" fill="#1a1420" stroke="none"/>')
        p.append(f'<circle cx="{x - 5}" cy="{cy - 12}" r="4.5" fill="#fff" stroke="none"/>')
    p.append(f'<path d="M{cx - 8},{cy + 14} L{cx + 8},{cy + 14} L{cx},{cy + 22} Z" fill="#F59BA6" stroke-width="3"/>')
    p.append(f'<path d="M{cx - 14},{cy + 28} Q{cx - 7},{cy + 36} {cx},{cy + 26} Q{cx + 7},{cy + 36} {cx + 14},{cy + 28}" '
             f'fill="none" stroke-width="4"/>')
    wc = '#F8F1E4' if not fluffy_fur else '#FFF8EA'
    p.append(f'<g stroke="{wc}" stroke-width="3" fill="none">'
             f'<path d="M{cx - 30},{cy + 20} L{cx - 66},{cy + 12} M{cx - 30},{cy + 26} L{cx - 64},{cy + 30}"/>'
             f'<path d="M{cx + 30},{cy + 20} L{cx + 66},{cy + 12} M{cx + 30},{cy + 26} L{cx + 64},{cy + 30}"/></g>')
    p.append(f'<g fill="#F59D9D" stroke="none" opacity=".55"><ellipse cx="{cx - 44}" cy="{cy + 14}" rx="10" ry="6"/>'
             f'<ellipse cx="{cx + 44}" cy="{cy + 14}" rx="10" ry="6"/></g>')
    return ''.join(p) + extra


def paws(cx, y, fur):
    return ''.join(f'<path fill="{fur}" d="M{x - 24},{y + 12} C{x - 24},{y - 14} {x + 24},{y - 14} {x + 24},{y + 12} Z"/>'
                   f'<path d="M{x - 7},{y - 2} L{x - 7},{y + 8} M{x + 7},{y - 2} L{x + 7},{y + 8}" fill="none" stroke-width="3"/>'
                   for x in (cx - 40, cx + 40))


# Black cat: friendly round head, big yellow eyes.
BLACK = '#2F2A3D'
write('characters', 'black-cat', '0 0 240 210',
      cat_head(120, 112, BLACK, '#F7A1C4', '#FFD84A', 6, False) + paws(120, 186, BLACK))
# Milly: fluffy long-haired orange tabby, pale green eyes, cream muzzle.
write('characters', 'milly-peek', '0 0 240 210',
      cat_head(120, 112, ORANGE_CAT, '#F7B9A8', '#CFDD72', 4, True) + paws(120, 186, ORANGE_CAT))


def milly_full():
    p = []
    # big fluffy tail with a cream tip, curling round to the right
    p.append(f'<path fill="{ORANGE_CAT}" d="M200,300 C262,300 290,256 280,206 C276,186 300,180 304,200 '
             f'C318,268 278,330 200,330 Z"/>')
    p.append(f'<path fill="{CREAM}" d="M280,206 C276,186 300,180 304,200 C306,212 304,222 302,230 C294,222 286,216 280,206 Z"/>')
    p.append(f'<path fill="{ORANGE_CAT}" d="{fluffy(150, 254, 92, 80, 16, 0.06)}"/>')
    p.append(f'<path fill="{CREAM}" stroke="none" d="{fluffy(150, 236, 42, 50, 10, 0.12)}"/>')
    p.append(f'<g fill="none" stroke="{STRIPE}" stroke-width="7"><path d="M70,240 Q84,236 92,250"/>'
             f'<path d="M66,270 Q82,266 92,280"/><path d="M230,240 Q216,236 208,250"/><path d="M234,270 Q218,266 208,280"/></g>')
    p.append(paws(150, 318, ORANGE_CAT))
    p.append(cat_head(150, 132, ORANGE_CAT, '#F7B9A8', '#CFDD72', 4, True))
    return ''.join(p)


write('characters', 'milly', '0 0 320 340', milly_full())

# ---------------------------------------------------------------- Friendly cast
write('characters', 'ghost', '0 0 200 240',
      '<path fill="#FFFFFF" d="M100,12 C152,12 182,52 182,112 L182,214 Q168,232 154,214 Q140,232 126,214 '
      'Q112,232 100,214 Q86,232 72,214 Q58,232 44,214 Q30,232 18,214 L18,112 C18,52 48,12 100,12 Z"/>'
      '<path d="M160,60 C170,90 170,160 168,200" fill="none" stroke="#E6E2FA" stroke-width="12"/>'
      '<path fill="#FFFFFF" d="M20,130 C0,124 -2,104 12,100 C20,100 22,110 22,118 Z"/>'
      '<path fill="#FFFFFF" d="M180,130 C200,124 202,104 188,100 C180,100 178,110 178,118 Z"/>'
      '<ellipse cx="74" cy="98" rx="13" ry="18" fill="#2b1b17"/><ellipse cx="126" cy="98" rx="13" ry="18" fill="#2b1b17"/>'
      '<circle cx="70" cy="91" r="4.5" fill="#fff" stroke="none"/><circle cx="122" cy="91" r="4.5" fill="#fff" stroke="none"/>'
      '<path d="M82,132 Q100,152 118,132 Q100,138 82,132 Z" fill="#9E2F3A" stroke-width="4"/>'
      '<g fill="#F7B6C8" stroke="none"><ellipse cx="54" cy="122" rx="11" ry="7"/><ellipse cx="146" cy="122" rx="11" ry="7"/></g>',
      extra_style='')


def jack(face=True, glow='#FFD34E'):
    p = ['<path d="M100,40 C98,24 104,12 116,6" fill="none" stroke="#2b1b17" stroke-width="18"/>'
         '<path d="M100,40 C98,24 104,12 116,6" fill="none" stroke="#3E8E41" stroke-width="10"/>',
         '<ellipse cx="62" cy="112" rx="52" ry="70" fill="#F57C10"/>',
         '<ellipse cx="138" cy="112" rx="52" ry="70" fill="#F57C10"/>',
         '<ellipse cx="100" cy="112" rx="56" ry="74" fill="#FF8C1A"/>',
         '<path d="M118,32 C136,16 160,22 166,32 C150,30 136,36 126,44" fill="#4CAF50"/>']
    if face:
        p.append(f'<path d="M58,100 L76,72 L94,100 Z M106,100 L124,72 L142,100 Z" fill="{glow}"/>')
        p.append(f'<path d="M48,128 Q100,190 152,128 Q136,138 124,136 L118,148 L106,138 Q100,140 94,138 '
                 f'L82,148 L76,136 Q64,138 48,128 Z" fill="{glow}"/>')
    return ''.join(p)


write('characters', 'pumpkin', '0 0 200 190', jack())
write('scenes', 'pumpkin-plain', '0 0 200 190', jack(False))

bat_wing = ('<path fill="#5E3E8F" d="M92,62 C70,30 36,22 6,34 C18,44 18,56 12,68 C26,64 38,70 40,84 '
            'C50,76 64,80 68,92 C76,82 86,82 92,86 Z"/>')
write('characters', 'bat', '0 0 220 140',
      f'<g class="flap-l" style="transform-origin:92px 70px">{bat_wing}</g>' +
      mirror(f'<g class="flap-l" style="transform-origin:92px 70px">{bat_wing}</g>', 220) +
      '<path fill="#5E3E8F" d="M84,40 L80,14 L98,32 Z M136,40 L140,14 L122,32 Z"/>'
      '<ellipse cx="110" cy="66" rx="32" ry="34" fill="#5E3E8F"/>'
      '<circle cx="98" cy="60" r="10" fill="#fff" stroke-width="3"/><circle cx="122" cy="60" r="10" fill="#fff" stroke-width="3"/>'
      '<circle cx="99" cy="62" r="5" fill="#111" stroke="none"/><circle cx="121" cy="62" r="5" fill="#111" stroke="none"/>'
      '<path d="M100,80 Q110,88 120,80" fill="none" stroke-width="4"/>'
      '<path d="M104,83 L107,90 L110,84 M110,84 L113,90 L116,83" fill="#fff" stroke-width="2"/>'
      '<g fill="#F7B6C8" stroke="none" opacity=".8"><ellipse cx="88" cy="76" rx="6" ry="4"/><ellipse cx="132" cy="76" rx="6" ry="4"/></g>')

write('characters', 'candy', '0 0 170 90',
      '<path fill="#FF8A1F" d="M40,45 L8,16 L14,45 L8,74 Z"/><path fill="#FF8A1F" d="M130,45 L162,16 L156,45 L162,74 Z"/>'
      '<ellipse cx="85" cy="45" rx="50" ry="32" fill="#9B5DE5"/>'
      '<path d="M64,20 L56,70 M88,16 L80,74 M112,20 L104,70" fill="none" stroke="#C9A6F5" stroke-width="9"/>'
      '<ellipse cx="85" cy="45" rx="50" ry="32" fill="none"/>')


def star_path(cx, cy, r1, r2, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        r = r1 if i % 2 == 0 else r2
        a = math.radians(rot + i * 180 / n)
        pts.append(f'{cx + math.cos(a) * r:.1f},{cy + math.sin(a) * r:.1f}')
    return 'M' + ' L'.join(pts) + ' Z'


write('characters', 'star', '0 0 120 120', f'<path fill="#FFD23F" d="{star_path(60, 64, 54, 24)}"/>'
      '<path d="M44,46 L52,40" fill="none" stroke="#FFF3B0" stroke-width="6"/>')
write('icons', 'sparkle', '0 0 100 100', f'<path fill="#FFF3B0" d="{star_path(50, 50, 46, 10, 4)}"/>')

# ---------------------------------------------------------------- Icons
write('icons', 'home', '0 0 120 120',
      '<path fill="#FF8A1F" d="M14,60 L60,18 L106,60 Z"/><path fill="#FFF3D6" d="M26,58 L94,58 L94,104 L26,104 Z"/>'
      '<path fill="#7B3FB8" d="M50,104 L50,76 Q60,66 70,76 L70,104 Z"/>')
write('icons', 'again', '0 0 120 120',
      '<path d="M88,40 A36,36 0 1 0 96,72" fill="none" stroke-width="30"/>'
      '<path d="M88,40 A36,36 0 1 0 96,72" fill="none" stroke="#5CC46A" stroke-width="18"/>'
      '<path fill="#5CC46A" d="M70,22 L108,26 L94,60 Z"/>')
speaker = '<path fill="#FFF3D6" d="M16,46 L36,46 L62,22 L62,98 L36,74 L16,74 Z"/>'
write('icons', 'sound-on', '0 0 120 120', speaker +
      '<path d="M76,44 Q88,60 76,76 M88,32 Q108,60 88,88" fill="none" stroke="#FFF3D6" stroke-width="8"/>')
write('icons', 'sound-off', '0 0 120 120', speaker +
      '<path d="M78,44 L106,76 M106,44 L78,76" fill="none" stroke="#FF6B6B" stroke-width="9"/>')
write('icons', 'tada', '0 0 140 140',
      f'<path fill="#FFD23F" d="{star_path(70, 74, 60, 27)}"/>'
      f'<path fill="#FFF3B0" d="{star_path(20, 22, 16, 4, 4)} {star_path(120, 24, 14, 4, 4)} {star_path(124, 118, 12, 3, 4)}"/>')
write('icons', 'hand', '0 0 120 140',
      f'<path fill="{SKIN}" d="M44,62 L44,16 C44,4 62,4 62,16 L62,58 C64,48 80,48 80,60 C82,50 98,52 98,64 '
      f'C100,56 114,58 114,70 L114,96 C114,124 96,136 74,136 C52,136 40,124 32,108 L14,80 C8,70 20,60 30,68 Z"/>'
      '<path d="M62,58 L62,72 M80,60 L80,72 M98,64 L98,74" fill="none" stroke-width="4"/>')
write('icons', 'rotate', '0 0 200 200',
      '<rect x="66" y="30" width="68" height="120" rx="12" fill="#FFF3D6"/>'
      '<path d="M40,170 A80,80 0 0 0 170,120" fill="none" stroke="#FF8A1F" stroke-width="10"/>'
      '<path fill="#FF8A1F" d="M178,96 L184,132 L152,124 Z"/>')

# ---------------------------------------------------------------- Occluders (things to hide behind)
write('scenes', 'tombstone', '0 0 200 160',
      '<path fill="#A9A3C2" d="M30,160 L30,60 C30,14 170,14 170,60 L170,160 Z"/>'
      '<path d="M60,58 C66,40 134,40 140,58" fill="none" stroke="#8C85A8" stroke-width="8"/>'
      '<path d="M70,84 L130,84 M76,104 L124,104" fill="none" stroke="#8C85A8" stroke-width="8"/>'
      '<path d="M150,70 L140,92 L150,104" fill="none" stroke-width="4"/>'
      '<path fill="#4E8A4E" d="M14,160 Q24,138 34,152 Q44,134 54,150 Q64,136 74,154 L130,154 Q138,136 148,150 '
      'Q158,132 168,150 Q178,138 188,160 Z"/>')
write('scenes', 'tombstone2', '0 0 200 160',
      '<path fill="#B7B1CF" d="M40,160 L40,54 L60,34 L140,34 L160,54 L160,160 Z"/>'
      '<circle cx="100" cy="84" r="20" fill="none" stroke="#9790B5" stroke-width="8"/>'
      '<path fill="#4E8A4E" d="M22,160 Q32,138 42,152 Q52,134 62,150 Q72,136 82,154 L120,154 Q128,136 138,150 '
      'Q148,132 158,150 Q168,138 178,160 Z"/>')
write('scenes', 'bush', '0 0 200 160',
      '<path fill="#3F8F4A" d="M10,160 C0,120 30,96 52,104 C56,66 104,52 124,82 C146,62 192,80 182,118 '
      'C204,128 198,160 190,160 Z"/>'
      '<g fill="#E8443A" stroke="none"><circle cx="60" cy="126" r="6"/><circle cx="118" cy="104" r="6"/>'
      '<circle cx="150" cy="134" r="6"/></g>'
      '<path d="M44,140 Q60,128 76,140 M110,128 Q124,118 138,128" fill="none" stroke="#2E6E37" stroke-width="5"/>')
write('scenes', 'fence', '0 0 200 160',
      '<path fill="#EFE6D2" d="M30,160 L30,44 L44,26 L58,44 L58,160 Z M86,160 L86,44 L100,26 L114,44 L114,160 Z '
      'M142,160 L142,44 L156,26 L170,44 L170,160 Z"/>'
      '<rect x="10" y="70" width="180" height="18" rx="4" fill="#E2D6BC"/>'
      '<rect x="10" y="122" width="180" height="18" rx="4" fill="#E2D6BC"/>')
write('scenes', 'hay', '0 0 200 160',
      '<rect x="14" y="40" width="172" height="120" rx="20" fill="#F2C94C"/>'
      '<path d="M30,60 L170,60 M30,90 L170,90 M30,120 L170,120" fill="none" stroke="#D9A82C" stroke-width="6"/>'
      '<path d="M60,40 L60,160 M140,40 L140,160" fill="none" stroke="#B5651D" stroke-width="10"/>')

# ---------------------------------------------------------------- Backdrops (400x800, shown with "slice")


def backdrop(name, sky_top, sky_bottom, ground_top, ground_bottom, horizon, extra_back='', extra_front=''):
    rnd = random.Random(name)
    stars = ''.join(f'<circle cx="{rnd.uniform(0, 400):.0f}" cy="{rnd.uniform(0, horizon - 60):.0f}" '
                    f'r="{rnd.uniform(1.2, 3):.1f}"/>' for _ in range(40))
    defs = (f'<defs><linearGradient id="{name}-sky" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{sky_top}"/><stop offset="1" stop-color="{sky_bottom}"/></linearGradient>'
            f'<linearGradient id="{name}-gr" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{ground_top}"/><stop offset="1" stop-color="{ground_bottom}"/></linearGradient></defs>')
    body = (defs + f'<rect x="-200" y="-200" width="800" height="1200" fill="url(#{name}-sky)" stroke="none"/>'
            f'<g fill="#FFF7D6" stroke="none" opacity=".8">{stars}</g>'
            '<circle cx="300" cy="120" r="48" fill="#FFF3C4"/>'
            '<g fill="#F1E2A8" stroke="none"><circle cx="286" cy="106" r="9"/><circle cx="314" cy="138" r="7"/>'
            '<circle cx="318" cy="104" r="5"/></g>' + extra_back +
            f'<path fill="url(#{name}-gr)" d="M-200,{horizon} Q100,{horizon - 40} 200,{horizon} T600,{horizon} L600,1000 L-200,1000 Z"/>'
            + extra_front)
    write('scenes', name, '0 0 400 800', body)


hills = '<path fill="#2B2452" stroke="none" d="M-200,300 Q0,200 160,280 Q260,220 400,270 Q500,240 600,280 L600,400 L-200,400 Z"/>'
trees = ''.join(f'<path fill="#231D44" stroke="none" d="M{x},{y} l-22,40 h14 l-18,34 h52 l-18,-34 h14 Z"/>'
                for x, y in [(30, 222), (70, 238), (360, 230)])
backdrop('graveyard', '#171338', '#3D2D72', '#4C7A55', '#2C4E36', 300, hills + trees)
house = ('<path fill="#3A2A5A" stroke="none" d="M20,300 L20,200 L80,150 L140,200 L140,300 Z"/>'
         '<rect x="50" y="210" width="26" height="26" fill="#FFD34E" stroke="none"/>'
         '<rect x="88" y="210" width="26" height="26" fill="#FFD34E" stroke="none"/>'
         '<rect x="66" y="252" width="28" height="48" fill="#FF8A1F" stroke="none"/>')
picket = ''.join(f'<path fill="#E9DCC6" stroke="none" d="M{x},300 l0,-34 l7,-8 l7,8 l0,34 Z"/>' for x in range(150, 420, 22))
backdrop('yard', '#3B2766', '#F08A5D', '#6AA35A', '#3E6E3A', 300, house + picket)
backdrop('night', '#1B1540', '#4A2F7A', '#3D2A63', '#2A1C48', 560, hills.replace('#2B2452', '#2C2160'))
backdrop('patch', '#1D1747', '#523384', '#6B4A2E', '#4A3220', 330, hills,
         ''.join(f'<path d="M{x},{y} q30,-20 60,0 t60,0" fill="none" stroke="#3F8F4A" stroke-width="6"/>'
                 for x, y in [(-20, 700), (240, 640), (60, 520), (280, 420)]))
backdrop('stage', '#2A1B4A', '#5B3A8E', '#8C5A3C', '#6A4128', 640,
         '<path d="M-60,40 Q200,120 460,40" fill="none" stroke="#FFE7B0" stroke-width="3"/>' +
         ''.join(f'<path fill="{c}" d="M{x},{48 + (x - 200) ** 2 * -0.0006 + 26:.0f} l18,0 l-9,26 Z"/>'
                 for x, c in zip(range(-40, 460, 34), ['#FF8A1F', '#9B5DE5', '#5CC46A'] * 6)))

print('art written to', os.path.normpath(ROOT))
