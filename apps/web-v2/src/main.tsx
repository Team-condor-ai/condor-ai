import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import "./App.css";
import Layout from "./Layout";
import Home from "./pages/Home";
import Colombia from "./pages/Colombia";
// En diferido a propósito: así Vite deja el portal y el CSS del ERP en un
// chunk aparte que el sitio público no descarga. Es lo que evita que la home
// cargue 34 kB de estilos que no usa.
const Portal = lazy(() => import("./portal/Portal"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
        </Route>
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
            <Suspense fallback={null}>
              <Portal />
            </Suspense>
          }
        />

        {/* Landing de campaña — standalone, sin el chrome del sitio */}
        <Route path="colombia" element={<Colombia />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
