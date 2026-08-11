import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import "./App.css";
import Layout from "./Layout";
import Home from "./pages/Home";
import Colombia from "./pages/Colombia";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
        </Route>
        {/* Landing de campaña — standalone, sin el chrome del sitio */}
        <Route path="colombia" element={<Colombia />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
