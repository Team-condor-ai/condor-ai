# Guion visual condor.ai — contexto de trabajo

Bitácora de decisiones para retomar el guion visual otro día (o en otro PC).
Última sesión: **1 de octubre de 2026** · Persona: Max · Agente: Claude.

- **Rama:** `max/guion-visual-v1` (sin PR; no integrar a `main` sin el OK de Max)
- **Carpeta:** `apps/guion-visual/` (sitio estático, sin build)
- **Ver en local:** `cd apps/guion-visual && npm run dev` → http://127.0.0.1:5320
- **Regenerar la marca:** `npm install` (una vez) y `npm run marca`
- **Versión publicada (privada):** https://claude.ai/artifact/UnRJ4pWqsS25vAN3DhrEVZ
  Se publica una copia de `index.html` sin `<html>/<head>/<body>`, con los CSS, JS, fuentes y SVG como archivos aparte.

---

## 1. El encargo

Hacer un guion visual completo para condorai.cl, partiendo de lo que hay hoy,
que sirva de base para renovar **el sitio** y **el CRM / Portal Cóndor**. Incluye:
carga del logo, logo en distintos colores, motion e innovación. Además:

- Logo de **un solo color**: azul, negro, blanco, gradientes de azul y variaciones especiales (gradientes rosados, etc.).
- Mejorar y **unificar el branding de los productos** e integrar **Medula** como producto.
- condor.ai apunta a **Silicon Valley**: una empresa que desarrolla tecnología del futuro (Medula y proyectos que vienen).
- Estética **tipo Apple**: simple, premium, tipografía inspirada en Apple, **interfaces acrílicas**.

## 2. Cómo llegamos aquí (qué se probó y qué se rechazó)

| Versión | Qué era | Veredicto de Max |
|---|---|---|
| V1 "Acrílico Andino" (commit `39cd827`) | Vertido de pintura acrílica generado en WebGL, cóndor original con corte, Clash Display, altímetro | ❌ "No me gustó casi nada". No quiere texturas de vertido. |
| Visión "Claro", 1.ª parte (commit `bd5b355`) | Cóndor **nuevo** visto desde abajo (plumas dedo, cabeza con collar), cóndor 3D de acrílico en three.js, wordmark en Inter Tight | ❌ El logo nuevo no va: la idea era **innovar sobre el logo existente**, no reemplazarlo. ❌ Nada de 3D: "Condor es más plano que Medula". ❌ El wordmark no debe ser una tipografía. |
| Visión "Claro", actual (commit `f3c0d1e`) | Cóndor original refinado, letras propias en SVG, todo plano, acrílico solo en interfaces | ⏳ Pendiente de su opinión. |

**No volver a proponer:** texturas o vertidos, un pájaro distinto, el logo en 3D ni un wordmark tipográfico.

## 3. Decisiones vigentes

### Isotipo: el cóndor de siempre, refinado
- Base: el redibujo fiel del logo original (perfil, 30 vértices, grilla 275×248), vectorizado desde el PNG tricolor `assets/antes/logo-v2.png`.
- Todos los vértices suavizados (radio 9 en la escala ×4) y en un color.
- **Tres propuestas** (selector en la sección "El cóndor"):
  - **Pulido**: la silueta limpia.
  - **Corte ★ (principal)**: la franja de luz del original pasa a ser un corte que separa ala y cuerpo.
  - **Corte + ojo**: suma un ojo como nodo, el mismo recurso del punto de Medula.
- Los archivos están en `assets/marca/condor-isotipo*.svg`. El "isotipo" a secas es el Corte.

### Wordmark: letras propias, sin tipografía
- "condor.ai" construido con geometría: alto de x 100, círculos de radio 50 (interior 28), trazo 22 y ascendente 46.
- El corte de la **c** y el remate de la **d** siguen el **ángulo del ala, 30,7°**.
- Los puntos de **.ai** y de la **i** son círculos perfectos de radio 13 (nodos).
- La **a** es de un piso. La **r** termina su hombro a 300°.
- Son trazos, así que se **escriben solas** (clase `.letras-vivas` en `guion.js`): en el inicio, en la carga "Escritura" y en el plano de construcción.
- Fuente de verdad: `LETRAS` y `AIRE` (espacio entre pares) en `herramientas/generar-marca.mjs`.

### Color (`tokens/condor.css`)
- Base neutra: blanco, niebla `#F3F4F7` y grafito `#0B0C12`.
- Un solo color de marca: **Azul Cóndor `#3A5CFF`**.
- Gradientes, cada uno usado como un solo color: Ionosfera (azul), Aurora (rosado-lila) y Hielo. Prisma solo en el canto del acrílico.
- Cada producto tiene su tono: Sites `#3A5CFF`, Ecommerce `#7B5CFF`, Media `#FF4F8B`, Track `#10C2A2`, Agents `#FF8A3D`, Barbara `#D14BFF`, Medula `#0853E0`.
- Claro y oscuro con `prefers-color-scheme` o `data-theme`; `.cn-claro` y `.cn-oscuro` fuerzan un bloque.

### Tipografía (interfaz y textos, **no** el logo)
Inter Tight para titulares, Inter para texto y Geist Mono para datos y rótulos (la misma familia mono de Medula). Las fuentes están en `assets/fuentes/` en woff2.

### Material y motion
- **Plano.** El acrílico vive solo en las interfaces: lámina translúcida con desenfoque y canto, en la barra lateral del portal y en las capas que flotan.
- Tres curvas: llegada, suave y resorte. La pieza de firma es la escritura del wordmark.
- Cargas: **Escritura** (el cóndor aparece y condor.ai se escribe), **Planeo** (el cóndor sube y baja) y **Barrido** (una luz cruza la silueta, para botones).

### Productos
- Se nombran "condor + palabra": sites, ecommerce, media, track, agents, barbara.
- Las marcas siguen la **gramática del logo de Medula**: trazo grueso, remates redondos, uniones suaves y **un nodo libre** por marca. Medula **no** se recrea; usa su logo real (`assets/medula/medula-marca.svg`) y se presenta como "Medula, de condor.ai".
- Íconos: squircle al 22,5 %, blanco con la marca en su tono o en su tono con la marca blanca.
- Max **no ha opinado** todavía sobre las marcas de producto.

## 4. Pendientes y próximos pasos

1. Que Max elija el isotipo: **Corte**, Pulido u Ojo.
2. Iterar las letras: grosor, forma de la "a" y la "r", espaciado y si ".ai" va en otro peso.
3. Revisar las marcas de producto con Max.
4. Aplicar al **sitio** (`apps/web-v2`): logo, tokens y barra.
5. Aplicar al **Portal Cóndor**: cambiar los tokens de `apps/web-v2/src/portal/disenio/estilo.css` por `tokens/condor.css` y sumar el modo oscuro.
6. Exportar los íconos de producto a PNG (512 / 180 / 32) y reemplazar `apps/web-v2/public/assets/productos/*.png`.

## 5. Cómo está armado

| Archivo | Qué hace |
|---|---|
| `herramientas/generar-marca.mjs` | Isotipo (redondeo + corte, vectorizado con potrace), letras construidas, logos horizontal y vertical, colores y marcas de producto. Escribe `assets/marca/*.svg` y `assets/marca-datos.js`. |
| `assets/marca-datos.js` | Los paths que usa la página (isotipos, wordmark con sus trazos y nodos, logos, productos). Generado: no editar a mano. |
| `tokens/condor.css` | Tokens oficiales (`--cn-*`). |
| `guion.js` | Sprite de marca, letras vivas, plano de letras, selector de propuestas, cargas, productos, kit, copiar SVG y tema. |
| `guion.css` | Maquetación del guion. |
| `herramientas/servir.mjs` | Servidor local en el puerto 5320. |

**Trampas conocidas**
- potrace no cierra los subtrazos con `Z`; quien lea los paths tiene que cerrar la forma anterior en cada `M`.
- Las marcas forjadas tienen agujeros, así que necesitan `fill-rule="evenodd"`.
- En este PC con poca RAM, Claude Code mata el servidor de fondo; si pasa, se vuelve a levantar con `npm run dev`.
- En Git Bash, los heredocs con comillas fallan: los parches conviene escribirlos en archivos.
