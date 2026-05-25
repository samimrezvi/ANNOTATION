const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { signToken, requireAuth } = require('../auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user)
    return res.status(401).json({ error: 'Invalid email or password' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid)
    return res.status(401).json({ error: 'Invalid email or password' });

  db.prepare('INSERT INTO audit_log (user_id, action) VALUES (?, ?)').run(user.id, 'login');

  const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  return res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  db.prepare('INSERT INTO audit_log (user_id, action) VALUES (?, ?)').run(req.user.id, 'logout');
  return res.json({ ok: true });
});

// POST /api/auth/register — admin only
router.post('/register', requireAuth, (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin only' });

  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'name, email, password and role are required' });

  if (!['annotator', 'reviewer', 'admin'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, email.toLowerCase(), hash, role);

  db.prepare('INSERT INTO audit_log (user_id, action, target_id) VALUES (?, ?, ?)')
    .run(req.user.id, 'register_user', id);

  return res.status(201).json({ user: { id, name, email: email.toLowerCase(), role } });
});

// GET /api/auth/users — admin only
router.get('/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin only' });
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at').all();
  return res.json({ users });
});

// PATCH /api/auth/users/:id — admin only
router.patch('/users/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin only' });

  const { name, role, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (role && !['annotator', 'reviewer', 'admin'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });

  const newName = name || user.name;
  const newRole = role || user.role;
  const newPass = password ? bcrypt.hashSync(password, 10) : user.password;

  db.prepare('UPDATE users SET name=?, role=?, password=?, updated_at=? WHERE id=?')
    .run(newName, newRole, newPass, Date.now(), req.params.id);

  db.prepare('INSERT INTO audit_log (user_id, action, target_id) VALUES (?, ?, ?)')
    .run(req.user.id, 'update_user', req.params.id);

  return res.json({ user: { id: user.id, name: newName, email: user.email, role: newRole } });
});

// DELETE /api/auth/users/:id — admin only
router.delete('/users/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin only' });
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: 'Cannot delete yourself' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  db.prepare('INSERT INTO audit_log (user_id, action, target_id) VALUES (?, ?, ?)')
    .run(req.user.id, 'delete_user', req.params.id);
  return res.json({ ok: true });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'currentPassword and newPassword required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password))
    return res.status(401).json({ error: 'Current password incorrect' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password=?, updated_at=? WHERE id=?').run(hash, Date.now(), user.id);
  db.prepare('INSERT INTO audit_log (user_id, action) VALUES (?, ?)').run(user.id, 'change_password');
  return res.json({ ok: true });
});

module.exports = router;
