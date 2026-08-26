"""
Convierte las 5 capas de fondo de Barbara (glow puro sobre negro) en PNG
con canal alfa real, recortadas a su contenido visible.

Tecnica: sobre negro puro, un pixel de "luz" (r,g,b) es aditivo: no lleva
informacion de alfa propia. alfa = max(r,g,b) recupera cuanto "brilla" ese
pixel; luego se des-premultiplica (rgb / alfa) para que, al componer con
alpha normal (no solo "screen"), el color y brillo visibles sean iguales
a los del original. Asi las capas sirven tanto con mix-blend-mode:screen
(para el bloom real) como con opacidad/composicion normal.
"""
import sys
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

ENTRADA = Path(r"D:\Downloads")
SALIDA = Path(__file__).resolve().parent.parent / "public" / "assets" / "barbara" / "fondo"
SALIDA.mkdir(parents=True, exist_ok=True)

ARCHIVOS = {
    "ChatGPT Image Aug 25, 2026, 08_45_51 PM.png": "anillo.webp",
    "ChatGPT Image Aug 25, 2026, 08_45_54 PM.png": "planeta-grande.webp",
    "ChatGPT Image Aug 25, 2026, 08_45_56 PM.png": "planeta-chico.webp",
    "ChatGPT Image Aug 25, 2026, 08_45_58 PM.png": "cinta-vidrio.webp",
    "ChatGPT Image Aug 25, 2026, 08_46_00 PM.png": "particulas.webp",
}

BLUR = 0.4      # desenfoque MINIMO: solo mata grano de un pixel.
                # Con alfa = luminancia, un pixel de ruido oscuro ya sale casi
                # invisible, asi que no hace falta mas. La version anterior
                # usaba 1.6 y borroneaba la red de puntos del planeta: eso es
                # lo que se veia como "baja calidad" en pantalla.
UMBRAL = 8      # bajo este valor de max(r,g,b) se considera negro puro, alfa 0
PISO_DIVISOR = 8  # solo evita dividir por ~0; no altera el resultado visible
PADDING = 24    # px de aire alrededor del bounding box recortado


def procesar(origen: Path, destino: Path):
    """
    La identidad que hay que respetar: componer el PNG resultante sobre negro
    con alpha-blending normal tiene que devolver EXACTAMENTE el pixel original.

        salida = color * alfa   ==>   color = c/lum ,  alfa = lum/255
        componer sobre negro = (c/lum) * (lum/255) = c/255   ✓

    Version anterior (rota): el alfa salia de una rampa
    `clip((lum-UMBRAL)/30)` pero el color se dividia por `max(lum, 46)`.
    Los dos numeros dejaron de ser inversos y todo lo tenue salio hasta
    ~3,7x mas brillante -- el planeta se comia la pantalla. Se detecto
    comparando el render contra la composicion de referencia, no leyendo
    el codigo. El alfa y el divisor tienen que ser el MISMO numero.
    """
    img = Image.open(origen).convert("RGB")
    # Un blur leve mata el grano de compresion pixel a pixel sin perder la
    # forma (anillo, planeta, cinta): sin esto, dividir por un alfa chico
    # amplifica ese grano en salpicado de colores saturados al azar.
    suave = img.filter(ImageFilter.GaussianBlur(radius=BLUR))
    arr = np.asarray(suave).astype(np.float32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    alfa = np.maximum(np.maximum(r, g), b)

    mascara = alfa >= UMBRAL
    escala = 255.0 / np.maximum(alfa, PISO_DIVISOR)
    r2 = np.clip(r * escala, 0, 255)
    g2 = np.clip(g * escala, 0, 255)
    b2 = np.clip(b * escala, 0, 255)
    alfa_out = np.where(mascara, alfa, 0.0)

    salida = np.stack([r2, g2, b2, alfa_out], axis=-1).astype(np.uint8)
    out_img = Image.fromarray(salida, mode="RGBA")

    ys, xs = np.where(mascara)
    if len(xs) == 0:
        print(f"  ! {origen.name}: no se encontro contenido visible, se guarda entero")
        out_img.save(destino)
        return None
    x0, x1 = max(0, xs.min() - PADDING), min(out_img.width, xs.max() + PADDING + 1)
    y0, y1 = max(0, ys.min() - PADDING), min(out_img.height, ys.max() + PADDING + 1)
    recorte = out_img.crop((x0, y0, x1, y1))
    # WebP con alfa a q95: el fondo es la pieza visual protagonista y a q88
    # los degradados del halo bandeaban. `method=6` es el esfuerzo maximo
    # del codificador; da igual que sea lento, esto corre una sola vez.
    recorte.save(destino, "WEBP", quality=95, method=6)
    W, H = img.size
    # Posicion del recorte DENTRO del lienzo original, en %. Las 5 capas
    # comparten lienzo (1750x899): asi se vuelven a alinear 1:1 como en la
    # composicion de referencia, sin adivinar posiciones a ojo.
    pos = {
        "left": round(100 * x0 / W, 3),
        "top": round(100 * y0 / H, 3),
        "width": round(100 * (x1 - x0) / W, 3),
        "height": round(100 * (y1 - y0) / H, 3),
    }
    print(f"  OK {origen.name} -> {destino.name}  {img.size} -> {recorte.size}")
    print(f"     left:{pos['left']}%  top:{pos['top']}%  width:{pos['width']}%  height:{pos['height']}%")
    return pos


def main():
    posiciones = {}
    for nombre_in, nombre_out in ARCHIVOS.items():
        origen = ENTRADA / nombre_in
        if not origen.exists():
            print(f"  ! No existe: {origen}")
            continue
        pos = procesar(origen, SALIDA / nombre_out)
        if pos:
            posiciones[nombre_out] = pos

    print("\n--- CSS ---")
    for nombre, p in posiciones.items():
        clase = nombre.replace(".png", "")
        print(f".barbara-fondo-{clase} {{ left: {p['left']}%; top: {p['top']}%; width: {p['width']}%; }}")


if __name__ == "__main__":
    main()
