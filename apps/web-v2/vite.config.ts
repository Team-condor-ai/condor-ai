import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error — plugin de desarrollo en JS puro, sin tipos.
import { pluginPortalDemo } from './dev/plugin-demo.mjs'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // MODO DEMO — solo en el computador de quien lo enciende.
  //
  // Se activa con `VITE_PORTAL_DEMO=1` en `.env.local`, que está fuera de git
  // (`.env.*` en el .gitignore del repo). Y aunque alguien lo pusiera en el
  // servidor de despliegue, `command !== "serve"` lo deja fuera igual: en un
  // build el plugin ni se carga.
  //
  // Ver `dev/plugin-demo.mjs` para por qué esto no es un agujero de login.
  const env = loadEnv(mode, process.cwd(), '')
  const demo = command === 'serve' && env.VITE_PORTAL_DEMO === '1'

  return {
    plugins: [react(), ...(demo ? [pluginPortalDemo()] : [])],
  }
})
