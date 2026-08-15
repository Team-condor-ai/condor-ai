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
        {/* El portal va FUERA del Layout del sitio: trae su propio menú
            lateral y su propio fondo. Metido dentro, saldría con el header
            público encima. `/*` es obligatorio para que sus rutas internas
            (clientes, clientes/:id) resuelvan. */}
        <Route
          path="portal/*"
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
