#!/usr/bin/env python3
"""
Generates the walking detective sprite frames + station NPC/prop sprites.

Style contract (must match the station SVGs):
- ink #2e2a33 outlines, warm paper #f4ecdb / #ede3cd fills
- coat rust #b0705a, hat brown #5e4632, trousers ink-blue #3a3f52
- slightly irregular hand-drawn paths, no perfect symmetry

Frames: 130x210 canvas, feet on the ground line y=204, facing in the file name.
side frames face RIGHT; the engine flips them for left.
"""
import os

OUT = '/home/z/my-project/public/art/player'
os.makedirs(OUT, exist_ok=True)

INK = '#2e2a33'
PAPER = '#ede3cd'
COAT = '#b0705a'
COAT_DARK = '#8a5343'
HAT = '#5e4632'
TROUSERS = '#3a3f52'
SCARF = '#c9a25e'
SHOE = '#2e2a33'

W, H = 130, 216


def svg(body):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'width="{W}" height="{H}">\n'
        f'  <g fill="none" stroke="{INK}" stroke-linecap="round" stroke-linejoin="round">\n{body}\n  </g>\n</svg>\n'
    )


def head_down(bob=0.0):
    """Facing the viewer: fedora, face, mustache. bob shifts the whole torso."""
    y = lambda v: round(v + bob, 1)
    return f'''
    <!-- fedora -->
    <ellipse cx="65" cy="{y(42)}" rx="41" ry="12.5" fill="{HAT}" stroke-width="3.4"/>
    <path d="M31 {y(42)} Q33 {y(15)} 65 {y(13)} Q97 {y(15)} 99 {y(42)}" fill="{HAT}" stroke-width="3.4"/>
    <path d="M34 {y(34)} Q65 {y(28)} 96 {y(34)}" stroke-width="2.4" opacity="0.75"/>
    <path d="M52 {y(22)} Q66 {y(18)} 82 {y(23)}" stroke="{PAPER}" stroke-width="2" opacity="0.4"/>
    <!-- face -->
    <path d="M46 {y(50)} Q45 {y(70)} 57 {y(76)} Q73 {y(79)} 83 {y(70)} Q85 {y(58)} 84 {y(50)}" fill="{PAPER}" stroke-width="3"/>
    <circle cx="57" cy="{y(59)}" r="2.3" fill="{INK}" stroke="none"/>
    <circle cx="74" cy="{y(59)}" r="2.3" fill="{INK}" stroke="none"/>
    <path d="M58 {y(68)} Q65.5 {y(72.5)} 73 {y(68)}" stroke-width="2.6"/>
    <path d="M65 {y(61)} Q67 {y(64)} 65 {y(66)}" stroke-width="1.8" opacity="0.7"/>'''


def head_up(bob=0.0):
    """Back of the head: no face, crown + brim edge + hair nape."""
    y = lambda v: round(v + bob, 1)
    return f'''
    <ellipse cx="65" cy="{y(42)}" rx="41" ry="12.5" fill="{HAT}" stroke-width="3.4"/>
    <path d="M31 {y(42)} Q33 {y(15)} 65 {y(13)} Q97 {y(15)} 99 {y(42)}" fill="{HAT}" stroke-width="3.4"/>
    <path d="M36 {y(41)} Q65 {y(35)} 94 {y(41)}" stroke-width="2.4" opacity="0.8"/>
    <path d="M47 {y(50)} Q46 {y(58)} 49 {y(62)} Q65 {y(66)} 81 {y(62)} Q84 {y(58)} 83 {y(50)}" fill="{PAPER}" stroke-width="2.6"/>
    <path d="M52 {y(54)} Q65 {y(57)} 78 {y(54)}" stroke-width="2" opacity="0.55"/>'''


def head_side(bob=0.0):
    """Right-facing profile."""
    y = lambda v: round(v + bob, 1)
    return f'''
    <ellipse cx="70" cy="{y(42)}" rx="41" ry="12" fill="{HAT}" stroke-width="3.4"/>
    <path d="M38 {y(42)} Q40 {y(15)} 72 {y(13)} Q102 {y(16)} 103 {y(42)}" fill="{HAT}" stroke-width="3.4"/>
    <path d="M41 {y(34)} Q72 {y(28)} 100 {y(34)}" stroke-width="2.4" opacity="0.75"/>
    <path d="M56 {y(49)} Q54 {y(68)} 66 {y(75)} Q78 {y(77)} 86 {y(66)} Q92 {y(60)} 89 {y(53)} Q84 {y(47)} 76 {y(47)}" fill="{PAPER}" stroke-width="3"/>
    <path d="M86 {y(56)} Q90 {y(58)} 87 {y(61)}" stroke-width="2.4"/>
    <circle cx="74" cy="{y(58)}" r="2.3" fill="{INK}" stroke="none"/>
    <path d="M70 {y(68)} Q76 {y(70)} 81 {y(67)}" stroke-width="2.4"/>'''


def torso_down(bob=0.0, arm_l=0.0, arm_r=0.0):
    """Front torso + arms. arm_l/arm_r: hand vertical offset (swing)."""
    y = lambda v: round(v + bob, 1)
    hl = round(140 + arm_l + bob, 1)
    hr = round(140 + arm_r + bob, 1)
    return f'''
    <path d="M40 {y(92)} Q42 {y(80)} 54 {y(77)} L76 {y(77)} Q88 {y(80)} 90 {y(92)} L95 {y(148)} Q80 {y(152)} 65 {y(151)} Q50 {y(152)} 35 {y(148)} Z" fill="{COAT}" stroke-width="3.6"/>
    <path d="M54 {y(78)} L61 {y(102)} L65 {y(92)} L69 {y(102)} L76 {y(78)}" fill="{COAT_DARK}" stroke-width="2.6"/>
    <path d="M65 {y(96)} L64 {y(150)}" stroke-width="2.2" opacity="0.8"/>
    <path d="M38 {y(116)} L92 {y(116)}" stroke-width="2" opacity="0.5"/>
    <rect x="36" y="{y(118)}" width="58" height="9" rx="3" fill="{COAT_DARK}" stroke-width="2.4"/>
    <rect x="60" y="{y(118)}" width="10" height="9" rx="2" fill="{SCARF}" stroke-width="2"/>
    <!-- sleeves -->
    <path d="M41 {y(93)} Q31 {y(106)} 32 {y(132)} L40 {y(134)} Q43 {y(112)} 47 {y(97)} Z" fill="{COAT}" stroke-width="3"/>
    <path d="M89 {y(93)} Q99 {y(106)} 98 {y(132)} L90 {y(134)} Q87 {y(112)} 83 {y(97)} Z" fill="{COAT}" stroke-width="3"/>
    <circle cx="36" cy="{hl}" r="5.5" fill="{PAPER}" stroke-width="2.6"/>
    <circle cx="94" cy="{hr}" r="5.5" fill="{PAPER}" stroke-width="2.6"/>
    <!-- scarf knot -->
    <path d="M56 {y(80)} Q65 {y(86)} 74 {y(80)}" stroke="{SCARF}" stroke-width="5" opacity="0.9"/>'''


def torso_up(bob=0.0, arm_l=0.0, arm_r=0.0):
    y = lambda v: round(v + bob, 1)
    hl = round(140 + arm_l + bob, 1)
    hr = round(140 + arm_r + bob, 1)
    return f'''
    <path d="M40 {y(92)} Q42 {y(80)} 65 {y(78)} Q88 {y(80)} 90 {y(92)} L95 {y(148)} Q80 {y(152)} 65 {y(151)} Q50 {y(152)} 35 {y(148)} Z" fill="{COAT}" stroke-width="3.6"/>
    <path d="M65 {y(80)} L65 {y(150)}" stroke-width="2.2" opacity="0.7"/>
    <path d="M47 {y(86)} Q52 {y(83)} 56 {y(84)} M74 {y(84)} Q78 {y(83)} 83 {y(86)}" stroke-width="2.4" opacity="0.8"/>
    <rect x="36" y="{y(118)}" width="58" height="9" rx="3" fill="{COAT_DARK}" stroke-width="2.4"/>
    <path d="M40 {y(93)} Q30 {y(106)} 32 {y(132)} L40 {y(134)} Q43 {y(112)} 46 {y(97)} Z" fill="{COAT}" stroke-width="3"/>
    <path d="M90 {y(93)} Q100 {y(106)} 98 {y(132)} L90 {y(134)} Q87 {y(112)} 84 {y(97)} Z" fill="{COAT}" stroke-width="3"/>
    <circle cx="36" cy="{hl}" r="5.5" fill="{PAPER}" stroke-width="2.6"/>
    <circle cx="94" cy="{hr}" r="5.5" fill="{PAPER}" stroke-width="2.6"/>'''


def torso_side(bob=0.0, arm=0.0):
    """Right-facing torso; one visible sleeve, coat tail behind."""
    y = lambda v: round(v + bob, 1)
    hand = round(140 + arm + bob, 1)
    return f'''
    <path d="M44 {y(92)} Q47 {y(80)} 62 {y(77)} L80 {y(79)} Q92 {y(83)} 94 {y(94)} L97 {y(146)} L101 {y(154)} L88 {y(151)} L46 {y(150)} L33 {y(156)} L38 {y(146)} Q40 {y(110)} 44 {y(92)} Z" fill="{COAT}" stroke-width="3.6"/>
    <path d="M56 {y(80)} L63 {y(104)} L69 {y(90)}" fill="{COAT_DARK}" stroke-width="2.6"/>
    <path d="M47 {y(118)} L93 {y(120)}" stroke-width="2" opacity="0.5"/>
    <rect x="45" y="{y(119)}" width="48" height="9" rx="3" fill="{COAT_DARK}" stroke-width="2.4"/>
    <path d="M50 {y(94)} Q45 {y(112)} 47 {y(132)} L55 {y(133)} Q55 {y(112)} 57 {y(97)} Z" fill="{COAT}" stroke-width="3"/>
    <circle cx="51" cy="{hand}" r="5.5" fill="{PAPER}" stroke-width="2.6"/>
    <path d="M60 {y(81)} Q68 {y(87)} 76 {y(82)}" stroke="{SCARF}" stroke-width="5" opacity="0.9"/>'''


def legs_down(foot_l, foot_r, lift_l=0.0, lift_r=0.0):
    """Two legs seen from the front. foot_*: x centres; lift_* raises a heel."""
    ly = 204
    lk = lambda lift: round(ly - lift, 1)
    return f'''
    <path d="M47 148 L44 {lk(lift_l)} L60 {lk(lift_l)} L58 148 Z" fill="{TROUSERS}" stroke-width="3"/>
    <path d="M72 148 L70 {lk(lift_r)} L86 {lk(lift_r)} L83 148 Z" fill="{TROUSERS}" stroke-width="3"/>
    <ellipse cx="{foot_l}" cy="{lk(lift_l) + 3}" rx="13.5" ry="5.5" fill="{SHOE}" stroke-width="2.6"/>
    <ellipse cx="{foot_r}" cy="{lk(lift_r) + 3}" rx="13.5" ry="5.5" fill="{SHOE}" stroke-width="2.6"/>'''


def legs_up(foot_l, foot_r, lift_l=0.0, lift_r=0.0):
    ly = 204
    lk = lambda lift: round(ly - lift, 1)
    return f'''
    <path d="M47 148 L45 {lk(lift_l)} L60 {lk(lift_l)} L58 148 Z" fill="{TROUSERS}" stroke-width="3"/>
    <path d="M72 148 L70 {lk(lift_r)} L85 {lk(lift_r)} L83 148 Z" fill="{TROUSERS}" stroke-width="3"/>
    <ellipse cx="{foot_l}" cy="{lk(lift_l) + 3}" rx="12.5" ry="5.5" fill="{SHOE}" stroke-width="2.6"/>
    <ellipse cx="{foot_r}" cy="{lk(lift_r) + 3}" rx="12.5" ry="5.5" fill="{SHOE}" stroke-width="2.6"/>'''


def legs_side(stride, lift_front=0.0, lift_back=0.0):
    """Right-facing legs. stride: +f = front foot ahead, back foot mirrors."""
    fx = round(66 + stride, 1)
    bx = round(66 - stride * 0.8, 1)
    fy = round(204 - lift_front, 1)
    by = round(204 - lift_back, 1)
    return f'''
    <path d="M60 148 L{bx} {by} L{bx + 14} {by} L70 148 Z" fill="{TROUSERS}" stroke-width="3" opacity="0.92"/>
    <path d="M64 148 L{fx} {fy} L{fx + 14} {fy} L72 148 Z" fill="{TROUSERS}" stroke-width="3"/>
    <ellipse cx="{bx + 8}" cy="{by + 3}" rx="13" ry="5.5" fill="{SHOE}" stroke-width="2.6"/>
    <ellipse cx="{fx + 8}" cy="{fy + 3}" rx="13" ry="5.5" fill="{SHOE}" stroke-width="2.6"/>'''


FRAMES = {
    # facing the viewer
    'down-0': head_down() + torso_down() + legs_down(51, 79),
    'down-1': head_down(-3) + torso_down(-3, arm_l=6, arm_r=-6) + legs_down(44, 86, lift_r=7),
    'down-2': head_down(-3) + torso_down(-3, arm_l=-6, arm_r=6) + legs_down(86, 44, lift_l=7),
    # back to the viewer
    'up-0': head_up() + torso_up() + legs_up(51, 79),
    'up-1': head_up(-3) + torso_up(-3, arm_l=6, arm_r=-6) + legs_up(45, 85, lift_r=7),
    'up-2': head_up(-3) + torso_up(-3, arm_l=-6, arm_r=6) + legs_up(85, 45, lift_l=7),
    # right-facing (engine flips for left)
    'side-0': head_side() + torso_side() + legs_side(3),
    'side-1': head_side(-3) + torso_side(-3, arm=-5) + legs_side(14, lift_back=6),
    'side-2': head_side(-3) + torso_side(-3, arm=5) + legs_side(-4, lift_front=7, lift_back=2),
}

for name, body in FRAMES.items():
    with open(f'{OUT}/{name}.svg', 'w') as f:
        f.write(svg(body))
    print('wrote', f'{OUT}/{name}.svg')
