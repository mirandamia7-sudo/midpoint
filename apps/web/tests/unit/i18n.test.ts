/* i18n.test.ts: every key of the Spanish catalog (the source) exists in every other language and
   the other way round, no value is empty, lists have the same length, and every {placeholder} a
   Spanish string uses is in each twin (and no new one appears). The catalogs' types already make a
   missing key a compile error; this also catches empty strings and placeholder drift. */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { CATALOGS, LANGS, RAW_CATALOGS, initialLang } from '@/i18n';
import { BRAND, withBrand } from '@/lib/brand';

type Tree = unknown;

function leaves(tree: Tree, path = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof tree === 'string') {
    out.set(path, tree);
    return out;
  }
  if (Array.isArray(tree)) {
    out.set(`${path}#length`, String(tree.length));
    tree.forEach((v, i) => leaves(v, `${path}[${i}]`).forEach((s, k) => out.set(k, s)));
    return out;
  }
  if (tree && typeof tree === 'object') {
    for (const [k, v] of Object.entries(tree))
      leaves(v, path ? `${path}.${k}` : k).forEach((s, key) => out.set(key, s));
    return out;
  }
  out.set(path, `<<${typeof tree}>>`);
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const TWINS = LANGS.filter((lang) => lang !== 'es');

test('the languages are Spanish (the source), English and Portuguese', () => {
  assert.deepEqual([...LANGS], ['es', 'en', 'pt']);
});

test('every language has exactly the keys of the Spanish catalog', () => {
  const es = leaves(CATALOGS.es);
  assert.ok(es.size > 500, `a real catalog (${es.size} strings)`);
  for (const lang of TWINS) {
    const twin = leaves(CATALOGS[lang]);
    const missing = [...es.keys()].filter((k) => !twin.has(k));
    const extra = [...twin.keys()].filter((k) => !es.has(k));
    assert.deepEqual(missing, [], `keys missing in ${lang}`);
    assert.deepEqual(extra, [], `keys only in ${lang}`);
  }
});

test('no value is empty or not a string', () => {
  for (const lang of LANGS) {
    for (const [k, v] of leaves(CATALOGS[lang])) {
      if (k.endsWith('#length')) continue;
      assert.ok(v.trim().length > 0, `${lang}:${k} is empty`);
      assert.ok(!v.startsWith('<<'), `${lang}:${k} is not a string`);
    }
  }
});

test('placeholders match between the languages', () => {
  const es = leaves(CATALOGS.es);
  for (const lang of TWINS) {
    const twin = leaves(CATALOGS[lang]);
    for (const [k, v] of es) {
      if (k.endsWith('#length')) continue;
      assert.deepEqual(placeholders(twin.get(k) ?? ''), placeholders(v), `${lang}:${k}`);
    }
  }
});

test('each language is named in its own words in every catalog', () => {
  for (const lang of LANGS)
    assert.deepEqual(
      {
        es: CATALOGS[lang].common.lang.es,
        en: CATALOGS[lang].common.lang.en,
        pt: CATALOGS[lang].common.lang.pt,
      },
      { es: 'Español', en: 'English', pt: 'Português' },
      lang,
    );
});

test('the starting language: the address, then the saved choice, then Spanish', () => {
  assert.equal(initialLang('?lang=en'), 'en');
  assert.equal(initialLang('?lang=pt'), 'pt');
  assert.equal(initialLang('?lang=fr'), 'es');
  assert.equal(initialLang(''), 'es');
});

test('the product name is written once: catalogs say {brand}', () => {
  for (const lang of LANGS) {
    for (const [k, v] of leaves(RAW_CATALOGS[lang])) {
      // Technical names that are part of the API contract are not the brand.
      const text = v.replace(/midpoint-signature|\/midpoint\//g, '');
      assert.ok(!/midpoint/i.test(text), `${lang}:${k} writes the product name`);
    }
    for (const [k, v] of leaves(CATALOGS[lang]))
      assert.ok(!v.includes('{brand}'), `${lang}:${k} still has {brand}`);
  }
  assert.equal(CATALOGS.es.common.brand, BRAND.name);
  assert.deepEqual(withBrand({ a: ['{brand} app'], b: 1 }, 'nuevo'), { a: ['nuevo app'], b: 1 });
});
