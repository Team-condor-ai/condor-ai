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
import { Lateral, type Entrada } from "./disenio/Lateral";
import { Ico } from "./disenio/iconos";
import { Clientes } from "./staff/Clientes";
import { FichaCliente } from "./staff/FichaCliente";
import { Cobros } from "./staff/Cobros";
import { Correos } from "./staff/Correos";
import { Mapa } from "./staff/Mapa";

import { MiPlan } from "./cliente/MiPlan";

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

const MENU_STAFF: Entrada[] = [
  { a: "/acceso/clientes", texto: "Clientes", icono: "clientes" },
  { a: "/acceso/cobros", texto: "Cobros", icono: "cobros" },
  { a: "/acceso/herramientas", texto: "Herramientas", icono: "documentos" },
  { a: "/acceso/correos", texto: "Correos", icono: "correos" },
  { a: "/acceso/mapa", texto: "Mapa", icono: "grafo" },
];

const MENU_CLIENTE: Entrada[] = [
  { a: "/acceso/plan", texto: "Mi plan", icono: "plan" },
  { a: "/acceso/boletas", texto: "Comprobantes", icono: "boletas" },
  { a: "/acceso/cuenta", texto: "Mi cuenta", icono: "ajustes" },
];

function Marco({
  menu,
  nombre,
  detalle,
  children,
}: {
  menu: Entrada[];
  nombre: string;
  detalle: string;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const navega = useNavigate();

  return (
    <div className="app">
      <Lateral
        entradas={menu}
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
          <Route path="clientes" element={<Clientes />} />
          <Route path="clientes/:id" element={<FichaCliente />} />
          <Route path="cobros" element={<Cobros />} />
          <Route path="herramientas" element={dif(<Herramientas />)} />
          <Route path="correos" element={<Correos />} />
          <Route path="mapa" element={<Mapa />} />
          <Route path="*" element={<Navigate to="/acceso/clientes" replace />} />
        </Routes>
      </Marco>,
    );

  return envolver(
    <Marco menu={MENU_CLIENTE} nombre={nombre} detalle={correo}>
      <Routes>
        <Route path="plan" element={<MiPlan />} />
        <Route path="boletas" element={dif(<MisBoletas />)} />
        <Route path="cuenta" element={<MiCuenta />} />
        <Route path="*" element={<Navigate to="/acceso/plan" replace />} />
      </Routes>
    </Marco>,
  );
}
