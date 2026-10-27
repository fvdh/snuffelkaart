// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  // MapLibre 6 laadt zijn worker relatief t.o.v. zijn eigen ESM-bestanden; voorbundelen door Vite breekt dat pad.
  vite: { optimizeDeps: { exclude: ['maplibre-gl'] } },
});
