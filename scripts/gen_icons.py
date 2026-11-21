"""Generate PWA icons for Ink & Ashes: magnifier-on-paper, hand-drawn feel."""
from PIL import Image, ImageDraw

INK = (46, 42, 51, 255)
PAPER = (244, 236, 219, 255)
NIGHT = (58, 63, 82, 255)
ACCENT = (180, 85, 45, 255)
OCHRE = (201, 162, 94, 255)


def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), NIGHT)
    d = ImageDraw.Draw(img)

    # safe area for maskable icons keeps content inside the middle 80%
    pad = int(size * (0.10 if maskable else 0.06))
    box = (pad, pad, size - pad, size - pad)

    # paper card
    d.rounded_rectangle(box, radius=int(size * 0.16), fill=PAPER, outline=INK, width=max(2, size // 48))

    # faint rain streaks
    for i in range(5):
        x = box[0] + int(size * (0.12 + 0.05 * i))
        y0 = box[1] + int(size * 0.10)
        y1 = box[1] + int(size * 0.34)
        d.line([(x, y0), (x - int(size * 0.02), y1)], fill=(143, 163, 176, 160), width=max(2, size // 90))

    # fox-ear doodle, top right
    ex, ey = size - int(size * 0.26), box[1] + int(size * 0.16)
    ew = int(size * 0.14)
    d.polygon([(ex, ey + ew), (ex + ew // 2, ey), (ex + ew, ey + ew)], outline=INK, width=max(2, size // 80))

    # magnifier: circle + handle
    cx = int(size * (0.44 if maskable else 0.44))
    cy = int(size * 0.52)
    r = int(size * 0.20)
    lw = max(3, size // 40)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=INK, width=lw)
    d.ellipse((cx - int(r * 0.7), cy - int(r * 0.7), cx + int(r * 0.7), cy + int(r * 0.7)), outline=(143, 163, 176, 130), width=max(2, lw // 2))
    hx0, hy0 = cx + int(r * 0.72), cy + int(r * 0.72)
    hx1, hy1 = cx + int(r * 1.5), cy + int(r * 1.5)
    d.line([(hx0, hy0), (hx1, hy1)], fill=ACCENT, width=lw * 2)

    # clue ring under the lens
    d.arc((box[0] + int(size * 0.12), cy + int(size * 0.14), box[2] - int(size * 0.14), size - box[1] - int(size * 0.08)),
          start=200, end=340, fill=OCHRE, width=max(2, size // 70))
    return img


import os
os.makedirs("/home/z/my-project/public/icons", exist_ok=True)
draw_icon(192).save("/home/z/my-project/public/icons/icon-192.png")
draw_icon(512).save("/home/z/my-project/public/icons/icon-512.png")
draw_icon(512, maskable=True).save("/home/z/my-project/public/icons/maskable-512.png")
print("icons written")
