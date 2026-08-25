# -*- coding: utf-8 -*-
"""
Calculadora de precios.

Fórmula del negocio (definida por Joaquín):

    utilidad = P − 17%·P − 19%·P − costo·unidades − envío

Los porcentajes se descuentan del PRECIO FINAL. La comisión de 17% está
confirmada contra la API de ML (`/sites/MLC/listing_prices`): es 17% exacto y
sin cargo fijo para gold_pro en estas categorías.

El envío de $3.500 lo paga SIEMPRE el vendedor, en todos los tramos de precio
y en todos los packs — el "envío gratis" es gratis para el comprador, no para
la cuenta.

Reglas duras:
  · precio termina en 490 o 990
  · ningún precio bajo $21.000
  · utilidad mínima $5.500 (packs cruzados apuntan a $6.500)

REGLA AGUSTÍN (definida por Joaquín, 21-ago-2026)
------------------------------------------------------------------------------
La cuenta `agustin` no paga IVA, pero eso NO se traslada al comprador como
descuento. Al revés: sus publicaciones van ~7% MÁS CARAS que las mismas de
`nueva`, redondeado al 490/990 siguiente. Es una decisión de negocio
explícita, no algo que se infiere de la fórmula base — por eso vive acá
como función aparte (`precio_agustin`) en vez de un parámetro más de
`precio_para`.
"""
import math

COMISION = 0.17
IVA = 0.19
ENVIO = 3500
PISO = 21000
UTIL_MIN_PRODUCTO = 5500
UTIL_MIN_PACK = 6500

# Ver "REGLA AGUSTÍN" arriba.
MULTIPLICADOR_AGUSTIN = 1.07

# Lo que queda del precio tras comisión e IVA.
NETO = 1 - COMISION - IVA  # 0.64


def utilidad(precio: float, costo_total: float) -> float:
    return precio - COMISION * precio - IVA * precio - costo_total - ENVIO


def redondear(precio: float) -> int:
    """Sube al siguiente valor terminado en 490 o 990. Nunca baja: bajar
    rompería el piso de utilidad."""
    base = math.floor(precio / 1000) * 1000
    for cand in (base + 490, base + 990):
        if cand >= precio:
            return cand
    # si 490 y 990 del tramo quedaron cortos, saltar al siguiente millar
    return base + 1490 if base + 1490 >= precio else redondear(base + 1000)


def precio_para(costo_total: float, util_objetivo: float) -> int:
    """Precio mínimo que deja `util_objetivo`, respetando piso y redondeo."""
    bruto = (util_objetivo + costo_total + ENVIO) / NETO
    return redondear(max(bruto, PISO))


def calcular_producto(costo_unitario: float, unidades: int) -> dict:
    costo = costo_unitario * unidades
    p = precio_para(costo, UTIL_MIN_PRODUCTO)
    return {"precio": p, "costo": costo, "utilidad": round(utilidad(p, costo))}


def calcular_pack(costos: list[float]) -> dict:
    costo = sum(costos)
    p = precio_para(costo, UTIL_MIN_PACK)
    return {"precio": p, "costo": costo, "utilidad": round(utilidad(p, costo))}


def precio_agustin(precio_nueva: int) -> int:
    """El precio de `agustin` para el MISMO producto/pack publicado en
    `nueva`. Ver "REGLA AGUSTÍN" arriba: ~7% más caro, redondeado hacia
    arriba al 490/990 siguiente -- nunca queda igual ni más barato."""
    return redondear(precio_nueva * MULTIPLICADOR_AGUSTIN)


def precio_suelto_equivalente(costos: list[float]) -> int:
    """Cuánto pagaría el cliente comprando cada producto por separado.
    Sirve para el gancho de 'ahorras $X' en la descripción del pack."""
    return sum(precio_para(c, UTIL_MIN_PRODUCTO) for c in costos)
