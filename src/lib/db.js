// @bolo-db-scaffold
// Helper database aplikasi.
// - Preview: memanggil /builder/preview-db/<threadId> (proxy BOLO; token di server).
// - Produksi: memanggil /api/db (Vercel Function; token Turso aman di server).
// - Fallback lokal (mis. cek headless/offline): localStorage.
// Dimuat sebagai script biasa dari index.html; pakai global window.BOLO_DB.
var BOLO_APP_API = (typeof window !== 'undefined' && window.__APP_API__) || null;
var BOLO_HOST = (typeof location !== 'undefined' && location.hostname) || '';
var BOLO_IS_LOCAL = BOLO_HOST === '' || BOLO_HOST === 'localhost' || BOLO_HOST === '127.0.0.1' || BOLO_HOST === '0.0.0.0';
var BOLO_DB_API = BOLO_APP_API || (BOLO_IS_LOCAL ? null : '/api/db');
const LS_PREFIX = 'appdb:';

function lsAll(table) {
  try { return JSON.parse(localStorage.getItem(LS_PREFIX + table) || '[]'); } catch (e) { return []; }
}
function lsSave(table, rows) { localStorage.setItem(LS_PREFIX + table, JSON.stringify(rows)); }
function nextId(rows) {
  return rows.reduce(function (m, r) { return Math.max(m, Number(r.id) || 0); }, 0) + 1;
}

async function tryApi(table, action, params) {
  const res = await fetch(BOLO_DB_API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ table: table, action: action, params: params || {} }),
  });
  if (!res.ok) throw new Error('api ' + res.status);
  const data = await res.json();
  if (!data || data.ok === false) throw new Error((data && data.error) || 'gagal');
  return data.data;
}

function localCall(table, action, params) {
  const rows = lsAll(table);
  const p = params || {};
  // primary key local: `id` umum; tabel progress pakai `video_id`
  const pk = p && p.video_id !== undefined ? 'video_id' : 'id';
  const pkVal = function () { return p.video_id !== undefined ? p.video_id : p.id; };
  if (action === 'list') return { rows: rows };
  if (action === 'insert') {
    const row = Object.assign({}, p, p.id === undefined ? { id: nextId(rows) } : {});
    rows.push(row); lsSave(table, rows);
    return { changes: 1, id: row.id !== undefined ? row.id : row.video_id };
  }
  if (action === 'update') {
    let n = 0;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][pk]) === String(pkVal())) { rows[i] = Object.assign({}, rows[i], p); n++; }
    }
    lsSave(table, rows);
    return { changes: n };
  }
  if (action === 'delete' || action === 'remove') {
    const before = rows.length;
    const kept = rows.filter(function (r) { return String(r[pk]) !== String(pkVal()); });
    lsSave(table, kept);
    return { changes: before - kept.length };
  }
  throw new Error('aksi tidak dikenal: ' + action);
}

let mode = null;
async function call(table, action, params) {
  if (!BOLO_DB_API || mode === 'local') {
    if (mode === null) mode = 'local';
    return localCall(table, action, params);
  }
  try {
    const out = await tryApi(table, action, params);
    mode = 'api';
    return out;
  } catch (e) {
    if (mode === 'api') throw e;
    mode = 'local';
    return localCall(table, action, params);
  }
}

window.BOLO_DB = {
  list: function (t) { return call(t, 'list'); },
  insert: function (t, v) { return call(t, 'insert', v); },
  update: function (t, v) { return call(t, 'update', v); },
  remove: function (t, id) { return call(t, 'remove', { id: id }); },
};
