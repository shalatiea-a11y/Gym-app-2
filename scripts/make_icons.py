from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'www', 'icons')
os.makedirs(OUT, exist_ok=True)

BG = (9, 12, 19, 255)
BLUE = (79, 140, 255, 255)
PURPLE = (139, 107, 255, 255)


def gradient_bg(size, pad_ratio=0.0):
    img = Image.new('RGBA', (size, size), BG)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / size
        r = int(BLUE[0] + (PURPLE[0] - BLUE[0]) * t)
        g = int(BLUE[1] + (PURPLE[1] - BLUE[1]) * t)
        b = int(BLUE[2] + (PURPLE[2] - BLUE[2]) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
    return img


def rounded_mask(size, radius):
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
    return mask


def draw_barbell(draw, size, color):
    cx, cy = size / 2, size / 2
    bar_w = size * 0.62
    bar_h = size * 0.05
    draw.rounded_rectangle(
        [cx - bar_w / 2, cy - bar_h / 2, cx + bar_w / 2, cy + bar_h / 2],
        radius=bar_h / 2, fill=color,
    )
    plate_w = size * 0.10
    plate_h = size * 0.34
    for sign in (-1, 1):
        x = cx + sign * (bar_w / 2 - plate_w * 0.35)
        draw.rounded_rectangle(
            [x - plate_w / 2, cy - plate_h / 2, x + plate_w / 2, cy + plate_h / 2],
            radius=plate_w / 2, fill=color,
        )
        plate_w2 = size * 0.065
        plate_h2 = size * 0.22
        x2 = cx + sign * (bar_w / 2 + plate_w * 0.35)
        draw.rounded_rectangle(
            [x2 - plate_w2 / 2, cy - plate_h2 / 2, x2 + plate_w2 / 2, cy + plate_h2 / 2],
            radius=plate_w2 / 2, fill=color,
        )


def make_icon(size, filename, maskable=False):
    img = gradient_bg(size)
    draw = ImageDraw.Draw(img)
    draw_barbell(draw, size, (255, 255, 255, 235))
    if not maskable:
        radius = int(size * 0.22)
        mask = rounded_mask(size, radius)
        rounded = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        rounded.paste(img, (0, 0), mask)
        img = rounded
    img.save(os.path.join(OUT, filename))


make_icon(192, 'icon-192.png')
make_icon(512, 'icon-512.png')
make_icon(192, 'icon-maskable-192.png', maskable=True)
make_icon(512, 'icon-maskable-512.png', maskable=True)
print('icons written to', OUT)
