import { useState } from "react";
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

import { useSesion, salir } from "./auth/sesion";
import { Login } from "./auth/Login";
import { Lateral, type Entrada } from "./disenio/Lateral";
import { Ico } from "./disenio/iconos";
import { Clientes } from "./staff/Clientes";
import { FichaCliente } from "./staff/FichaCliente";
import { MiPlan } from "./cliente/MiPlan";

const MENU_STAFF: Entrada[] = [
  { a: "/portal/clientes", texto: "Clientes", icono: "clientes" },
  { a: "/portal/cobros", texto: "Cobros", icono: "cobros", pronto: true },
  { a: "/portal/herramientas", texto: "Herramientas", icono: "documentos", pronto: true },
  { a: "/portal/correos", texto: "Correos", icono: "correos", pronto: true },
  { a: "/portal/mapa", texto: "Mapa", icono: "grafo", pronto: true },
];

const MENU_CLIENTE: Entrada[] = [
  { a: "/portal/plan", texto: "Mi plan", icono: "plan" },
  { a: "/portal/boletas", texto: "Boletas", icono: "boletas", pronto: true },
  { a: "/portal/cuenta", texto: "Mi cuenta", icono: "ajustes", pronto: true },
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
          navega("/portal");
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
          <Route path="*" element={<Navigate to="/portal/clientes" replace />} />
        </Routes>
      </Marco>,
    );

  return envolver(
    <Marco menu={MENU_CLIENTE} nombre={nombre} detalle={correo}>
      <Routes>
        <Route path="plan" element={<MiPlan />} />
        <Route path="*" element={<Navigate to="/portal/plan" replace />} />
      </Routes>
    </Marco>,
  );
}
