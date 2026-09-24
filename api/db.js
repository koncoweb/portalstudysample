// @bolo-db-scaffold
// Backend database aplikasi (Vercel Function). Token Turso dibaca dari env
// Vercel (dipasang otomatis oleh BOLO) — TIDAK pernah ada di kode/browser.
// Validasi tabel dilakukan terhadap skema NYATA (sqlite_master) saat request,
// BUKAN daftar statis saat scaffold — supaya tabel yang ditambahkan belakangan
// (mis. tabel auth) langsung bisa dipakai tanpa scaffold ulang.

async function runPipeline(statements) {
  const base = String(process.env.TURSO_DATABASE_URL || '').replace(/\/+$/, '');
  const token = String(process.env.TURSO_AUTH_TOKEN || '');
  if (!base || !token) throw new Error('database belum dikonfigurasi');
  const res = await fetch(base + '/v2/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: statements.map(function (st) { return { type: 'execute', stmt: st }; }).concat([{ type: 'close' }]),
    }),
  });
  const data = await res.json().catch(function () { return null; });
  if (!res.ok) throw new Error('Turso HTTP ' + res.status);
  const failed = ((data && data.results) || []).find(function (r) { return r.type === 'error'; });
  if (failed) throw new Error((failed.error && failed.error.message) || 'SQL gagal');
  return ((data && data.results) || [])
    .filter(function (r) { return r.response && r.response.type === 'execute'; })
    .map(function (r) { return r.response.result || {}; });
}

function arg(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number') return Number.isInteger(v)
    ? { type: 'integer', value: String(v) }
    : { type: 'float', value: String(v) };
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
  return { type: 'text', value: String(v) };
}

function unwrap(v) {
  if (v && typeof v === 'object' && 'type' in v) {
    if (v.type === 'null') return null;
    if (v.type === 'integer') return Number(v.value);
    if (v.type === 'float') return Number(v.value);
    return v.value;
  }
  return v;
}

function toObjects(result) {
  const names = ((result && result.cols) || []).map(function (c) { return String(c.name || c); });
  return ((result && result.rows) || []).map(function (row) {
    const o = {};
    names.forEach(function (n, i) { o[n] = unwrap(row[i]); });
    return o;
  });
}

async function tableNames() {
  const r = await runPipeline([{ sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'" }]);
  return toObjects(r[0]).map(function (x) { return String(x.name); });
}

async function columns(table) {
  const r = await runPipeline([{ sql: 'PRAGMA table_info(' + table + ')' }]);
  return toObjects(r[0]);
}

async function handle(table, action, params) {
  const names = await tableNames();
  if (names.indexOf(table) === -1) throw new Error('tabel tidak dikenal: ' + table);
  const colRows = await columns(table);
  const cols = colRows.map(function (c) { return String(c.name); });
  const pkCol = colRows.filter(function (c) { return Number(c.pk || 0) > 0; })[0];
  const pk = pkCol ? String(pkCol.name) : 'rowid';
  const p = params || {};
  const valid = Object.keys(p).filter(function (k) { return k !== pk && k !== '__rowid' && cols.indexOf(k) !== -1; });
  const pkValue = function () {
    if (p[pk] !== undefined) return p[pk];
    if (p['__rowid'] !== undefined) return p['__rowid'];
    return p['id'];
  };
  if (action === 'list') {
    const orderBy = pk === 'rowid' ? 'rowid' : pk;
    const r = await runPipeline([{ sql: 'SELECT * FROM ' + table + ' ORDER BY ' + orderBy + ' DESC LIMIT 500' }]);
    return { rows: toObjects(r[0]) };
  }
  if (action === 'insert') {
    const id = pkValue();
    const cols = id !== undefined ? valid.concat([pk]) : valid;
    if (!cols.length) throw new Error('tidak ada kolom valid');
    const sql = 'INSERT INTO ' + table + ' (' + cols.join(',') + ') VALUES (' + cols.map(function () { return '?'; }).join(',') + ')';
    const args = valid.map(function (k) { return arg(p[k]); });
    if (id !== undefined) args.push(arg(id));
    const r = await runPipeline([{ sql: sql, args: args }]);
    return { changes: r[0].affected_row_count || 0 };
  }
  if (action === 'update') {
    const id = pkValue();
    if (id === undefined) throw new Error('nilai primary key (' + pk + ') wajib untuk update');
    if (!valid.length) throw new Error('tidak ada kolom valid');
    const sql = 'UPDATE ' + table + ' SET ' + valid.map(function (k) { return k + ' = ?'; }).join(', ') + ' WHERE ' + pk + ' = ?';
    const r = await runPipeline([{ sql: sql, args: valid.map(function (k) { return arg(p[k]); }).concat([arg(id)]) }]);
    return { changes: r[0].affected_row_count || 0 };
  }
  if (action === 'delete' || action === 'remove') {
    const id = pkValue();
    if (id === undefined) throw new Error('nilai primary key (' + pk + ') wajib untuk delete');
    const r = await runPipeline([{ sql: 'DELETE FROM ' + table + ' WHERE ' + pk + ' = ?', args: [arg(id)] }]);
    return { changes: r[0].affected_row_count || 0 };
  }
  throw new Error('aksi tidak dikenal: ' + action);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST only' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const data = await handle(String(body.table || ''), String(body.action || 'list'), body.params || body);
    res.status(200).json({ ok: true, data: data });
  } catch (e) {
    res.status(400).json({ ok: false, error: String((e && e.message) || e) });
  }
}
