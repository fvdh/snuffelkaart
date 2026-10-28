import { it, expect } from 'vitest';
import { digest } from './meldingen-mail.mjs';

it('mail alleen bij nieuwe meldingen, met toelichting ontsmet', () => {
  const now = Date.parse('2026-10-29T03:00:00Z');
  const r = (name, at, note = null) => ({ name, what: 'dicht', note, created_at: at });
  expect(digest([r('Oud', '2026-10-27T10:00:00Z')], now)).toBeNull();
  const m = digest([r('Oud', '2026-10-27T10:00:00Z'), r('Nieuw', '2026-10-28T20:00:00Z', '<script>x</script>')], now);
  expect(m.subject).toBe('Snuffelkaart: 1 nieuwe melding');
  expect(m.html).toContain('(2 open in totaal)');
  expect(m.html).toContain('&lt;script&gt;');
  expect(m.html).not.toContain('Oud');
});

it('alleen fouten: korte mail met het aantal', () => {
  const m = digest([], Date.parse('2026-10-29T03:00:00Z'), 3);
  expect(m.subject).toBe('Snuffelkaart: 3 fouten bij bezoekers');
  expect(m.html).toContain('3 fouten');
});
