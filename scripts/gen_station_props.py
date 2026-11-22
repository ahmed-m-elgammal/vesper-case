#!/usr/bin/env python3
"""
Station depth-sort sprites:
1. station_int_cooler.svg -- the water cooler group extracted from the original
   interior art, kept in ORIGINAL world coordinates (viewBox offset trick) so
   the engine can redraw it above the player when he walks behind it.
2. station_int_dewi.svg -- Constable Dewi, drawn in the same ink-silhouette
   style as Hollis/Quill/Cray, standing mid-floor (so the player can walk
   behind and in front of him -- Y-sort demo piece).
"""
import re

INT = '/home/z/my-project/public/art/station_int.svg'
OUT_COOL = '/home/z/my-project/public/art/station_int_cooler.svg'
OUT_DEWI = '/home/z/my-project/public/art/station_int_dewi.svg'
INK = '#2e2a33'
PAPER = '#f4ecdb'
BRASS = '#c9a25e'

# ---------- 1. water cooler extraction ----------
src = open(INT).read()
m = re.search(r'(  <!-- ============ water cooler.*?</g>\n)', src, re.S)
assert m, 'cooler group not found'
cooler_group = m.group(1)
defs = re.search(r'(<defs>.*?</defs>)', src, re.S).group(1)

# original group spans x 1556-1708, y 556-806 (plus stroke bleed -> margin 6)
cool_svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="1550 550 164 262" width="164" height="262">\n'
    f'{defs}\n'
    f'{cooler_group}</svg>\n'
)
open(OUT_COOL, 'w').write(cool_svg)
print('wrote', OUT_COOL, len(cool_svg), 'bytes')

# ---------- 2. Constable Dewi ----------
# World-space: feet at y=950, helmet top ~y=690. Canvas viewBox 1320 640 250 320.
dewi_body = f'''
  <!-- Constable Dewi: ink silhouette, brass buttons, notebook in hand -->
  <g filter="url(#inWobble)" stroke="{INK}" stroke-linecap="round">
    <!-- custodian helmet -->
    <path d="M1425 700 Q1425 664 1452 656 Q1479 664 1479 700 L1479 712 H1425 Z" fill="{INK}" fill-opacity="0.9" stroke-width="3.6"/>
    <path d="M1418 712 H1486" stroke-width="4"/>
    <path d="M1432 674 Q1452 666 1472 674" stroke="{BRASS}" stroke-width="3" fill="none" opacity="0.8"/>
    <path d="M1452 660 V710" stroke-width="2" opacity="0.5"/>
    <!-- face patch + calm features -->
    <path d="M1431 718 Q1430 744 1444 752 Q1462 755 1472 744 Q1478 730 1473 718 Z" fill="{PAPER}" fill-opacity="0.9" stroke-width="2.6"/>
    <circle cx="1443" cy="730" r="2.4" fill="{INK}" stroke="none"/>
    <circle cx="1461" cy="730" r="2.4" fill="{INK}" stroke="none"/>
    <path d="M1445 742 Q1452 745 1459 742" stroke-width="2.2" fill="none"/>
    <!-- big constable torso: double-breasted tunic -->
    <path d="M1421 762 Q1423 752 1436 750 L1468 750 Q1481 752 1483 762 L1490 852 Q1452 858 1414 852 Z" fill="{INK}" fill-opacity="0.88" stroke-width="3.6"/>
    <path d="M1452 754 V852" stroke-width="2" opacity="0.4"/>
    <path d="M1436 758 L1432 848 M1468 758 L1472 848" stroke-width="2" opacity="0.35"/>
    <!-- brass buttons -->
    <circle cx="1438" cy="782" r="4.4" fill="{BRASS}" stroke="none"/>
    <circle cx="1438" cy="804" r="4.4" fill="{BRASS}" stroke="none"/>
    <circle cx="1438" cy="826" r="4.4" fill="{BRASS}" stroke="none"/>
    <circle cx="1466" cy="782" r="4.4" fill="{BRASS}" stroke="none"/>
    <circle cx="1466" cy="804" r="4.4" fill="{BRASS}" stroke="none"/>
    <circle cx="1466" cy="826" r="4.4" fill="{BRASS}" stroke="none"/>
    <!-- collar + tie -->
    <path d="M1442 754 L1452 764 L1462 754" fill="none" stroke-width="2.6"/>
    <!-- sleeves; right hand holds his notebook -->
    <path d="M1422 764 Q1408 790 1412 830 L1424 832 Q1428 798 1430 770 Z" fill="{INK}" fill-opacity="0.88" stroke-width="3"/>
    <path d="M1482 764 Q1496 790 1492 828 L1480 830 Q1476 798 1474 770 Z" fill="{INK}" fill-opacity="0.88" stroke-width="3"/>
    <circle cx="1417" cy="838" r="6" fill="{PAPER}" fill-opacity="0.9" stroke-width="2.4"/>
    <circle cx="1487" cy="834" r="6" fill="{PAPER}" fill-opacity="0.9" stroke-width="2.4"/>
    <!-- little beat book in the left hand -->
    <rect x="1478" y="838" width="26" height="34" rx="3" fill="{PAPER}" fill-opacity="0.95" stroke-width="2.4"/>
    <path d="M1484 848 H1500 M1484 856 H1498 M1484 864 H1500" stroke-width="1.8" opacity="0.7"/>
    <!-- trousers + boots -->
    <path d="M1428 852 L1424 928 L1442 928 L1446 852 Z" fill="{INK}" fill-opacity="0.85" stroke-width="3"/>
    <path d="M1458 852 L1462 928 L1480 928 L1476 852 Z" fill="{INK}" fill-opacity="0.85" stroke-width="3"/>
    <ellipse cx="1433" cy="940" rx="17" ry="7" fill="{INK}" stroke-width="2.6"/>
    <ellipse cx="1471" cy="940" rx="17" ry="7" fill="{INK}" stroke-width="2.6"/>
    <!-- ground shadow -->
    <ellipse cx="1452" cy="950" rx="64" ry="12" fill="{INK}" opacity="0.14" stroke="none"/>
  </g>
'''
dewi_svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="1320 640 250 320" width="250" height="320">\n'
    f'{defs}\n{dewi_body}</svg>\n'
)
open(OUT_DEWI, 'w').write(dewi_svg)
print('wrote', OUT_DEWI, len(dewi_svg), 'bytes')
