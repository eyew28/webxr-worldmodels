/**
 * Base URL for the Sophie AI backend (FastAPI on Railway).
 *
 * In dev we use a relative base ("") so requests hit the Vite dev server and
 * get proxied to Railway — bypassing CORS, which only whitelists the prod
 * origin + :3000/:5173 (see `server.proxy` in vite.config.ts).
 *
 * In production the app is served from a whitelisted origin, so it calls the
 * backend directly.
 */
export const SOPHIE_BACKEND = import.meta.env.DEV
  ? ""
  : "https://louvre-xr-backend-production.up.railway.app";
