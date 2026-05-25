const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

// All annotation routes require authentication
router.use(requireAuth);

// GET /api/annotations — fetch all annotations
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, u.name as created_by_name, u.email as created_by_email
    FROM annotations a
    LEFT JOIN users u ON a.created_by = u.id
    ORDER BY a.created_at DESC
  `).all();

  const annotations = rows.map(row => ({
    ...JSON.parse(row.data),
    id: row.id,
    type: row.type,
    label: row.label,
    color: row.color,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: { id: row.created_by, name: row.created_by_name, email: row.created_by_email },
  }));

  return res.json({ annotations });
});

// POST /api/annotations — create one annotation
router.post('/', requireRole('annotator', 'admin'), (req, res) => {
  const { type, label, color, status, ...rest } = req.body;

  if (!type || !['peak', 'interval', 'bbox', 'polygon'].includes(type))
    return res.status(400).json({ error: 'Valid type required' });

  const id = uuidv4();
  const now = Date.now();
  const data = JSON.stringify(rest);

  db.prepare(`
    INSERT INTO annotations (id, type, label, color, status, data, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, label || null, color || null, status || null, data, req.user.id, now, now);

  db.prepare('INSERT INTO audit_log (user_id, action, target_id) VALUES (?, ?, ?)')
    .run(req.user.id, 'create_annotation', id);

  const row = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id);
  return res.status(201).json({ annotation: buildAnnotation(row) });
});

// POST /api/annotations/bulk — replace all annotations in one request (for sync)
router.post('/bulk', requireRole('annotator', 'admin'), (req, res) => {
  const { annotations } = req.body;
  if (!Array.isArray(annotations))
    return res.status(400).json({ error: 'annotations array required' });

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO annotations (id, type, label, color, status, data, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((anns) => {
    for (const ann of anns) {
      const { id, type, label, color, status, createdAt, updatedAt, ...rest } = ann;
      const safeId = id || uuidv4();
      const now = Date.now();
      insertStmt.run(
        safeId, type, label || null, color || null, status || null,
        JSON.stringify(rest), req.user.id,
        createdAt || now, updatedAt || now
      );
    }
  });

  insertMany(annotations);

  db.prepare('INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)')
    .run(req.user.id, 'bulk_save', `${annotations.length} annotations`);

  return res.json({ ok: true, count: annotations.length });
});

// PATCH /api/annotations/:id — update label, color, or status
router.patch('/:id', (req, res) => {
  const ann = db.prepare('SELECT * FROM annotations WHERE id = ?').get(req.params.id);
  if (!ann) return res.status(404).json({ error: 'Annotation not found' });

  // Only owner or admin can edit content; reviewer can only change status
  const isOwner = ann.created_by === req.user.id;
  const isAdmin = req.user.role === 'admin';
  const isReviewer = req.user.role === 'reviewer';

  const { label, color, status, ...dataFields } = req.body;

  if (status !== undefined && !isReviewer && !isAdmin)
    return res.status(403).json({ error: 'Only reviewers and admins can change status' });

  if ((label !== undefined || color !== undefined || Object.keys(dataFields).length > 0)
      && !isOwner && !isAdmin)
    return res.status(403).json({ error: 'Only the creator or admin can edit annotation content' });

  if (status && !['approved', 'rejected'].includes(status))
    return res.status(400).json({ error: 'status must be approved or rejected' });

  const newLabel  = label  !== undefined ? label  : ann.label;
  const newColor  = color  !== undefined ? color  : ann.color;
  const newStatus = status !== undefined ? status : ann.status;

  // Merge data fields if provided
  const existingData = JSON.parse(ann.data);
  const newData = Object.keys(dataFields).length > 0
    ? { ...existingData, ...dataFields }
    : existingData;

  const now = Date.now();
  db.prepare(`
    UPDATE annotations SET label=?, color=?, status=?, data=?, updated_at=? WHERE id=?
  `).run(newLabel, newColor, newStatus, JSON.stringify(newData), now, ann.id);

  db.prepare('INSERT INTO audit_log (user_id, action, target_id, detail) VALUES (?, ?, ?, ?)')
    .run(req.user.id, 'update_annotation', ann.id, JSON.stringify({ label, color, status }));

  const updated = db.prepare('SELECT * FROM annotations WHERE id = ?').get(ann.id);
  return res.json({ annotation: buildAnnotation(updated) });
});

// DELETE /api/annotations/:id
router.delete('/:id', (req, res) => {
  const ann = db.prepare('SELECT * FROM annotations WHERE id = ?').get(req.params.id);
  if (!ann) return res.status(404).json({ error: 'Annotation not found' });

  const isOwner = ann.created_by === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin)
    return res.status(403).json({ error: 'Only creator or admin can delete' });

  db.prepare('DELETE FROM annotations WHERE id = ?').run(req.params.id);
  db.prepare('INSERT INTO audit_log (user_id, action, target_id) VALUES (?, ?, ?)')
    .run(req.user.id, 'delete_annotation', req.params.id);

  return res.json({ ok: true });
});

// DELETE /api/annotations — clear all (admin only)
router.delete('/', requireRole('admin'), (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM annotations').get().c;
  db.prepare('DELETE FROM annotations').run();
  db.prepare('INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)')
    .run(req.user.id, 'clear_all_annotations', `Deleted ${count} annotations`);
  return res.json({ ok: true, deleted: count });
});

// GET /api/annotations/audit — admin only — audit log
router.get('/audit', requireRole('admin'), (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, u.name as user_name, u.email as user_email
    FROM audit_log l LEFT JOIN users u ON l.user_id = u.id
    ORDER BY l.ts DESC LIMIT 200
  `).all();
  return res.json({ logs: rows });
});

function buildAnnotation(row) {
  return {
    ...JSON.parse(row.data),
    id: row.id,
    type: row.type,
    label: row.label,
    color: row.color,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

module.exports = router;
