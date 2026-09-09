import { StrictMode, Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import "./App.css";
import RatiaOferta from "./pages/RatiaOferta";
import { Perdido, Cargando, Salvavidas } from "./Perdido";
// En diferido a propósito: así Vite deja el portal y el CSS del ERP en un
// chunk aparte que el sitio público no descarga. Es lo que evita que la home
// cargue 34 kB de estilos que no usa.
const Portal = lazy(() => import("./portal/Portal"));

// A fallback/router visit must never resurrect the retired React homepage.
function PublicHome() {
  useEffect(() => {
    window.location.replace('/rediseno/inicio.html' + window.location.search + window.location.hash);
  }, []);
  return <p><a href="/rediseno/inicio.html">Ir al inicio de Cóndor AI</a></p>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route index element={<PublicHome />} />
        {/* EN /acceso Y NO EN /portal, A PROPÓSITO
            GitHub Pages resuelve /portal como /portal.html ("pretty URLs"),
            y ese archivo todavía existe en public/ — es el portal viejo. Con
            la ruta en /portal, Pages servía el HTML viejo y esta ruta no se
            alcanzaba nunca. Comprobado en producción.
            Además /acceso calza con el botón "Acceso clientes" del menú.

            Va FUERA del Layout del sitio: trae su propio menú lateral y su
            propio fondo; dentro, saldría con el header público encima. El
            `/*` es obligatorio para que sus rutas internas resuelvan. */}
        <Route
          path="acceso/*"
          element={
            // `fallback` visible y no `null`: mientras baja el chunk del
            // portal, un null deja la pantalla en blanco y desde afuera eso
            // se ve igual que un sitio caído.
            <Salvavidas>
              <Suspense fallback={<Cargando />}>
                <Portal />
              </Suspense>
            </Salvavidas>
          }
        />

        {/* Donde cae el link del DM de Rat.IA (ManyChat) -- pide correo +
            consentimiento antes de entregar el link real. Ver
            `RatiaOferta.tsx` y la migración `20260825_ratia_leads.sql`. */}
        <Route path="ratia/oferta" element={<RatiaOferta />} />

        {/* CUALQUIER OTRA URL.
            GitHub Pages entrega 404.html (la cáscara del SPA) para todo lo
            que no sea un archivo, así que sin esta ruta react-router no monta
            nada y la página queda EN BLANCO. Pasó con una URL mal pegada. */}
        <Route path="*" element={<Perdido />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
