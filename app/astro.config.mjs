// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { loadEnv } from 'vite';

// /beheer: project-URL en publishable key (niet geheim; RLS beschermt de data). Uit app/.env of de omgeving van de build.
const env = loadEnv('', process.cwd(), '');

export default defineConfig({
  integrations: [react()],
  // MapLibre 6 laadt zijn worker relatief t.o.v. zijn eigen ESM-bestanden; voorbundelen door Vite breekt dat pad.
  vite: {
    optimizeDeps: { exclude: ['maplibre-gl'] },
    define: { __SB_URL__: JSON.stringify(env.SUPABASE_URL ?? ''), __SB_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY ?? '') },
  },
});
