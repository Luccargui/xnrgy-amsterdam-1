"""Genera el favicon y los iconos de la app (logo 2B: X de XNRGY + 1 en contorno).
Uso: python3 tools/make-icons.py   (necesita rsvg-convert y Pillow)"""
import subprocess, os
from PIL import Image

BG, FG = "#0a0a0a", "#ffffff"
# La X del logo de XNRGY (ocupa ~21.2 x 20.55 unidades)
X_PATHS = [
 ('M4.082.809A2.354,2.354,0,1,0,.628,4.01L5.463,8.526a2.355,2.355,0,0,0,3.455-3.2Z', 'translate(0 -0.043)'),
 ('M55.734,49.793a2.355,2.355,0,0,0-3.454,3.2l4.836,4.516a2.355,2.355,0,1,0,3.455-3.2Z', 'translate(-39.743 -37.732)'),
 ('M59.521.153a2.356,2.356,0,0,0-2.406.655L52.28,5.324a2.355,2.355,0,1,0,3.454,3.2L60.57,4.009A2.356,2.356,0,0,0,59.521.153', 'translate(-39.743 -0.041)'),
 ('M7.869,49.138a2.355,2.355,0,0,0-2.406.655L.628,54.308a2.355,2.355,0,0,0,3.454,3.2l4.836-4.516a2.355,2.355,0,0,0-1.049-3.856', 'translate(0 -37.732)'),
]
def xglyph(cx, cy, size):
    s = size / 21.2
    paths = "".join(f'<path d="{d}" transform="{t}"/>' for d, t in X_PATHS)
    return f'<g transform="translate({cx - 10.6*s:.2f} {cy - 10.27*s:.2f}) scale({s:.4f})">{paths}</g>'

# El "1" en contorno: silueta exterior y hueco interior con el mismo grosor en todo el trazo
ONE = [(326,132),(402,132),(402,380),(324,380),(324,214),(286,234),(286,160)]
def _inside(pt, poly):
    x, y = pt; c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[(i+1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2-x1)*(y-y1)/(y2-y1)+x1: c = not c
    return c
def _inset(poly, t):
    n = len(poly); lines = []
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i+1) % n]; dx, dy = x2-x1, y2-y1; L = (dx*dx+dy*dy)**.5; dx /= L; dy /= L
        nx, ny = -dy, dx
        if not _inside(((x1+x2)/2+nx*.5, (y1+y2)/2+ny*.5), poly): nx, ny = -nx, -ny
        lines.append(((x1+nx*t, y1+ny*t), (dx, dy)))
    out = []
    for i in range(n):
        (p, d), (q, e) = lines[i-1], lines[i]
        u = ((q[0]-p[0])*e[1]-(q[1]-p[1])*e[0])/(d[0]*e[1]-d[1]*e[0])
        out.append((p[0]+d[0]*u, p[1]+d[1]*u))
    return out
def _path(pts): return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"
def one_outline(x_left, y_top, h, stroke=20):
    s = h / 248; o = [(x_left+(x-286)*s, y_top+(y-132)*s) for x, y in ONE]
    return f'<path fill-rule="evenodd" d="{_path(o)} {_path(_inset(o, stroke))}"/>'

# Proporciones del logo 2B: X de 236 px y 1 de 210 px de alto, separados 6 px, centrados en 512
XS, H1, GAP = 236, 210, 6
OW = 116 * H1 / 248
LEFT = 256 - (XS + GAP + OW) / 2
GLYPH = xglyph(LEFT + XS/2, 256, XS) + one_outline(LEFT + XS + GAP, 256 - H1/2, H1)

def svg(rx=112, bg=True, k=1.0, fill=FG):
    rect = f'<rect width="512" height="512" rx="{rx}" fill="{BG}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{rect}'
            f'<g fill="{fill}" transform="translate(256 256) scale({k}) translate(-256 -256)">{GLYPH}</g></svg>')

def png(src, out, size):
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), "-o", out, src], check=True)

os.makedirs("/tmp/icons", exist_ok=True)
open("favicon.svg", "w").write(svg() + "\n")
variants = {"round": svg(), "square": svg(rx=0), "maskable": svg(rx=0, k=0.8), "badge": svg(bg=False, k=1.4), "glyph": svg(bg=False)}
for name, s in variants.items(): open(f"/tmp/icons/{name}.svg", "w").write(s)
png("/tmp/icons/round.svg", "favicon-32.png", 32)
png("/tmp/icons/round.svg", "icon-192.png", 192)
png("/tmp/icons/round.svg", "icon-512.png", 512)
png("/tmp/icons/square.svg", "apple-touch-icon.png", 180)   # iOS pone sus propias esquinas
png("/tmp/icons/maskable.svg", "icon-maskable-512.png", 512)  # Android recorta: logo dentro de la zona segura
png("/tmp/icons/badge.svg", "badge-72.png", 72)               # Android usa solo la silueta blanca

# Imagen para compartir: el logo sustituye a la pelota, arriba a la derecha
og = Image.open("og-image.jpg").convert("RGB")
og.paste((10, 10, 10), (960, 70, 1130, 210))
gw = 168  # ancho del logo en la imagen (el glifo mide 340 de 512 de ancho)
png("/tmp/icons/glyph.svg", "/tmp/icons/glyph.png", round(gw * 512 / 340))
g = Image.open("/tmp/icons/glyph.png").convert("RGBA")
bbox = g.getbbox(); g = g.crop(bbox)
og.paste(g, (1100 - g.width, 139 - g.height // 2), g)
og.save("og-image.jpg", quality=90)
print("iconos generados; logo", g.size, "en la imagen para compartir")
