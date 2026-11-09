// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { loadEnv } from 'vite';
import fs from 'node:fs';

// /beheer: project-URL en publishable key (niet geheim; RLS beschermt de data). Uit app/.env of de omgeving van de build.
const env = loadEnv('', process.cwd(), '');

// Doorverwijzingen die uit de data volgen (src/pages/markt-redirects.txt.ts) achter de vaste regels in _redirects zetten.
const redirects = {
  name: 'snuffel-redirects',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const gen = new URL('markt-redirects.txt', dir), out = new URL('_redirects', dir);
      if (!fs.existsSync(gen)) return;
      fs.appendFileSync(out, `\n# Markten: oude adressen per datum → pagina van de reeks (gegenereerd)\n${fs.readFileSync(gen, 'utf8')}`);
      fs.unlinkSync(gen);
      const n = fs.readFileSync(out, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
      if (n > 1900) throw new Error(`_redirects heeft ${n} regels; Cloudflare staat er ±2000 toe`);
    },
  },
};

export default defineConfig({
  integrations: [react(), redirects],
  // MapLibre 6 laadt zijn worker relatief t.o.v. zijn eigen ESM-bestanden; voorbundelen door Vite breekt dat pad.
  vite: {
    optimizeDeps: { exclude: ['maplibre-gl'] },
    define: { __SB_URL__: JSON.stringify(env.SUPABASE_URL ?? ''), __SB_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY ?? '') },
  },
});
