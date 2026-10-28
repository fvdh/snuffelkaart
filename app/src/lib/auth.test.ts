import { expect, test } from 'vitest';
import { mergeFavs } from './auth';

test('favorieten bij inloggen: account eerst, wat alleen op dit apparaat stond gaat mee (geen dubbele)', () => {
  expect(mergeFavs(['a', 'b', 'c'], ['b', 'x'])).toEqual({ all: ['b', 'x', 'a', 'c'], upload: ['a', 'c'] });
  expect(mergeFavs([], ['x'])).toEqual({ all: ['x'], upload: [] });
});
