'use strict';
const http    = require('node:http');
const crypto  = require('node:crypto');
const db      = require('./db');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('./crypto');

const PORT = process.env.PORT || 4000;

// ── CORS origins ─────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin or non-browser requests
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
    return ALLOWED_ORIGINS.includes(origin);
  } catch { return false; }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}

function getToken(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

function authenticate(req) {
  const token = getToken(req);
  if (!token) throw Object.assign(new Error('No token'), { status: 401 });
  try { return verifyToken(token); }
  catch (e) { throw Object.assign(new Error(e.message), { status: 401 }); }
}

function requireRole(user, ...roles) {
  if (!roles.includes(user.role))
    throw Object.assign(new Error('Insufficient permissions'), { status: 403 });
}

function audit(userId, action, targetId, detail) {
  db.prepare('INSERT INTO audit_log (user_id,action,target_id,detail) VALUES (?,?,?,?)')
    .run(userId, action, targetId || null, detail || null);
}

function buildAnnotation(row) {
  const d = JSON.parse(row.data || '{}');
  return { ...d, id: row.id, type: row.type, label: row.label, color: row.color,
           status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
           createdBy: row.created_by };
}

// ── Router ────────────────────────────────────────────────────────────────
const routes = [];

function route(method, pattern, handler) {
  routes.push({ method, pattern, handler });
}

function matchPath(pattern, pathname) {
  const pParts = pattern.split('/');
  const uParts = pathname.split('/');
  if (pParts.length !== uParts.length) return null;
  const params = {};
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) params[pParts[i].slice(1)] = uParts[i];
    else if (pParts[i] !== uParts[i]) return null;
  }
  return params;
}

// ── Auth routes ───────────────────────────────────────────────────────────

route('POST', '/api/auth/login', async (req, _params, res) => {
  const { email, password } = await readBody(req);
  if (!email || !password) return send(res, 400, { error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.password))
    return send(res, 401, { error: 'Invalid email or password' });

  audit(user.id, 'login');
  const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  return send(res, 200, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

route('GET', '/api/auth/me', async (req, _params, res) => {
  const me = authenticate(req);
  const user = db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(me.id);
  if (!user) return send(res, 404, { error: 'User not found' });
  return send(res, 200, { user });
});

route('POST', '/api/auth/logout', async (req, _params, res) => {
  const me = authenticate(req);
  audit(me.id, 'logout');
  return send(res, 200, { ok: true });
});

route('POST', '/api/auth/register', async (req, _params, res) => {
  const me = authenticate(req);
  requireRole(me, 'admin');
  const { name, email, password, role } = await readBody(req);
  if (!name || !email || !password || !role) return send(res, 400, { error: 'name, email, password, role required' });
  if (!['annotator','reviewer','admin'].includes(role)) return send(res, 400, { error: 'Invalid role' });
  const exists = db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase());
  if (exists) return send(res, 409, { error: 'Email already registered' });
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)')
    .run(id, name, email.toLowerCase(), hashPassword(password), role);
  audit(me.id, 'register_user', id);
  return send(res, 201, { user: { id, name, email: email.toLowerCase(), role } });
});

route('GET', '/api/auth/users', async (req, _params, res) => {
  const me = authenticate(req);
  requireRole(me, 'admin');
  const users = db.prepare('SELECT id,name,email,role,created_at FROM users ORDER BY created_at').all();
  return send(res, 200, { users });
});

route('PATCH', '/api/auth/users/:id', async (req, params, res) => {
  const me = authenticate(req);
  requireRole(me, 'admin');
  const { name, role, password } = await readBody(req);
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(params.id);
  if (!user) return send(res, 404, { error: 'User not found' });
  if (role && !['annotator','reviewer','admin'].includes(role)) return send(res, 400, { error: 'Invalid role' });
  const newName = name || user.name;
  const newRole = role || user.role;
  const newPass = password ? hashPassword(password) : user.password;
  db.prepare('UPDATE users SET name=?,role=?,password=?,updated_at=? WHERE id=?')
    .run(newName, newRole, newPass, Date.now(), user.id);
  audit(me.id, 'update_user', user.id);
  return send(res, 200, { user: { id: user.id, name: newName, email: user.email, role: newRole } });
});

route('DELETE', '/api/auth/users/:id', async (req, params, res) => {
  const me = authenticate(req);
  requireRole(me, 'admin');
  if (params.id === me.id) return send(res, 400, { error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id=?').run(params.id);
  audit(me.id, 'delete_user', params.id);
  return send(res, 200, { ok: true });
});

route('POST', '/api/auth/change-password', async (req, _params, res) => {
  const me = authenticate(req);
  const { currentPassword, newPassword } = await readBody(req);
  if (!currentPassword || !newPassword) return send(res, 400, { error: 'currentPassword and newPassword required' });
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(me.id);
  if (!verifyPassword(currentPassword, user.password)) return send(res, 401, { error: 'Current password incorrect' });
  db.prepare('UPDATE users SET password=?,updated_at=? WHERE id=?')
    .run(hashPassword(newPassword), Date.now(), me.id);
  audit(me.id, 'change_password');
  return send(res, 200, { ok: true });
});

// ── Annotation routes ─────────────────────────────────────────────────────

route('GET', '/api/annotations', async (req, _params, res) => {
  authenticate(req);
  const rows = db.prepare('SELECT * FROM annotations ORDER BY created_at DESC').all();
  return send(res, 200, { annotations: rows.map(buildAnnotation) });
});

route('POST', '/api/annotations', async (req, _params, res) => {
  const me = authenticate(req);
  requireRole(me, 'annotator', 'admin');
  const body = await readBody(req);
  const { type, label, color, status, id: bodyId, createdAt, updatedAt, createdBy, ...rest } = body;
  if (!type || !['peak','interval','bbox','polygon'].includes(type))
    return send(res, 400, { error: 'Valid type required' });
  const id = bodyId || crypto.randomUUID();
  const now = Date.now();
  db.prepare('INSERT OR REPLACE INTO annotations (id,type,label,color,status,data,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, type, label||null, color||null, status||null, JSON.stringify(rest), me.id, createdAt||now, updatedAt||now);
  audit(me.id, 'create_annotation', id);
  return send(res, 201, { annotation: buildAnnotation(db.prepare('SELECT * FROM annotations WHERE id=?').get(id)) });
});

route('POST', '/api/annotations/bulk', async (req, _params, res) => {
  const me = authenticate(req);
  requireRole(me, 'annotator', 'admin');
  const { annotations } = await readBody(req);
  if (!Array.isArray(annotations)) return send(res, 400, { error: 'annotations array required' });
  const stmt = db.prepare('INSERT OR REPLACE INTO annotations (id,type,label,color,status,data,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const ann of annotations) {
    const { id, type, label, color, status, createdAt, updatedAt, createdBy, ...rest } = ann;
    const safeId = id || crypto.randomUUID();
    const now = Date.now();
    stmt.run(safeId, type, label||null, color||null, status||null, JSON.stringify(rest), me.id, createdAt||now, updatedAt||now);
  }
  audit(me.id, 'bulk_save', null, `${annotations.length} annotations`);
  return send(res, 200, { ok: true, count: annotations.length });
});

route('PATCH', '/api/annotations/:id', async (req, params, res) => {
  const me = authenticate(req);
  const ann = db.prepare('SELECT * FROM annotations WHERE id=?').get(params.id);
  if (!ann) return send(res, 404, { error: 'Annotation not found' });
  const isOwner  = ann.created_by === me.id;
  const isAdmin  = me.role === 'admin';
  const isReviewer = me.role === 'reviewer';
  const body = await readBody(req);
  const { label, color, status, ...dataFields } = body;
  if (status !== undefined && !isReviewer && !isAdmin)
    return send(res, 403, { error: 'Only reviewers/admins can change status' });
  if ((label !== undefined || color !== undefined || Object.keys(dataFields).length > 0) && !isOwner && !isAdmin)
    return send(res, 403, { error: 'Only creator or admin can edit content' });
  const newLabel  = label  !== undefined ? label  : ann.label;
  const newColor  = color  !== undefined ? color  : ann.color;
  const newStatus = status !== undefined ? status : ann.status;
  const existingData = JSON.parse(ann.data || '{}');
  const newData = Object.keys(dataFields).length > 0 ? { ...existingData, ...dataFields } : existingData;
  const now = Date.now();
  db.prepare('UPDATE annotations SET label=?,color=?,status=?,data=?,updated_at=? WHERE id=?')
    .run(newLabel, newColor, newStatus, JSON.stringify(newData), now, ann.id);
  audit(me.id, 'update_annotation', ann.id, JSON.stringify({ label, color, status }));
  return send(res, 200, { annotation: buildAnnotation(db.prepare('SELECT * FROM annotations WHERE id=?').get(ann.id)) });
});

route('DELETE', '/api/annotations/all', async (req, _params, res) => {
  const me = authenticate(req);
  requireRole(me, 'admin');
  const count = db.prepare('SELECT COUNT(*) AS c FROM annotations').get().c;
  db.prepare('DELETE FROM annotations').run();
  audit(me.id, 'clear_all', null, `deleted ${count}`);
  return send(res, 200, { ok: true, deleted: count });
});

route('DELETE', '/api/annotations/:id', async (req, params, res) => {
  const me = authenticate(req);
  const ann = db.prepare('SELECT * FROM annotations WHERE id=?').get(params.id);
  if (!ann) return send(res, 404, { error: 'Annotation not found' });
  if (ann.created_by !== me.id && me.role !== 'admin')
    return send(res, 403, { error: 'Only creator or admin can delete' });
  db.prepare('DELETE FROM annotations WHERE id=?').run(params.id);
  audit(me.id, 'delete_annotation', params.id);
  return send(res, 200, { ok: true });
});

route('GET', '/api/annotations/audit', async (req, _params, res) => {
  const me = authenticate(req);
  requireRole(me, 'admin');
  const logs = db.prepare(`
    SELECT l.*, u.name AS user_name FROM audit_log l
    LEFT JOIN users u ON l.user_id = u.id
    ORDER BY l.ts DESC LIMIT 200
  `).all();
  return send(res, 200, { logs });
});

route('GET', '/api/health', async (_req, _params, res) => {
  return send(res, 200, { ok: true, time: new Date().toISOString() });
});

// ── HTTP server ───────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const origin = req.headers['origin'] || '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  for (const r of routes) {
    if (r.method !== req.method) continue;
    const params = matchPath(r.pattern, pathname);
    if (params !== null) {
      try {
        await r.handler(req, params, res);
      } catch (err) {
        const status = err.status || 500;
        send(res, status, { error: err.message || 'Internal server error' });
      }
      return;
    }
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`\n  🟣  BioAnnot API  →  http://localhost:${PORT}/api/health`);
  console.log(`      Login:        POST /api/auth/login`);
  console.log(`      Annotations:  GET  /api/annotations`);
  console.log(`      Node.js ${process.version}  |  SQLite built-in  |  Zero npm deps\n`);
});
