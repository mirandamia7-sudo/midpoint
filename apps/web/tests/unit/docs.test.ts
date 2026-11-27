/* docs.test.ts: the docs' block reader (src/features/docs/markdown.ts) never turns catalog text into
   markup or unsafe links; the OpenAPI flattener (openapi.ts) resolves $refs and groups routes by
   tag; the fallback route list covers the whole route table; every code sample a guide places
   exists; and, when the API has published its document, the flattener reads it. */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseBlocks, parseInline, plainText, safeHref, slugify } from '@/features/docs/markdown';
import {
  flattenSpec,
  matchesQuery,
  resolveRef,
  schemaView,
  typeLabel,
} from '@/features/docs/openapi';
import { ROUTE_GROUPS } from '@/features/docs/route-list';
import { DOC_PAGES, docPath, findDocPage } from '@/features/docs/pages';
import { SNIPPETS } from '@/features/docs/snippets';
import { ROUTES } from '@/lib/api/routes';
import { CATALOGS, LANGS } from '@/i18n';

test('inline text: code, bold and links, and nothing else becomes markup', () => {
  assert.deepEqual(parseInline('Call `GET /v1/market` **now**'), [
    { kind: 'text', text: 'Call ' },
    { kind: 'code', text: 'GET /v1/market' },
    { kind: 'text', text: ' ' },
    { kind: 'bold', children: [{ kind: 'text', text: 'now' }] },
  ]);
  const link = parseInline('See [Webhooks](/docs/webhooks).');
  assert.deepEqual(link[1], {
    kind: 'link',
    href: '/docs/webhooks',
    internal: true,
    children: [{ kind: 'text', text: 'Webhooks' }],
  });
  assert.ok(
    parseInline('[x](javascript:alert(1))').every((n) => n.kind === 'text'),
    'an unsafe link stays text',
  );
  assert.deepEqual(
    parseInline('[x](data:text/html,1)'),
    [{ kind: 'text', text: 'x' }],
    'an unsafe link is its label',
  );
  assert.deepEqual(
    parseInline('[x](//evil.example)'),
    [{ kind: 'text', text: 'x' }],
    'no protocol-relative links',
  );
  assert.deepEqual(
    parseInline('<img src=x onerror=alert(1)>'),
    [{ kind: 'text', text: '<img src=x onerror=alert(1)>' }],
    'tags stay text',
  );
  assert.equal(safeHref('https://example.com/a')?.internal, false);
  assert.equal(safeHref('http://example.com'), null);
  assert.equal(plainText(parseInline('**a `b`** c')), 'a b c');
});

test('blocks: headings with unique ids, lists, tables, notes and code samples', () => {
  const blocks = parseBlocks([
    '## Cómo avanza una orden',
    'Text.',
    '1. one',
    '1. two',
    '- a',
    '- b',
    '| A | B |',
    '| --- | --- |',
    '| `x` | y |',
    '!> Careful',
    '> Note',
    '@@code env',
    '## Cómo avanza una orden',
    '### Sub',
  ]);
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ['heading', 'paragraph', 'list', 'list', 'table', 'note', 'note', 'code', 'heading', 'heading'],
  );
  assert.equal(blocks[0].kind === 'heading' && blocks[0].id, 'como-avanza-una-orden');
  assert.equal(
    blocks[8].kind === 'heading' && blocks[8].id,
    'como-avanza-una-orden-2',
    'a repeated heading gets its own id',
  );
  assert.ok(blocks[2].kind === 'list' && blocks[2].ordered && blocks[2].items.length === 2);
  assert.ok(blocks[3].kind === 'list' && !blocks[3].ordered && blocks[3].items.length === 2);
  assert.ok(
    blocks[4].kind === 'table' && blocks[4].head.length === 2 && blocks[4].rows.length === 1,
    'the separator row is skipped',
  );
  assert.ok(blocks[5].kind === 'note' && blocks[5].tone === 'warn');
  assert.ok(blocks[6].kind === 'note' && blocks[6].tone === 'info');
  assert.equal(slugify('`p2p:read` y Ñandú'), 'p2p-read-y-nandu');
});

const SPEC = {
  openapi: '3.0.3',
  info: { title: 'Midpoint API', version: '1.0.0' },
  security: [{ apiKey: [] }],
  tags: [{ name: 'orders', description: 'Buy and sell orders' }, { name: 'market' }],
  components: {
    securitySchemes: { apiKey: { type: 'http', scheme: 'bearer' } },
    parameters: { OrderId: { name: 'id', in: 'path', required: true, schema: { type: 'string' } } },
    schemas: {
      Money: { type: 'string', description: 'A decimal string' },
      Order: {
        type: 'object',
        required: ['id', 'status'],
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'paid'] },
          fiatAmount: { $ref: '#/components/schemas/Money' },
          parent: { $ref: '#/components/schemas/Order' },
          deadlines: {
            type: 'object',
            nullable: true,
            properties: { payBy: { type: 'string', format: 'date-time' } },
          },
        },
      },
      CreateOrder: {
        allOf: [
          {
            type: 'object',
            required: ['quoteId'],
            properties: { quoteId: { type: 'string', description: 'From POST /v1/quotes' } },
          },
          { type: 'object', properties: { payer: { type: 'object' } } },
        ],
      },
    },
  },
  paths: {
    '/v1/orders/{id}': {
      parameters: [{ $ref: '#/components/parameters/OrderId' }],
      get: {
        tags: ['orders'],
        summary: 'Read an order',
        operationId: 'getOrder',
        responses: {
          '200': {
            description: 'The order',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
          },
          '404': { description: 'Not found' },
        },
      },
    },
    '/v1/orders': {
      get: {
        tags: ['orders'],
        parameters: [{ name: 'status', in: 'query', schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Orders',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['orders'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrder' } } },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/v1/market': {
      get: { tags: ['market'], security: [], responses: { '200': { description: 'The market' } } },
    },
    '/v1/health': { get: { responses: { '200': { description: 'OK' } } } },
  },
};

test('OpenAPI: refs resolved, fields and requirements, groups in tag order', () => {
  assert.equal(resolveRef(SPEC, '#/components/schemas/Money')?.type, 'string');
  assert.equal(resolveRef(SPEC, '#/components/schemas/Nope'), null);
  assert.equal(resolveRef(SPEC, 'https://elsewhere#/x'), null, 'only local refs');
  assert.equal(
    typeLabel(SPEC, { type: 'array', items: { $ref: '#/components/schemas/Order' } }),
    'Order[]',
  );
  assert.equal(typeLabel(SPEC, { type: 'string', enum: ['a', 'b'] }), "'a' | 'b'");
  assert.equal(
    typeLabel(SPEC, { type: ['string', 'null'], format: 'date-time' }),
    'string (date-time) | null',
  );
  assert.equal(
    typeLabel(SPEC, { oneOf: [{ type: 'string' }, { type: 'integer' }] }),
    'string | integer',
  );

  const view = flattenSpec(SPEC)!;
  assert.equal(view.count, 5);
  assert.deepEqual(
    view.groups.map((g) => g.tag),
    ['orders', 'market', null],
    'declared tags first, untagged last',
  );
  const [readOne, list, create] = view.groups[0].operations;
  assert.equal(readOne.id, 'getOrder');
  assert.deepEqual(
    readOne.params,
    [{ name: 'id', in: 'path', required: true, type: 'string', description: null }],
    'path-level parameters, through their $ref',
  );
  assert.deepEqual(readOne.security, ['apiKey'], 'the document-wide security applies');
  const order = readOne.responses[0].schema!;
  assert.equal(order.type, 'Order');
  assert.deepEqual(
    order.fields.map((f) => [f.name, f.type, f.required]),
    [
      ['id', 'string', true],
      ['status', "'pending' | 'paid'", true],
      ['fiatAmount', 'Money', false],
      ['parent', 'Order', false],
      ['deadlines', 'object | null', false],
    ],
    'a self-reference is named, never expanded',
  );
  assert.equal(
    order.fields[2].description,
    'A decimal string',
    "a referenced field keeps its schema's description",
  );
  assert.equal(list.responses[0].schema?.type, 'Order[]');
  assert.equal(list.responses[0].schema?.fields.length, 5, "an array shows its items' fields");
  assert.equal(list.params[0].required, false);
  assert.deepEqual(
    create.body?.schema.fields.map((f) => [f.name, f.required]),
    [
      ['quoteId', true],
      ['payer', false],
    ],
    'allOf parts merged',
  );
  assert.equal(create.body?.required, true);
  assert.deepEqual(
    view.groups[1].operations[0].security,
    [],
    'an empty security list is a public route',
  );
  assert.ok(matchesQuery(readOne, 'read an'));
  assert.ok(!matchesQuery(readOne, 'payouts'));
  assert.equal(flattenSpec(null), null);
  assert.equal(flattenSpec({ swagger: '2.0', paths: {} }), null);
  assert.equal(schemaView(SPEC, null), null);
});

test('the fallback route list covers every route the app calls', () => {
  const listed = new Set(ROUTE_GROUPS.flatMap((g) => g.routes.map((r) => r.key)));
  assert.deepEqual(
    Object.keys(ROUTES).filter((k) => !listed.has(k as keyof typeof ROUTES)),
    [],
  );
  const paths = ROUTE_GROUPS.flatMap((g) => g.routes.map((r) => `${r.method} ${r.path}`));
  assert.ok(paths.includes('POST /v1/p2p/orders/{id}/paid'));
  assert.ok(paths.includes('PATCH /v1/organizations/{orgId}/members/{memberId}'));
  assert.ok(paths.includes('POST /v1/app/orders/{id}/transactions'));
  assert.equal(new Set(paths).size, paths.length, 'no route twice');
});

test('pages: addresses, lookups, and every code sample a guide places exists in both languages', () => {
  assert.equal(docPath(DOC_PAGES[0]), '/docs');
  assert.equal(findDocPage('')?.key, 'overview');
  assert.equal(findDocPage('api/')?.key, 'api');
  assert.equal(findDocPage('nope'), null);
  for (const lang of LANGS) {
    const pages = CATALOGS[lang].docs.pages;
    for (const p of DOC_PAGES) {
      const page = pages[p.key];
      assert.ok(page.title && page.nav && page.description, `${lang}:${p.key}`);
      for (const line of page.body) {
        const m = /^@@code\s+([\w-]+)$/.exec(line.trim());
        if (m) assert.ok(SNIPPETS[m[1]], `${lang}:${p.key} places a missing sample ${m[1]}`);
        for (const href of line.matchAll(/\]\((\/[^)]+)\)/g)) {
          assert.ok(
            href[1].startsWith('/docs') ? findDocPage(href[1].slice(5)) : true,
            `${lang}:${p.key} links to a missing page ${href[1]}`,
          );
        }
      }
    }
  }
  // Every language places the same samples in the same blocks as the Spanish source.
  for (const p of DOC_PAGES) {
    const code = (lang: (typeof LANGS)[number]) =>
      CATALOGS[lang].docs.pages[p.key].body.filter((l) => l.startsWith('@@code'));
    for (const lang of LANGS) assert.deepEqual(code(lang), code('es'), `${lang}:${p.key}`);
  }
});

// The API's committed document (apps/api/openapi.json in this repo), or another copy named by
// MIDPOINT_OPENAPI_PATH; skipped while neither exists.
const API_SPEC =
  process.env.MIDPOINT_OPENAPI_PATH ||
  fileURLToPath(new URL('../../../api/openapi.json', import.meta.url));
test.skipIf(!existsSync(API_SPEC))("the API's published document flattens", () => {
  const view = flattenSpec(JSON.parse(readFileSync(API_SPEC, 'utf8')));
  assert.ok(view, 'an OpenAPI 3 document');
  assert.ok(view.count > 0);
  for (const g of view.groups)
    for (const op of g.operations) assert.ok(op.path.startsWith('/'), op.path);
});

// Once the API's document has the Stellar routes (SEP-10 sign-in is the marker), every route the
// web app calls must be in it, method and path (parameter names aside). Until the API branch is
// merged the committed document is the EVM one and this is skipped.
const apiDoc = existsSync(API_SPEC) ? JSON.parse(readFileSync(API_SPEC, 'utf8')) : null;
const stellarDoc = !!apiDoc?.paths?.['/v1/auth/challenge'];
test.skipIf(!stellarDoc)("every route the app calls is in the API's document", () => {
  const shape = (path: string) => path.replace(/\{[^}]+\}/g, '{}');
  const ops = new Set(
    Object.entries(apiDoc.paths as Record<string, Record<string, unknown>>).flatMap(
      ([path, item]) =>
        Object.keys(item)
          .filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))
          .map((m) => `${m.toUpperCase()} ${shape(path)}`),
    ),
  );
  // The dev-only simulation is not part of the public document.
  const missing = ROUTE_GROUPS.flatMap((g) => g.routes)
    .filter((r) => r.key !== 'devSimulateTransfer')
    .map((r) => `${r.method} ${shape(r.path)}`)
    .filter((op) => !ops.has(op));
  assert.deepEqual(missing, []);
});
