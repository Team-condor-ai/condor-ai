# Cóndor en tu Claude

Conecta tu Claude al portal de Cóndor: puede leer las reuniones (con sus
notas) y la biblioteca, y escribir en ellas. Lo que guarda uno lo lee el
Claude de todo el equipo.

## Instalar (una vez, 2 minutos)

Necesitas **Node 18 o más nuevo**. Para saber si lo tienes: `node --version`.

1. Entra al portal, módulo **MCP / CLI**. Ahí está tu token personal y el
   comando ya armado con él.
2. Baja el zip desde ese mismo módulo y descomprímelo.
3. Dentro de la carpeta: `npm install`
4. Copia el comando del módulo y pégalo en tu terminal, cambiando `RUTA` por
   dónde dejaste la carpeta.

Para comprobar que quedó: `claude mcp list` — tiene que decir `condor ✔ Connected`.

## Cómo se usa

- *"Anota que en la reunión con X quedamos en…"*
- *"¿Qué reuniones tengo esta semana?"*
- *"¿Qué se habló con Fintoc la última vez?"*
- *"Guarda este documento en la biblioteca, carpeta Legal"*

Al conectarse, tu Claude ya sabe qué reuniones hay y qué hay en la biblioteca.

## Lo que puede hacer

| Herramienta | Para qué |
|---|---|
| `panorama` | Ver todo el contexto: reuniones y biblioteca |
| `buscar` | Buscar entre reuniones y documentos |
| `reuniones` | Listar próximas / pasadas / todas |
| `crear_reunion` | Agendar |
| `anotar_reunion` | Guardar el resumen de una reunión — el contexto real |
| `leer_documento` | Leer un documento de texto de la biblioteca |
| `guardar_documento` | Escribir en la biblioteca |
| `crear_carpeta` | Ordenar |

**No puede borrar nada.** Es memoria compartida: si un Claude se equivoca
borrando, el equipo pierde algo que quizás nadie más tenía. Para borrar se
entra al portal, que además pide confirmación.

## Si algo falla

- `Falta CONDOR_TOKEN` → faltó el `--env CONDOR_TOKEN=…` al instalar.
- `Token incorrecto` → lo rotaste; saca el nuevo del módulo MCP / CLI.
