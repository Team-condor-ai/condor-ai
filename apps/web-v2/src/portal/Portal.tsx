import { Suspense, lazy, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

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

import { useSesion, salir } from "./auth/sesion";
import { Login } from "./auth/Login";
import { Lateral, type Entrada, type Grupo } from "./disenio/Lateral";
import { Ico } from "./disenio/iconos";
import { Clientes } from "./staff/Clientes";
import { Dashboard } from "./staff/Dashboard";
import { Ratia } from "./staff/ratia/Ratia";
import { Productos } from "./staff/Productos";
import { Contabilidad } from "./staff/contabilidad/Contabilidad";
import { Organizacion } from "./staff/organizacion/Organizacion";
import { Biblioteca } from "./staff/Biblioteca";
import { Mcp } from "./staff/Mcp";
import { Cobros } from "./staff/Cobros";
import { Correos } from "./staff/Correos";
import { Mapa } from "./staff/Mapa";
import { AgentesIA } from "./staff/agentes-ia/AgentesIA";
import { Memoria } from "./staff/memoria/Memoria";
import { FichaBarbaraCliente } from "./staff/agentes-ia/FichaBarbaraCliente";

import { MiPlan } from "./cliente/MiPlan";
import { Barbara } from "./cliente/Barbara";
import { useTieneBarbara } from "./agentes-ia/useTieneBarbara";

import { MiCuenta } from "./cliente/MiCuenta";

// EL MOTOR DE PDF VA APARTE, Y NO ES UN DETALLE
// @react-pdf/renderer pesa ~1,1 MB. Importado de frente, el portal entero
// cargaba 1,5 MB — o sea alguien que solo entra a ver la lista de clientes se
// bajaba el generador de documentos completo. En diferido, ese peso lo paga
// únicamente quien abre Herramientas o Comprobantes.
const Herramientas = lazy(() =>
  import("./documentos/Herramientas").then((m) => ({ default: m.Herramientas })),
);
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
 * "Clientes" ahora tiene dos: la cartera de la agencia y los suscriptores de
 * Rat.IA, que son negocios distintos y no se mezclan.
 */
const MENU_STAFF: Grupo[] = [
  {
    titulo: "Resumen",
    icono: "panel",
    entradas: [{ a: "/acceso/dashboard", texto: "Panel", icono: "panel" }],
  },
  {
    titulo: "Clientes",
    icono: "clientes",
    entradas: [
      { a: "/acceso/clientes", texto: "Cóndor.AI", icono: "condor" },
      { a: "/acceso/ratia", texto: "Rat.IA", icono: "ratia" },
    ],
  },
  {
    titulo: "Finanzas y contabilidad",
    icono: "libro",
    entradas: [
      { a: "/acceso/cobros", texto: "Cobros", icono: "cobros" },
      { a: "/acceso/productos", texto: "Productos", icono: "producto" },
      { a: "/acceso/contabilidad", texto: "Contabilidad", icono: "libro" },
    ],
  },
  {
    titulo: "Organización",
    icono: "tablero",
    entradas: [
      { a: "/acceso/organizacion/tablero", texto: "Tablero", icono: "tablero" },
      { a: "/acceso/organizacion/calendario", texto: "Calendario", icono: "reuniones" },
      { a: "/acceso/organizacion/metas", texto: "Metas", icono: "meta" },
    ],
  },
  {
    titulo: "Agentes IA",
    icono: "barbara",
    entradas: [
      // "Agentes IA > Barbara > Barbara Clientes" es la jerarquia del encargo;
      // el menu no anida un tercer nivel, asi que "Barbara" vive DENTRO de la
      // pagina como chip, pensado para cuando haya un segundo agente.
      { a: "/acceso/agentes-ia", texto: "Bárbara", icono: "barbara" },
      { a: "/acceso/memoria", texto: "Memoria", icono: "memoria" },
    ],
  },
  {
    titulo: "Operación",
    icono: "reuniones",
    entradas: [
      { a: "/acceso/correos", texto: "Correos", icono: "correos" },
      { a: "/acceso/herramientas", texto: "Herramientas", icono: "documentos" },
      { a: "/acceso/biblioteca", texto: "Biblioteca", icono: "biblioteca" },
    ],
  },
  {
    titulo: "Sistema",
    icono: "ajustes",
    entradas: [
      { a: "/acceso/mapa", texto: "Mapa", icono: "grafo" },
      { a: "/acceso/mcp", texto: "MCP / CLI", icono: "mcp" },
    ],
  },
];

const MENU_CLIENTE_BASE: Entrada[] = [
  { a: "/acceso/plan", texto: "Mi plan", icono: "plan" },
  { a: "/acceso/boletas", texto: "Comprobantes", icono: "boletas" },
];

const ITEM_CUENTA: Entrada = { a: "/acceso/cuenta", texto: "Mi cuenta", icono: "ajustes" };
const ITEM_BARBARA: Entrada = { a: "/acceso/barbara", texto: "Bárbara", icono: "agentesia" };

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
  const s = useSesion();
  // Se consulta siempre (staff incluido) porque los hooks no pueden ser
  // condicionales — para staff simplemente no se usa el resultado.
  const { tiene: tieneBarbara } = useTieneBarbara();

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

  if (s.rol === "staff")
    return envolver(
      <Marco menu={MENU_STAFF} nombre={nombre} detalle="Equipo Cóndor">
        <Routes>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="ratia" element={<Ratia />} />
          <Route path="productos" element={<Productos />} />
          <Route path="contabilidad" element={<Contabilidad />} />
          <Route path="organizacion/:vista" element={<Organizacion />} />
          <Route path="reuniones" element={<Navigate to="/acceso/organizacion/calendario" replace />} />
          <Route path="suscripciones" element={<Navigate to="/acceso/cobros" replace />} />
          <Route path="biblioteca" element={<Biblioteca />} />
          <Route path="mcp" element={<Mcp />} />
          <Route path="cobros" element={<Cobros />} />
          <Route path="herramientas" element={dif(<Herramientas />)} />
          <Route path="correos" element={<Correos />} />
          <Route path="mapa" element={<Mapa />} />
          <Route path="agentes-ia" element={<AgentesIA />} />
          <Route path="memoria" element={<Memoria />} />
          <Route path="agentes-ia/:id" element={<FichaBarbaraCliente />} />
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
      icono: "plan",
      entradas: tieneBarbara ? [...MENU_CLIENTE_BASE, ITEM_BARBARA] : MENU_CLIENTE_BASE,
    },
    { titulo: "Cuenta", icono: "ajustes", entradas: [ITEM_CUENTA] },
  ];

  return envolver(
    <Marco menu={menuCliente} nombre={nombre} detalle={correo}>
      <Routes>
        <Route path="plan" element={<MiPlan />} />
        <Route path="boletas" element={dif(<MisBoletas />)} />
        <Route path="barbara" element={<Barbara />} />
        <Route path="cuenta" element={<MiCuenta />} />
        <Route path="*" element={<Navigate to="/acceso/plan" replace />} />
      </Routes>
    </Marco>,
  );
}
