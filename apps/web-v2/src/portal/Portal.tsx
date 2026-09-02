import { Suspense, lazy, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

// El CSS del ERP de Planeta, copiado sin tocar. Se importa SOLO acá y no en
// main.tsx a propósito: define variables globales (--fondo, --texto…) y un
// `body` con su propia tipografía y color, así que cargarlo en el sitio
// público le cambiaría el diseño a la home. Importándolo desde el portal,
// Vite lo mete en el bundle igual, pero el acoplamiento queda declarado
// donde corresponde.
import "./disenio/estilo.css";
import "./disenio/piezas.css";
import "./disenio/portal.css";
import "./disenio/acceso.css";
import "./disenio/barbara.css";

import { useSesion, salir } from "./auth/sesion";
import { Login } from "./auth/Login";
import { Lateral, type Entrada, type Grupo } from "./disenio/Lateral";
import { Ico } from "./disenio/iconos";
import { ConfirmacionProvider } from "./disenio/Confirmacion";
import { Productos } from "./staff/Productos";
import { Prospeccion } from "./staff/Prospeccion";
import { Dashboard } from "./staff/Dashboard";
import { Contabilidad } from "./staff/contabilidad/Contabilidad";
import { Organizacion } from "./staff/organizacion/Organizacion";
import { Biblioteca } from "./staff/Biblioteca";
import { Mcp } from "./staff/Mcp";
import { CreditosApi } from "./staff/CreditosApi";
import { Mapa } from "./staff/Mapa";
import { AgentesIA } from "./staff/agentes-ia/AgentesIA";
import { Memoria } from "./staff/memoria/Memoria";
import { FichaBarbaraCliente } from "./staff/agentes-ia/FichaBarbaraCliente";
import { BarbaraClientePortal } from "./staff/agentes-ia/BarbaraClientePortal";

import { MiPlan } from "./cliente/MiPlan";
import { ResultadoPago } from "./cliente/ResultadoPago";
import { Barbara } from "./cliente/Barbara";
import { useTieneBarbara } from "./agentes-ia/useTieneBarbara";

import { MiCuenta } from "./cliente/MiCuenta";

// EL MOTOR DE PDF VA APARTE, Y NO ES UN DETALLE
// @react-pdf/renderer pesa ~1,1 MB. Importado de frente, el portal entero
// cargaba 1,5 MB — o sea alguien que solo entra a ver la lista de clientes se
// bajaba el generador de documentos completo. En diferido, ese peso lo paga
// únicamente quien abre Comprobantes.
// "Herramientas" (el otro consumidor de este motor) se retiró del portal el
// 2-sept-2026 -- ver reorganización pedida por Joaquín.
const MisBoletas = lazy(() =>
  import("./cliente/MisBoletas").then((m) => ({ default: m.MisBoletas })),
);

const cargando = <div className="cuerpo"><p className="vacio">Cargando…</p></div>;
const dif = (n: React.ReactNode) => <Suspense fallback={cargando}>{n}</Suspense>;

/**
 * El menu del equipo, en bloques con nombre.
 *
 * POR QUE DEJO DE SER UNA LISTA PLANA (21-ago-2026)
 * ---------------------------------------------------------------------------
 * Eran doce entradas seguidas, sin jerarquia: para encontrar una habia que
 * leerlas todas. Agrupadas por para-que-sirve se salta directo al bloque, y
 * cada bloque se puede plegar cuando no se usa.
 *
 * "Clientes" pasó a ser "Productos" el 2-sept-2026 (pedido de Joaquín):
 * una pestaña por línea de negocio (Sites/Ecommerce/Track) con su logo,
 * en vez de una lista mezclando todo. Rat.IA salió del menú por completo
 * -- es un producto B2C aparte, no una línea de Cóndor.ai.
 */
const MENU_STAFF: Grupo[] = [
  {
    titulo: "Resumen",
    clave: "resumen",
    icono: "panel",
    entradas: [{ a: "/acceso/dashboard", texto: "Panel", icono: "panel" }],
  },
  {
    titulo: "Productos",
    clave: "productos",
    icono: "clientes",
    entradas: [
      { a: "/acceso/clientes", texto: "Productos", icono: "clientes" },
    ],
  },
  {
    titulo: "Comercial",
    clave: "comercial",
    icono: "buscar",
    entradas: [
      { a: "/acceso/prospeccion", texto: "Prospección", icono: "buscar" },
    ],
  },
  {
    titulo: "Finanzas y contabilidad",
    clave: "finanzas",
    icono: "libro",
    entradas: [
      { a: "/acceso/contabilidad", texto: "Contabilidad", icono: "libro" },
    ],
  },
  {
    titulo: "Organización",
    clave: "organizacion",
    icono: "tablero",
    entradas: [
      { a: "/acceso/organizacion/tablero", texto: "Tareas", icono: "tablero" },
      { a: "/acceso/organizacion/calendario", texto: "Calendario", icono: "reuniones" },
    ],
  },
  {
    titulo: "Agentes IA",
    clave: "agentes",
    icono: "barbara",
    // En fila, no apiladas: Memoria no es otra sección del menú, es lo que
    // Bárbara recuerda. Juntas se leen como una sola cosa con dos puertas.
    fila: true,
    entradas: [
      // "Bárbara" abre EL portal directo (Cóndor.AI, como cualquier cliente
      // usando su propio producto) — pedido explícito de Joaquín (24-ago):
      // sin pasos intermedios, sin lista, sin botón "Ver portal". La lista
      // completa de clientes de Bárbara (administrar, dar de alta) sigue en
      // /acceso/agentes-ia, alcanzable desde dentro del portal en Ajustes.
      { a: "/acceso/barbara", texto: "Bárbara", icono: "barbara", transicion: true,
        agente: "barbara", oficio: "Contenido" },
      // Sin bajada: en 71 px "LO QUE SABE" se corta en "LO QUE S…", y una
      // etiqueta cortada comunica menos que ninguna.
      { a: "/acceso/memoria", texto: "Memoria", icono: "memoria", agente: "memoria" },
    ],
  },
  {
    titulo: "Operación",
    clave: "operacion",
    icono: "reuniones",
    entradas: [
      { a: "/acceso/biblioteca", texto: "Biblioteca", icono: "biblioteca" },
    ],
  },
  {
    titulo: "Sistema",
    clave: "sistema",
    icono: "ajustes",
    entradas: [
      { a: "/acceso/mapa", texto: "Mapa", icono: "grafo" },
      { a: "/acceso/creditos-api", texto: "Claves / API Tokens", icono: "creditos" },
      { a: "/acceso/mcp", texto: "MCP / CLI", icono: "mcp" },
    ],
  },
];

const MENU_CLIENTE_BASE: Entrada[] = [
  { a: "/acceso/plan", texto: "Mi plan", icono: "plan" },
  { a: "/acceso/boletas", texto: "Comprobantes", icono: "boletas" },
];

const ITEM_CUENTA: Entrada = { a: "/acceso/cuenta", texto: "Mi cuenta", icono: "ajustes" };
const ITEM_BARBARA: Entrada = { a: "/acceso/barbara", texto: "Bárbara", icono: "agentesia", transicion: true };

function Marco({
  menu,
  nombre,
  detalle,
  children,
}: {
  menu: Grupo[];
  nombre: string;
  detalle: string;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const navega = useNavigate();

  return (
    <div className="app">
      <Lateral
        grupos={menu}
        nombre={nombre}
        detalle={detalle}
        abierto={abierto}
        cerrar={() => setAbierto(false)}
        onSalir={async () => {
          await salir();
          navega("/acceso");
        }}
      />
      <main>
        <div className="lienzo">
          <button
            className="icono-btn quemenu"
            onClick={() => setAbierto((v) => !v)}
            aria-label="Menú"
          >
            {Ico.menu()}
          </button>
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * El portal completo, montado en /portal del sitio.
 *
 * Una sola puerta: el correo decide si se ve el área de staff o la de
 * cliente. La decisión la toma `es_admin()` en Postgres, no el navegador —
 * ver el comentario en `auth/sesion.ts`.
 */
export default function Portal() {
  // El confirmador debe vivir DENTRO de `.portal-app`: sus variables de tema y
  // el scope del CSS del portal son los que garantizan contraste en oscuro.
  return <div className="portal-app"><ConfirmacionProvider><PortalContenido /></ConfirmacionProvider></div>;
}

function PortalContenido() {
  const s = useSesion();
  // Se consulta siempre (staff incluido) porque los hooks no pueden ser
  // condicionales — para staff simplemente no se usa el resultado.
  const { tiene: tieneBarbara } = useTieneBarbara();
  const ubicacion = useLocation();

  // `.portal-app` no es decorativo: es el scope del CSS del ERP. Sin este
  // div, las reglas de fondo, tipografía e iconos no se aplican — ver el
  // comentario al principio de `disenio/estilo.css`.
  const envolver = (hijo: React.ReactNode) => (
    <div className="portal-app">{hijo}</div>
  );

  if (s.cargando)
    return envolver(
      <div className="entrada-portal">
        <p className="vacio">Cargando…</p>
      </div>,
    );

  if (!s.email) return envolver(<Login />);

  const correo = s.email;
  const nombre = correo.split("@")[0];

  // BÁRBARA ES SU PROPIA APP DENTRO DEL PORTAL, NO UNA PÁGINA MÁS.
  // ---------------------------------------------------------------------------
  // Pedido explícito de Joaquín (24-ago-2026): al entrar a Bárbara, el menú y
  // el chrome de Cóndor desaparecen del todo — se siente como entrar a otra
  // app, con su propio riel de navegación oscuro y un botón propio para
  // volver. Por eso estas dos rutas se resuelven ACÁ, antes que `Marco`, en
  // vez de vivir anidadas dentro de él como el resto de las páginas de staff
  // o de cliente. `BarbaraModulo` trae su propio botón de "Volver a Cóndor".
  const enBarbara = /^\/acceso\/(barbara|agentes-ia\/[^/]+\/portal)(\/|$)/.test(ubicacion.pathname);
  if (enBarbara)
    return envolver(
      <Routes>
        <Route path="barbara" element={<Barbara />} />
        <Route path="agentes-ia/:id/portal" element={<BarbaraClientePortal />} />
      </Routes>,
    );

  if (s.rol === "staff")
    return envolver(
      <Marco menu={MENU_STAFF} nombre={nombre} detalle="Equipo Cóndor">
        <Routes>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="clientes" element={<Productos />} />
          <Route path="prospeccion" element={<Prospeccion />} />
          <Route path="contabilidad" element={<Contabilidad />} />
          <Route path="organizacion/:vista" element={<Organizacion />} />
          <Route path="reuniones" element={<Navigate to="/acceso/organizacion/calendario" replace />} />
          {/* Cobros y Rat.IA se fusionaron/retiraron el 2-sept-2026 --
              redirecciones para que un marcador o link viejo no rompa. */}
          <Route path="suscripciones" element={<Navigate to="/acceso/contabilidad?tab=cobros" replace />} />
          <Route path="cobros" element={<Navigate to="/acceso/contabilidad?tab=cobros" replace />} />
          <Route path="ratia" element={<Navigate to="/acceso/clientes" replace />} />
          <Route path="biblioteca" element={<Biblioteca />} />
          <Route path="mcp" element={<Mcp />} />
          <Route path="creditos-api" element={<CreditosApi />} />
          <Route path="mapa" element={<Mapa />} />
          <Route path="agentes-ia" element={<AgentesIA />} />
          <Route path="memoria" element={<Memoria />} />
          <Route path="agentes-ia/:id" element={<FichaBarbaraCliente />} />
          {/* agentes-ia/:id/portal se resuelve más arriba, fuera de Marco */}
          <Route path="*" element={<Navigate to="/acceso/dashboard" replace />} />
        </Routes>
      </Marco>,
    );

  // El ítem "Bárbara" en el menú del cliente solo aparece si tiene la fila
  // activa en `barbara_clientes` — no aparece deshabilitado, directamente no
  // está (pedido explícito). La ruta igual queda montada: si alguien la
  // visita a mano sin tener Bárbara, `Barbara.tsx` muestra su propio
  // mensaje de "todavía no tienes Bárbara activada" en vez de romper.
  const menuCliente: Grupo[] = [
    {
      titulo: "Mi servicio",
      clave: "operacion",
      icono: "plan",
      entradas: tieneBarbara ? [...MENU_CLIENTE_BASE, ITEM_BARBARA] : MENU_CLIENTE_BASE,
    },
    { titulo: "Cuenta", clave: "resumen", icono: "ajustes", entradas: [ITEM_CUENTA] },
  ];

  return envolver(
    <Marco menu={menuCliente} nombre={nombre} detalle={correo}>
      <Routes>
        <Route path="plan" element={<MiPlan />} />
        <Route path="pago/resultado" element={<ResultadoPago />} />
        <Route path="boletas" element={dif(<MisBoletas />)} />
        {/* barbara se resuelve más arriba, fuera de Marco */}
        <Route path="cuenta" element={<MiCuenta />} />
        <Route path="*" element={<Navigate to="/acceso/plan" replace />} />
      </Routes>
    </Marco>,
  );
}
