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
import "./disenio/tema-condor.css";
import "./disenio/leads.css";
import "./disenio/dialogos.css";
import "./disenio/boveda.css";
import "./disenio/cursos.css";

import { useSesion, salir, SesionProvider } from "./auth/sesion";
import { Login } from "./auth/Login";
import { ForzarCambio } from "./auth/ForzarCambio";
import { CambiarClave } from "./auth/CambiarClave";
import { Lateral, type Entrada, type Grupo } from "./disenio/Lateral";
import { Ico } from "./disenio/iconos";
import { BuscadorGlobal } from "./disenio/BuscadorGlobal";
import { ConfirmacionProvider } from "./disenio/Confirmacion";
import { Productos } from "./staff/Productos";
import { EQUIPO_CONDOR } from "./staff/tipos";
import { Leads } from "./staff/Leads";
import { Equipo } from "./staff/Equipo";
import { Biblioteca } from "./staff/Biblioteca";
import { Cursos } from "./staff/cursos/Cursos";
import { Dashboard } from "./staff/Dashboard";
import { Contabilidad } from "./staff/contabilidad/Contabilidad";
import { Organizacion } from "./staff/organizacion/Organizacion";

import { MiPlan } from "./cliente/MiPlan";
import { ResultadoPago } from "./cliente/ResultadoPago";

import { MiCuenta } from "./cliente/MiCuenta";
import { Solicitudes } from "./cliente/Solicitudes";

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
  { titulo: "Inicio", clave: "resumen", icono: "panel",
    entradas: [{ a: "/acceso/dashboard", texto: "Panel", icono: "panel" }] },
  { titulo: "Comercial", clave: "operacion", icono: "contacto",
    entradas: [{ a: "/acceso/leads", texto: "Leads", icono: "contacto" }] },
  { titulo: "Clientes", clave: "productos", icono: "clientes",
    entradas: [
      { a: "/acceso/productos/sites", texto: "Sites", icono: "sitesProducto", imagen: "/condor/marca/producto-sites-chico.svg" },
      { a: "/acceso/productos/ecommerce", texto: "Ecommerce", icono: "ecommerceProducto", imagen: "/condor/marca/producto-ecommerce-chico.svg" },
      { a: "/acceso/productos/crm", texto: "CRM", icono: "trackProducto", imagen: "/condor/marca/producto-crm-chico.svg" },
    ] },
  { titulo: "Recursos", clave: "biblioteca", icono: "biblioteca",
    entradas: [{ a: "/acceso/biblioteca", texto: "Biblioteca", icono: "biblioteca" }] },
  { titulo: "Finanzas", clave: "finanzas", icono: "libro",
    entradas: [{ a: "/acceso/contabilidad", texto: "Contabilidad y cobros", icono: "libro" }] },
  { titulo: "Equipo", clave: "organizacion", icono: "tablero",
    entradas: [
      { a: "/acceso/organizacion/tablero", texto: "Tareas", icono: "tablero" },
      { a: "/acceso/organizacion/calendario", texto: "Calendario", icono: "reuniones" },
      { a: "/acceso/equipo", texto: "Personas", icono: "clientes" },
      { a: "/acceso/mi-cuenta", texto: "Mi cuenta", icono: "ajustes" },
    ] },
];

const MENU_CLIENTE_BASE: Entrada[] = [
  { a: "/acceso/plan", texto: "Mi plan", icono: "plan" },
  { a: "/acceso/solicitudes", texto: "Pedir un cambio", icono: "editar" },
  { a: "/acceso/cursos", texto: "Cursos", icono: "biblioteca" },
  { a: "/acceso/boletas", texto: "Comprobantes", icono: "boletas" },
];

const ITEM_CUENTA: Entrada = { a: "/acceso/cuenta", texto: "Mi cuenta", icono: "ajustes" };

function Marco({
  menu,
  nombre,
  detalle,
  foto,
  buscador,
  children,
}: {
  buscador?: boolean;
  menu: Grupo[];
  nombre: string;
  detalle: string;
  foto?: string;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const navega = useNavigate();

  return (
    <div className="app">
      <Lateral
        buscador={buscador}
        grupos={menu}
        nombre={nombre}
        detalle={detalle}
        foto={foto}
        cuenta={buscador ? "/acceso/mi-cuenta" : "/acceso/cuenta"}
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
      {buscador && <BuscadorGlobal grupos={menu} />}
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
  return <div className="portal-app"><SesionProvider><ConfirmacionProvider><PortalContenido /></ConfirmacionProvider></SesionProvider></div>;
}

function PortalContenido() {
  const s = useSesion();

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

  if (s.debeCambiarClave) return envolver(<ForzarCambio email={s.email} />);

  const correo = s.email;
  // Nombre, rol y foto reales cuando el correo es de alguien del equipo
  // (2-sept-2026, pedido de Joaquín: "donde sale j.ignaciomunozsilva pon
  // ahi la foto de cada uno... y donde dice equipo condor pon el rol").
  // Sin match (un cliente, o un admin fuera de los 3 que aparecen acá) cae
  // al correo crudo de siempre -- no se inventa un rol para alguien que no
  // está en la lista.
  const miembro = EQUIPO_CONDOR.find((m) => m.email === correo);
  const nombre = miembro?.nombre ?? correo.split("@")[0];

  if (s.rol === "staff")
    return envolver(
      <Marco buscador menu={MENU_STAFF} nombre={nombre} detalle={miembro?.rol ?? "Equipo Cóndor"} foto={miembro?.foto}>
        <Routes>
          <Route path="dashboard" element={<Dashboard />} />
          {/* "clientes" (sin línea) sigue viva por los links viejos que
              traen `?ver=<id>` desde Cobros/Panel/Mapa -- Productos lee ese
              query param sin importar qué línea muestre. */}
          <Route path="clientes" element={<Productos />} />
          <Route path="productos/:linea" element={<Productos />} />
          <Route path="leads" element={<Leads />} />
          <Route path="prospeccion" element={<Navigate to="/acceso/leads" replace />} />
          <Route path="contabilidad" element={<Contabilidad />} />
          <Route path="organizacion/:vista" element={<Organizacion />} />
          <Route path="reuniones" element={<Navigate to="/acceso/organizacion/calendario" replace />} />
          {/* Cobros y Rat.IA se fusionaron/retiraron el 2-sept-2026 --
              redirecciones para que un marcador o link viejo no rompa. */}
          <Route path="suscripciones" element={<Navigate to="/acceso/contabilidad?tab=cobros" replace />} />
          <Route path="cobros" element={<Navigate to="/acceso/contabilidad?tab=cobros" replace />} />
          <Route path="ratia" element={<Navigate to="/acceso/clientes" replace />} />
          <Route path="equipo" element={<Equipo />} />
          <Route path="mi-cuenta" element={<><div className="barra"><h1>Mi cuenta</h1></div><div className="cuerpo"><div className="bloque"><CambiarClave /></div></div></>} />
          <Route path="claves" element={<Biblioteca tabInicial="passwords" />} />
          <Route path="biblioteca" element={<Biblioteca />} />
          <Route path="*" element={<Navigate to="/acceso/dashboard" replace />} />
        </Routes>
      </Marco>,
    );

  const menuCliente: Grupo[] = [
    {
      titulo: "Mi servicio",
      clave: "operacion",
      icono: "plan",
      entradas: MENU_CLIENTE_BASE,
    },
    { titulo: "Cuenta", clave: "resumen", icono: "ajustes", entradas: [ITEM_CUENTA] },
  ];

  return envolver(
    <Marco menu={menuCliente} nombre={nombre} detalle={correo}>
      <Routes>
        <Route path="plan" element={<MiPlan />} />
        <Route path="pago/resultado" element={<ResultadoPago />} />
        <Route path="boletas" element={dif(<MisBoletas />)} />
        <Route path="solicitudes" element={<Solicitudes />} />
        <Route path="cursos" element={<><div className="barra"><h1>Cursos</h1></div><div className="cuerpo"><Cursos editable={false} /></div></>} />
        <Route path="cuenta" element={<MiCuenta />} />
        <Route path="*" element={<Navigate to="/acceso/plan" replace />} />
      </Routes>
    </Marco>,
  );
}
