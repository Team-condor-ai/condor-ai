"""Planeta Shop · radiografía de las 3 cuentas de MercadoLibre.

Responde, con datos de la API y no de memoria: qué hay publicado en cada
cuenta, qué se subió del lote, qué está en riesgo y qué falta hacer.

    python analisis.py            # informe en pantalla
    python analisis.py --json     # el mismo informe como JSON

Sólo LEE. No publica, no pausa, no cambia precios: es un informe y tiene que
poder correrse sin pensarlo dos veces.
"""
import argparse
import json
from collections import defaultdict
from pathlib import Path

import mlauth
from publicar_lote import (
    PROHIBIDOS, PRODUCTOS, inventario_erp, precio_agustin, calcular_producto,
)

BASE = Path(__file__).resolve().parent
ESTADO = BASE / "publicaciones_programadas.json"
LOTE = BASE / "lote_aprobado.json"

# Debajo de esto una publicación se queda sin stock en pocos días y conviene
# reponer o pausar antes de que ML la penalice por cancelaciones.
STOCK_CRITICO = 2


def leer(ruta, defecto):
    try:
        return json.loads(ruta.read_text(encoding="utf-8"))
    except Exception:
        return defecto


def items_de_cuenta(cfg, cuenta):
    """Todos los ítems de la cuenta, con su estado real, paginando."""
    estado, quien = mlauth.api(cfg, cuenta, "GET", "/users/me")
    if estado != 200:
        return None, f"no se pudo leer la cuenta (HTTP {estado})"

    user_id = quien["id"]
    ids, offset = [], 0
    while True:
        st, r = mlauth.api(
            cfg, cuenta, "GET", f"/users/{user_id}/items/search",
            params={"limit": 100, "offset": offset},
        )
        if st != 200:
            break
        lote = r.get("results") or []
        ids.extend(lote)
        offset += len(lote)
        # `total` puede venir capado por la API; se corta cuando deja de traer.
        if not lote or offset >= (r.get("paging", {}).get("total") or 0):
            break

    detalles = []
    for i in range(0, len(ids), 20):
        st, r = mlauth.api(cfg, cuenta, "GET", "/items",
                           params={"ids": ",".join(ids[i:i + 20])})
        if st != 200:
            continue
        for fila in r:
            cuerpo = fila.get("body") or {}
            if cuerpo.get("id"):
                detalles.append(cuerpo)
    return {"user_id": user_id, "nickname": quien.get("nickname"), "items": detalles}, None


def analizar():
    cfg = mlauth.load_config()
    estado_pub = leer(ESTADO, {})
    lote = leer(LOTE, [])
    inventario = inventario_erp()

    informe = {"cuentas": {}, "alertas": [], "lote": {}, "excluidos": PROHIBIDOS}

    # ── Avance del lote ────────────────────────────────────────────────────
    hechos = [f"{c}:{p}" for c, p in lote if f"{c}:{p}" in estado_pub]
    informe["lote"] = {
        "aprobados": len(lote),
        "publicados": len(hechos),
        "pendientes": len(lote) - len(hechos),
        "faltantes": [f"{c}:{p}" for c, p in lote if f"{c}:{p}" not in estado_pub],
    }

    # ── Cuenta por cuenta, contra la API ───────────────────────────────────
    for cuenta in sorted({c for c, _ in lote} | set(cfg.get("accounts", {}))):
        datos, error = items_de_cuenta(cfg, cuenta)
        if error:
            informe["cuentas"][cuenta] = {"error": error}
            informe["alertas"].append({"nivel": "alto", "cuenta": cuenta, "que": error})
            continue

        activos = [i for i in datos["items"] if i.get("status") == "active"]
        pausados = [i for i in datos["items"] if i.get("status") == "paused"]
        cerrados = [i for i in datos["items"] if i.get("status") == "closed"]
        sin_stock = [i for i in activos if (i.get("available_quantity") or 0) <= 0]
        poco_stock = [i for i in activos
                      if 0 < (i.get("available_quantity") or 0) <= STOCK_CRITICO]

        informe["cuentas"][cuenta] = {
            "nickname": datos["nickname"],
            "total": len(datos["items"]),
            "activos": len(activos),
            "pausados": len(pausados),
            "cerrados": len(cerrados),
            "sin_stock": len(sin_stock),
            "stock_critico": len(poco_stock),
        }

        # ALERTA: activo con 0 disponible. Es lo que termina en cancelación, y
        # la tasa de cancelación es de lo que más castiga ML.
        for i in sin_stock:
            informe["alertas"].append({
                "nivel": "alto", "cuenta": cuenta, "item": i["id"],
                "que": f"ACTIVO sin stock: {i.get('title','')[:60]}",
            })
        for i in poco_stock:
            informe["alertas"].append({
                "nivel": "medio", "cuenta": cuenta, "item": i["id"],
                "que": f"quedan {i['available_quantity']}: {i.get('title','')[:55]}",
            })

    # ── Publicaciones del lote que el ERP ya no puede sostener ─────────────
    for registro, info in estado_pub.items():
        cuenta, clave = registro.split(":", 1)
        fila = inventario.get(clave)
        if not fila:
            informe["alertas"].append({
                "nivel": "medio", "cuenta": cuenta,
                "que": f"{clave}: publicado pero el ERP ya no lo tiene",
            })
            continue
        if (fila.get("unidades") or 0) <= 0:
            informe["alertas"].append({
                "nivel": "alto", "cuenta": cuenta, "item": info.get("item_id"),
                "que": f"{clave}: publicado y el ERP marca 0 unidades",
            })
            continue

        # ¿El precio publicado quedó por debajo del que corresponde hoy?
        costo = fila.get("costo")
        if costo is None or not info.get("precio"):
            continue
        base = calcular_producto(costo, 1)["precio"]
        debido = precio_agustin(base) if cuenta == "agustin" else base
        if info["precio"] < debido * 0.93:
            informe["alertas"].append({
                "nivel": "medio", "cuenta": cuenta, "item": info.get("item_id"),
                "que": (f"{clave}: publicado a ${info['precio']:,} y hoy correspondería "
                        f"${debido:,} (subió el costo)"),
            })

    return informe


def imprimir(inf):
    L = inf["lote"]
    print("\n" + "=" * 62)
    print("  PLANETA SHOP · RADIOGRAFÍA DE CUENTAS")
    print("=" * 62)

    print(f"\nLOTE APROBADO: {L['publicados']}/{L['aprobados']} publicados "
          f"· {L['pendientes']} pendientes")
    if L["faltantes"]:
        print("  faltan: " + ", ".join(L["faltantes"][:12])
              + (f" … y {len(L['faltantes']) - 12} más" if len(L["faltantes"]) > 12 else ""))

    print("\nCUENTAS")
    for cuenta, d in inf["cuentas"].items():
        if d.get("error"):
            print(f"  {cuenta:<10} ⚠️  {d['error']}")
            continue
        print(f"  {cuenta:<10} {d['nickname'] or '':<18} "
              f"total {d['total']:>3} · activos {d['activos']:>3} · "
              f"pausados {d['pausados']:>3} · cerrados {d['cerrados']:>3}")
        if d["sin_stock"] or d["stock_critico"]:
            print(f"  {'':<10} └─ sin stock: {d['sin_stock']} · "
                  f"stock crítico (≤{STOCK_CRITICO}): {d['stock_critico']}")

    altas = [a for a in inf["alertas"] if a["nivel"] == "alto"]
    medias = [a for a in inf["alertas"] if a["nivel"] == "medio"]

    print(f"\nALERTAS: {len(altas)} altas · {len(medias)} medias")
    for a in altas[:20]:
        print(f"  🔴 [{a['cuenta']}] {a['que']}")
    for a in medias[:20]:
        print(f"  🟡 [{a['cuenta']}] {a['que']}")
    if len(altas) > 20 or len(medias) > 20:
        print("  … (usa --json para verlas todas)")

    print(f"\nEXCLUIDOS POR RIESGO DE INFRACCIÓN: {len(inf['excluidos'])}")
    for clave, motivo in inf["excluidos"].items():
        print(f"  · {clave}: {motivo}")
    print("=" * 62 + "\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    inf = analizar()
    if args.json:
        print(json.dumps(inf, ensure_ascii=False, indent=2))
    else:
        imprimir(inf)
