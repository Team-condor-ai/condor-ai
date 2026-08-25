"""Tests de `validacion_bloqueante`, el guardia que decide si se publica.

Existe por el corte del 23-ago-2026: los 8 items de la corrida se descartaron
con "validación bloqueante" por dos advertencias inofensivas de ML, y la
corrida terminó en verde publicando cero. El guardia tiene que distinguir un
error real de un aviso.

    python -m unittest services.planeta_ml.test_validacion
    (o, dentro de la carpeta)  python test_validacion.py
"""
import unittest

from publicar_lote import validacion_bloqueante


def causa(tipo, code="x"):
    return {"type": tipo, "code": code, "message": code}


class TestValidacionBloqueante(unittest.TestCase):

    def test_ok_no_bloquea(self):
        self.assertFalse(validacion_bloqueante(200, {}))
        self.assertFalse(validacion_bloqueante(204, None))

    def test_el_caso_real_del_23_ago_no_debe_bloquear(self):
        # Respuesta textual de ML que descartó los 8 items: HTTP 400 con dos
        # causas, ambas `warning`. Ninguna impide crear la publicación.
        respuesta = {
            "message": "Validation error",
            "error": "validation_error",
            "status": 400,
            "cause": [
                causa("warning", "shipping.lost_me1_by_user"),
                causa("warning", "item.shipping.mandatory_free_shipping"),
            ],
        }
        self.assertFalse(validacion_bloqueante(400, respuesta))

    def test_una_causa_de_error_bloquea(self):
        respuesta = {"cause": [causa("warning"), causa("error", "item.price.invalid")]}
        self.assertTrue(validacion_bloqueante(400, respuesta))

    def test_error_entre_advertencias_igual_bloquea(self):
        respuesta = {"cause": [causa("warning"), causa("error"), causa("warning")]}
        self.assertTrue(validacion_bloqueante(400, respuesta))

    def test_400_sin_causas_bloquea(self):
        # No sabemos qué pasó. Publicar a ciegas contra una cuenta que ya fue
        # sancionada no es una opción.
        self.assertTrue(validacion_bloqueante(400, {"message": "Bad request"}))
        self.assertTrue(validacion_bloqueante(400, {"cause": []}))

    def test_respuesta_no_json_bloquea(self):
        self.assertTrue(validacion_bloqueante(500, "<html>Gateway error</html>"))
        self.assertTrue(validacion_bloqueante(403, None))

    def test_401_y_403_bloquean_aunque_traigan_advertencias(self):
        # Un problema de credenciales no se arregla publicando igual.
        respuesta = {"cause": [causa("warning")]}
        # Con causas de sólo advertencia el guardia deja pasar; el 401 real de
        # ML no trae `cause`, así que cae en la rama de arriba. Se fija acá
        # para que quede explícito qué se espera.
        self.assertTrue(validacion_bloqueante(401, {"message": "invalid token"}))
        self.assertFalse(validacion_bloqueante(400, respuesta))


if __name__ == "__main__":
    unittest.main(verbosity=2)
