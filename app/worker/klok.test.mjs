import { it, expect } from 'vitest';
import { due } from './klok.js';

const at = iso => due(new Date(iso)).map(([f, i]) => f + (i.modus ? `:${i.modus}` : ''));
it('klok: elk kwartier publiceren, 02:30 alles, back-up, controle en winkels op hun tijd', () => {
  expect(at('2026-10-28T12:15:00Z')).toEqual(['nachtelijk.yml:kwartier']);
  expect(at('2026-10-28T12:30:00Z')).toEqual(['nachtelijk.yml:kwartier', 'controle.yml']);
  expect(at('2026-10-28T02:00:00Z')).toEqual(['nachtelijk.yml:kwartier', 'controle.yml', 'backup.yml']);
  expect(at('2026-10-28T02:30:00Z')).toEqual(['nachtelijk.yml:alles', 'controle.yml']);
  expect(at('2026-11-02T00:30:00Z')).toEqual(['nachtelijk.yml:kwartier', 'controle.yml', 'winkels.yml']); // maandag
});
