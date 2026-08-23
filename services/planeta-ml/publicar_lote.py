# -*- coding: utf-8 -*-
"""Planeta Shop · publicador de faltantes en la nube (GitHub Actions).

Versión cloud de lo que Codex dejó armado en `ml-migracion/` (PC de
Joaquín, 22-ago-2026). Dos diferencias, nada más, y las dos por la misma
razón — que corra sin depender de que ese PC esté prendido:

  1. El stock/costo del ERP se lee por REST directo a `ps_productos`
     (PLANETA_SUPABASE_URL/KEY), sin importar `shared` del repo `steve`
     (que vive en otra máquina, no en GitHub).
  2. Las fotos se bajan del bucket privado `ml-fotos` (mismo proyecto
     Supabase del ERP) en vez de leerlas del disco.

La validación de alias (`producto_de`/`componentes` de `shared.inventario`)
NO se repite acá: los 36 candidatos de este lote ya se validaron una vez en
el PC de Joaquín (dry-run del 22-ago, cero alias inválidos). Si en el
futuro se agrega un producto nuevo a PRODUCTOS, hay que validarlo a mano
contra `shared.inventario` antes de sumarlo acá — este script no lo hace
solo.

Todo lo demás es igual a como lo dejó Codex: exclusiones duras, revalida
stock justo antes de cada POST, nunca toca a Sebastián, pausas aleatorias
entre publicaciones, estado idempotente.

Uso:
    python publicar_lote.py --dry-run
    python publicar_lote.py --ejecutar --limite 8 --max-diario 8 \
        --min-espera 480 --max-espera 1080
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import mimetypes
import os
import random
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import mlauth
from precios import calcular_producto, precio_agustin, utilidad

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE = Path(__file__).resolve().parent
ESTADO = BASE / "publicaciones_programadas.json"
REPORTE = BASE / "ultimo_lote.json"
LOG = BASE / "historial_lotes.jsonl"
CUENTAS = ("vieja", "nueva", "agustin")
UPLOAD_URL = "https://api.mercadolibre.com/pictures/items/upload"

FOTOS_URL = os.environ.get("PLANETA_SUPABASE_URL", "").rstrip("/")
FOTOS_KEY = os.environ.get("PLANETA_SUPABASE_KEY", "")

# (codex, heredado) Cinco exclusiones del brief + tres bloqueos conservadores
# derivados de la etiqueta/nombre médico. Nunca entran a la cola.
PROHIBIDOS = {
    "lingo_leap": "zeolita / antecedente de sanción",
    "melatonina": "medicamento / antecedente de sanción",
    "nad_selerb": "ashwagandha KSM-66 / antecedente de sanción",
    "sweet_dreams": "la etiqueta declara CBD y melatonina",
    "thyroid": "la etiqueta declara ashwagandha",
    "candida_cleanse": "nombre asociado a tratamiento de infección; revisión manual",
    "dental": "la pieza declara reparación de esmalte y acción anticaries",
    "terbifin": "nombre y claims antifúngicos de carácter medicinal",
}


def desc_suplemento(nombre: str, presentacion: str, etiqueta: str = "") -> str:
    detalle = f" La etiqueta declara: {etiqueta}." if etiqueta else ""
    return (
        f"{nombre}. Suplemento alimentario en {presentacion}.{detalle}\n\n"
        "Consumir únicamente según las indicaciones impresas en el envase. "
        "No reemplaza una alimentación balanceada ni la indicación de un "
        "profesional competente.\n\n"
        "Producto sellado de fábrica, en su envase original. Envío por "
        "Mercado Envíos y despacho dentro de 24 horas hábiles después de la compra."
    )


def desc_externo(nombre: str, presentacion: str) -> str:
    return (
        f"{nombre}. Producto de uso externo en {presentacion}.\n\n"
        "Usar únicamente según las indicaciones impresas en el envase. No "
        "ingerir y evitar el contacto con los ojos.\n\n"
        "Producto sellado de fábrica, en su envase original. Envío por "
        "Mercado Envíos y despacho dentro de 24 horas hábiles después de la compra."
    )


# (codex, heredado tal cual del 22-ago-2026) Títulos y descripciones sin
# promesas terapéuticas. Fuente de categoría/atributos: publicación real ya
# activa (`source`) o ficha manual (`atributos`) cuando no había una fuente.
PRODUCTOS = {
    "aceite_semilla": {
        "titulo": "Aceite Semilla De Calabaza 60 Cápsulas Sin Sabor",
        "source": ("vieja", "MLC1915004851"),
        "descripcion": desc_suplemento("Aceite de semilla de calabaza", "frasco de 60 cápsulas"),
    },
    "b12": {
        "titulo": "Complejo Vitamina B12 B6 B1 Gotas 60ml Sin Sabor",
        "source": ("nueva", "MLC4234021714"),
        "descripcion": desc_suplemento("Complejo líquido de vitaminas B12, B6 y B1", "frasco con gotero de 60 ml"),
    },
    "blood_sugar": {
        "titulo": "Blood Sugar Complex Toplux 60 Cápsulas Sin Sabor",
        "source": ("vieja", "MLC1975402915"),
        "descripcion": desc_suplemento("Blood Sugar Complex Toplux", "frasco de 60 cápsulas"),
    },
    "collagen_peptides": {
        "titulo": "Colágeno Hidrolizado Multi Peptides 453g Sin Sabor",
        "source": ("vieja", "MLC2013451463"),
        "descripcion": desc_suplemento("Colágeno hidrolizado Multi Peptides", "polvo de 453 g"),
    },
    "dr_melaxin": {
        "titulo": "Dr Melaxin Peel Shot Spray Exfoliante Ácido Kójico",
        "source": ("agustin", "MLC4324530540"),
        "descripcion": desc_externo("Dr. Melaxin Peel Shot con ácido kójico", "spray exfoliante"),
    },
    "echofree": {
        "titulo": "Echofree Gotas Suplemento Líquido Sin Sabor",
        "source": ("vieja", "MLC1949401809"),
        "descripcion": desc_suplemento("Echofree", "formato líquido con gotero"),
    },
    "floraviva_rhodiola": {
        "titulo": "Floraviva Rhodiola Rosea 60 Cápsulas Sin Sabor",
        "source": ("agustin", "MLC4324530224"),
        "gtin": "738242082712",
        "descripcion": desc_suplemento("Floraviva Rhodiola Rosea", "frasco de 60 cápsulas"),
    },
    "gomitas_feromona": {
        "titulo": "Love Gomitas Feromonas 60 Gomitas Frutos Rojos",
        "source": ("vieja", "MLC2016433471"),
        "descripcion": desc_suplemento("Love Gummies Feromonas", "frasco de 60 gomitas sabor frutos rojos"),
    },
    "joint_health": {
        "titulo": "Frzveo Joint Health Glucosamina Condroitina 60 Cápsulas",
        "source": ("nueva", "MLC2063357183"),
        "descripcion": desc_suplemento(
            "Frzveo Joint Health", "frasco de 60 cápsulas",
            "glucosamina, condroitina, MSM y cúrcuma"),
    },
    "magnesio_12en1": {
        "titulo": "Magnesio 12 En 1 Complex 720mg 60 Cápsulas Sin Sabor",
        "source": ("nueva", "MLC2107215451"),
        "descripcion": desc_suplemento("Magnesio 12 en 1 Complex 720 mg", "frasco de 60 cápsulas"),
    },
    "magnesio_complex": {
        "titulo": "Bioforce Magnesium Complex 1000mg 90 Cápsulas",
        "categoria": "MLC435304",
        "atributos": {
            "BRAND": "Bioforce+", "FLAVOR": "Sin sabor", "PACKAGING_TYPE": "Frasco",
            "SUPPLEMENT_CLASS": "Vitaminas/Multivitamínicos/Minerales",
            "SUPPLEMENT_FORMAT": "Cápsula", "SUPPLEMENT_TYPE": "Nutricional",
            "UNITS_PER_PACKAGE": "90",
        },
        "descripcion": desc_suplemento("Bioforce+ Magnesium Complex 1000 mg", "frasco de 90 cápsulas"),
    },
    "memorix": {
        "titulo": "Memorix 60 Cápsulas Suplemento Alimentario Sin Sabor",
        "source": ("nueva", "MLC4269933324"),
        "descripcion": desc_suplemento("Memorix", "frasco de 60 cápsulas"),
    },
    "menopause_probiotics": {
        "titulo": "Menopause Probiotics For Women 60 Cápsulas Sin Sabor",
        "source": ("agustin", "MLC2140672093"),
        "descripcion": desc_suplemento("Menopause Probiotics for Women", "frasco de 60 cápsulas"),
    },
    "nad_pro_max": {
        "titulo": "Nad Pro Max Coq10 Resveratrol 600mg 60 Cápsulas",
        "categoria": "MLC435304",
        "atributos": {
            "BRAND": "Hiilhealthy", "FLAVOR": "Sin sabor", "PACKAGING_TYPE": "Frasco",
            "SUPPLEMENT_CLASS": "Otros", "SUPPLEMENT_FORMAT": "Cápsula",
            "SUPPLEMENT_TYPE": "Nutricional", "UNITS_PER_PACKAGE": "60",
        },
        "descripcion": desc_suplemento(
            "NAD+ Pro Max 600 mg", "frasco de 60 cápsulas vegetales",
            "orujo de uva (resveratrol), pimienta negra, almidón de maíz y coenzima Q10"),
    },
    "oil_of_oregano": {
        "titulo": "Carlyle Organic Oil Of Oregano 59ml Gotero",
        "gtin": "840250403639",
        "categoria": "MLC435304",
        "atributos": {
            "BRAND": "Carlyle", "FLAVOR": "Sin sabor", "PACKAGING_TYPE": "Frasco",
            "SUPPLEMENT_CLASS": "Otros", "SUPPLEMENT_FORMAT": "Líquido",
            "SUPPLEMENT_TYPE": "Nutricional", "UNITS_PER_PACKAGE": "1",
        },
        "descripcion": desc_suplemento(
            "Carlyle Organic Oil of Oregano", "frasco con gotero de 59 ml",
            "producto orgánico, sin OGM y sin gluten"),
    },
    "perfume_feromonas": {
        "titulo": "Perfume Hombre Feromonas Herosence 50ml Eau De Parfum",
        "source": ("nueva", "MLC4270447684"),
        "descripcion": desc_externo("Herosence Eau de Parfum", "frasco de 50 ml"),
    },
    "rejuvia": {
        "titulo": "Rejuvia 30 Cápsulas Suplemento Alimentario Sin Sabor",
        "source": ("nueva", "MLC4270447520"),
        "descripcion": desc_suplemento("Rejuvia", "frasco de 30 cápsulas"),
    },
    "rosetimes": {
        "titulo": "Rosetimes Bálsamo Facial Hidratante En Barra 8g",
        "source": ("nueva", "MLC4304110850"),
        "descripcion": desc_externo("Rosetimes bálsamo facial hidratante", "barra de 8 g"),
    },
    "zooone": {
        "titulo": "Zooone Luteína Zinc Vitaminas C E 60 Cápsulas",
        "source": ("vieja", "MLC3922954440"),
        "descripcion": desc_suplemento("Zooone con luteína, zinc y vitaminas C y E", "frasco de 60 cápsulas"),
    },
}


def leer_json(ruta: Path, default):
    if not ruta.exists():
        return default
    with ruta.open(encoding="utf-8") as archivo:
        return json.load(archivo)


def guardar_json(ruta: Path, contenido) -> None:
    with ruta.open("w", encoding="utf-8") as archivo:
        json.dump(contenido, archivo, ensure_ascii=False, indent=2)


def inventario_erp() -> dict[str, dict]:
    """Lee clave, unidades y costo directo de ps_productos (REST), sin
    pasar por el repo `steve` — es la única fuente de verdad del stock."""
    if not FOTOS_URL or not FOTOS_KEY:
        raise RuntimeError("Faltan PLANETA_SUPABASE_URL/PLANETA_SUPABASE_KEY")
    req = urllib.request.Request(
        FOTOS_URL + "/rest/v1/ps_productos?select=clave,unidades,costo",
        headers={"apikey": FOTOS_KEY, "Authorization": "Bearer " + FOTOS_KEY},
    )
    with urllib.request.urlopen(req, timeout=30) as respuesta:
        filas = json.loads(respuesta.read().decode("utf-8"))
    return {
        fila["clave"]: {
            "unidades": int(fila.get("unidades") or 0),
            "costo": float(fila["costo"]) if fila.get("costo") is not None else None,
        }
        for fila in filas
        if fila.get("clave")
    }


def fotos_producto(cuenta: str, producto: str, tmp: Path) -> list[Path]:
    """Baja del bucket privado `ml-fotos` a un directorio temporal."""
    req = urllib.request.Request(
        f"{FOTOS_URL}/storage/v1/object/list/ml-fotos",
        method="POST",
        data=json.dumps({"prefix": f"{cuenta}/{producto}/"}).encode(),
        headers={"apikey": FOTOS_KEY, "Authorization": "Bearer " + FOTOS_KEY,
                 "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        listado = json.loads(resp.read().decode("utf-8"))
    nombres = sorted(f["name"] for f in listado if f.get("name", "").lower().endswith(".jpg"))
    if len(nombres) < 4:
        raise RuntimeError(f"{cuenta}/{producto}: solo hay {len(nombres)} fotos en el bucket")
    destino = tmp / cuenta / producto
    destino.mkdir(parents=True, exist_ok=True)
    rutas = []
    for nombre in nombres:
        req = urllib.request.Request(
            f"{FOTOS_URL}/storage/v1/object/ml-fotos/{cuenta}/{producto}/{nombre}",
            headers={"apikey": FOTOS_KEY, "Authorization": "Bearer " + FOTOS_KEY},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            datos = resp.read()
        ruta = destino / nombre
        ruta.write_bytes(datos)
        rutas.append(ruta)
    return rutas


def _multipart(ruta: Path) -> tuple[bytes, str]:
    frontera = uuid.uuid4().hex
    ctype = mimetypes.guess_type(ruta.name)[0] or "image/jpeg"
    contenido = ruta.read_bytes()
    cuerpo = b"".join([
        f"--{frontera}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{ruta.name}"\r\n'.encode(),
        f"Content-Type: {ctype}\r\n\r\n".encode(),
        contenido,
        f"\r\n--{frontera}--\r\n".encode(),
    ])
    return cuerpo, f"multipart/form-data; boundary={frontera}"


def subir_foto(cfg: dict, cuenta: str, ruta: Path, reintento: bool = False) -> str:
    cuerpo, ctype = _multipart(ruta)
    token = cfg["accounts"][cuenta]["access_token"]
    req = urllib.request.Request(
        UPLOAD_URL, data=cuerpo, method="POST",
        headers={"Authorization": "Bearer " + token, "Content-Type": ctype},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as respuesta:
            return json.loads(respuesta.read().decode("utf-8"))["id"]
    except urllib.error.HTTPError as exc:
        if exc.code == 401 and not reintento:
            mlauth.refresh_token(cfg, cuenta)
            return subir_foto(cfg, cuenta, ruta, reintento=True)
        detalle = exc.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"Error subiendo {ruta.name} a {cuenta}: HTTP {exc.code} {detalle}")


def items_activos(cfg: dict, cuenta: str) -> list[dict]:
    uid = cfg["accounts"][cuenta]["user_id"]
    ids: list[str] = []
    scroll = None
    while True:
        params = {"search_type": "scan", "status": "active", "limit": 100}
        if scroll:
            params["scroll_id"] = scroll
        estado, resp = mlauth.api(cfg, cuenta, "GET", f"/users/{uid}/items/search", params=params)
        if estado != 200:
            break
        ids.extend(resp.get("results", []))
        scroll = resp.get("scroll_id")
        if not scroll or not resp.get("results"):
            break
    items = []
    for i in range(0, len(ids), 20):
        lote = ids[i:i + 20]
        estado, resp = mlauth.api(cfg, cuenta, "GET", "/items", params={"ids": ",".join(lote)})
        if estado != 200:
            continue
        for fila in resp:
            if fila.get("code") == 200 and fila.get("body"):
                items.append(fila["body"])
    return items


def validacion_bloqueante(status: int, respuesta) -> bool:
    if status in (200, 204):
        return False
    if not isinstance(respuesta, dict):
        return True
    for causa in respuesta.get("cause", []) or []:
        if causa.get("type") == "error":
            return True
    return status >= 400


def attrs_desde_fuente(cfg: dict, cuenta: str, item_id: str) -> tuple[str, list[dict], str]:
    estado, item = mlauth.api(cfg, cuenta, "GET", f"/items/{item_id}")
    if estado != 200:
        raise RuntimeError(f"No se pudo leer fuente {cuenta}/{item_id}: HTTP {estado}")
    excluir = {
        "HAZMAT_TRANSPORTABILITY", "IS_HIGHLIGHT_BRAND", "IS_TOM_BRAND",
        "SELLER_PACKAGE_HEIGHT", "SELLER_PACKAGE_LENGTH",
        "SELLER_PACKAGE_WEIGHT", "SELLER_PACKAGE_WIDTH",
    }
    attrs = []
    for atributo in item.get("attributes") or []:
        if atributo.get("id") in excluir:
            continue
        valor = {"id": atributo["id"]}
        if atributo.get("value_id") is not None:
            valor["value_id"] = atributo["value_id"]
            if atributo.get("value_name") is not None:
                valor["value_name"] = atributo["value_name"]
        elif atributo.get("value_name") is not None:
            valor["value_name"] = atributo["value_name"]
        else:
            continue
        attrs.append(valor)
    por_id = {a["id"]: a for a in attrs}
    por_id["ITEM_CONDITION"] = {"id": "ITEM_CONDITION", "value_name": "Nuevo"}
    por_id["SALE_FORMAT"] = {"id": "SALE_FORMAT", "value_name": "Unidad"}
    por_id["UNITS_PER_PACK"] = {"id": "UNITS_PER_PACK", "value_name": "1"}
    fotos = item.get("pictures") or []
    if not fotos:
        raise RuntimeError(f"La fuente {cuenta}/{item_id} no tiene foto de validación")
    return item["category_id"], list(por_id.values()), fotos[0]["id"]


def completar_specs(cfg: dict) -> dict:
    salida = {}
    for clave, original in PRODUCTOS.items():
        datos = dict(original)
        if datos.get("source"):
            (datos["categoria"], datos["atributos_lista"],
             datos["foto_validacion"]) = attrs_desde_fuente(
                cfg, datos["source"][0], datos["source"][1])
        else:
            valores = dict(datos["atributos"])
            valores.update({"ITEM_CONDITION": "Nuevo", "SALE_FORMAT": "Unidad", "UNITS_PER_PACK": "1"})
            datos["atributos_lista"] = [
                {"id": atributo, "value_name": valor} for atributo, valor in valores.items()]
            datos["foto_validacion"] = "613499-MLC115356518917_072026"
        if datos.get("gtin"):
            por_id = {a["id"]: a for a in datos["atributos_lista"]}
            por_id["GTIN"] = {"id": "GTIN", "value_name": datos["gtin"]}
            por_id.pop("EMPTY_GTIN_REASON", None)
            datos["atributos_lista"] = list(por_id.values())
        salida[clave] = datos
    return salida


def payload(datos: dict, precio: int, stock: int, picture_ids: list[str]) -> dict:
    return {
        "family_name": datos["titulo"], "category_id": datos["categoria"],
        "price": precio, "currency_id": "CLP", "available_quantity": stock,
        "buying_mode": "buy_it_now", "listing_type_id": "gold_pro",
        "condition": "new",
        "shipping": {"mode": "me2", "local_pick_up": False, "free_shipping": True},
        "pictures": [{"id": foto} for foto in picture_ids],
        "attributes": datos["atributos_lista"],
    }


def publicados_hoy(estado: dict, fecha: str) -> int:
    return sum(1 for fila in estado.values() if fila.get("fecha") == fecha and fila.get("item_id"))


LOTE_APROBADO = BASE / "lote_aprobado.json"


def candidatos(cfg: dict, specs: dict, inventario: dict) -> list[dict]:
    """SOLO trabaja sobre los pares (cuenta, producto) que ya pasaron el
    dry-run local del 22-ago-2026 (`lote_aprobado.json`, 36 pares).

    A propósito NO relee el catálogo completo para "descubrir" qué falta:
    la primera versión de este script sí lo hacía con un matcher de alias
    simplificado (substring), y en la primera corrida de prueba encontró
    43 pendientes en vez de 36 — un candidato nuevo (`vieja:collagen_peptides`)
    que el matcher real (`shared.inventario`, solo disponible en el PC de
    Joaquín) nunca había validado. Publicar sobre una cola que el matcher
    aproximado arma solo es exactamente el tipo de error que ya causó una
    suspensión antes. Si algún día hay que sumar productos nuevos al lote,
    se valida el alias a mano contra `shared.inventario` y se agrega acá,
    no se deja que este script decida solo qué está "cubierto"."""
    if not LOTE_APROBADO.exists():
        raise RuntimeError(f"Falta {LOTE_APROBADO} — no hay lote aprobado que publicar")
    pares = json.loads(LOTE_APROBADO.read_text(encoding="utf-8"))
    cola = []
    for cuenta, clave in pares:
        if clave in PROHIBIDOS:
            continue
        datos = specs.get(clave)
        fila = inventario.get(clave)
        if not datos or not fila or fila["unidades"] <= 0 or fila["costo"] is None:
            continue
        base = calcular_producto(fila["costo"], 1)["precio"]
        precio = precio_agustin(base) if cuenta == "agustin" else base
        cola.append({
            "cuenta": cuenta, "producto": clave, "datos": datos,
            "stock": fila["unidades"], "costo": fila["costo"], "precio": precio,
        })
    semilla = dt.date.today().isoformat() + "-planeta-shop"
    random.Random(semilla).shuffle(cola)
    return cola


def registrar_historial(entrada: dict) -> None:
    with LOG.open("a", encoding="utf-8") as archivo:
        archivo.write(json.dumps(entrada, ensure_ascii=False) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--ejecutar", action="store_true")
    parser.add_argument("--limite", type=int, default=8)
    parser.add_argument("--max-diario", type=int, default=8)
    parser.add_argument("--min-espera", type=int, default=480)
    parser.add_argument("--max-espera", type=int, default=1080)
    args = parser.parse_args()
    if args.ejecutar and args.dry_run:
        raise SystemExit("Usa --dry-run o --ejecutar, no ambos")
    ejecutar = args.ejecutar

    cfg = mlauth.load_config()
    specs = completar_specs(cfg)
    inventario = inventario_erp()
    estado = leer_json(ESTADO, {})
    fecha = dt.date.today().isoformat()
    disponibles_hoy = max(0, args.max_diario - publicados_hoy(estado, fecha))
    limite = min(args.limite, disponibles_hoy) if ejecutar else args.limite
    cola = candidatos(cfg, specs, inventario)
    plan = cola[:limite]
    reporte = {
        "fecha": fecha, "modo": "ejecutar" if ejecutar else "dry-run",
        "publicados_hoy_antes": publicados_hoy(estado, fecha),
        "max_diario": args.max_diario, "pendientes_totales": len(cola),
        "seleccionados": [], "exclusiones": PROHIBIDOS,
    }

    import tempfile
    with tempfile.TemporaryDirectory(prefix="planeta_fotos_") as tmp_str:
        tmp = Path(tmp_str)
        for indice, entrada in enumerate(plan, 1):
            cuenta, clave, datos = entrada["cuenta"], entrada["producto"], entrada["datos"]
            registro = f"{cuenta}:{clave}"
            if registro in estado and estado[registro].get("item_id"):
                continue
            fila_reporte = {
                "cuenta": cuenta, "producto": clave, "titulo": datos["titulo"],
                "stock": entrada["stock"], "costo": entrada["costo"],
                "precio": entrada["precio"],
                "utilidad": round(utilidad(entrada["precio"], entrada["costo"])),
                "publicado": False,
            }
            reporte["seleccionados"].append(fila_reporte)
            print(f"[{indice}/{len(plan)}] {registro} · stock {entrada['stock']} · ${entrada['precio']:,}")
            if not ejecutar:
                cuerpo_prueba = payload(datos, entrada["precio"], entrada["stock"], [datos["foto_validacion"]])
                estado_v, respuesta_v = mlauth.api(cfg, cuenta, "POST", "/items/validate", body=cuerpo_prueba)
                fila_reporte.update({
                    "validacion_http": estado_v,
                    "validacion_bloqueante": validacion_bloqueante(estado_v, respuesta_v),
                    "validaciones": respuesta_v.get("cause", []) if isinstance(respuesta_v, dict) else [],
                })
                continue

            vivo = inventario_erp().get(clave) or {}
            if int(vivo.get("unidades") or 0) <= 0 or vivo.get("costo") is None:
                fila_reporte["error"] = "stock/costo dejó de estar disponible"
                registrar_historial(fila_reporte)
                continue

            try:
                fotos = fotos_producto(cuenta, clave, tmp)
            except Exception as e:
                fila_reporte["error"] = f"fotos: {e}"
                registrar_historial(fila_reporte)
                continue

            picture_ids = [subir_foto(cfg, cuenta, ruta) for ruta in fotos]
            cuerpo = payload(datos, entrada["precio"], int(vivo["unidades"]), picture_ids)
            estado_v, respuesta_v = mlauth.api(cfg, cuenta, "POST", "/items/validate", body=cuerpo)
            if validacion_bloqueante(estado_v, respuesta_v):
                fila_reporte.update({"error": "validación bloqueante", "validacion": respuesta_v})
                registrar_historial(fila_reporte)
                continue

            estado_post, respuesta_post = mlauth.api(cfg, cuenta, "POST", "/items", body=cuerpo)
            if estado_post not in (200, 201):
                fila_reporte.update({"error": f"POST HTTP {estado_post}", "respuesta": respuesta_post})
                registrar_historial(fila_reporte)
                continue

            item_id = respuesta_post["id"]
            estado_desc, _ = mlauth.api(cfg, cuenta, "POST", f"/items/{item_id}/description",
                                         body={"plain_text": datos["descripcion"]})
            estado[registro] = {
                "item_id": item_id, "fecha": fecha, "titulo": datos["titulo"],
                "precio": entrada["precio"], "stock_inicial": int(vivo["unidades"]),
                "descripcion_http": estado_desc,
            }
            guardar_json(ESTADO, estado)
            fila_reporte.update({"publicado": True, "item_id": item_id,
                                 "permalink": respuesta_post.get("permalink")})
            registrar_historial(fila_reporte)
            print(f"    PUBLICADO {item_id}")
            if indice < len(plan):
                espera = random.randint(args.min_espera, args.max_espera)
                print(f"    próxima publicación en {espera // 60}m {espera % 60}s")
                time.sleep(espera)

    guardar_json(REPORTE, reporte)
    print(f"\nPendientes antes del lote: {len(cola)} · seleccionados: {len(plan)}")
    if ejecutar and not plan:
        print("El límite diario ya se alcanzó o no quedan publicaciones permitidas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
