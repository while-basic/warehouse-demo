const { getDb } = require('../lib/db');

module.exports = function handler(req, res) {
  const db = getDb();

  if (req.method === 'GET') {
    const items = db.prepare('SELECT * FROM items ORDER BY id ASC').all();
    return res.json(items);
  }

  if (req.method === 'POST') {
    const { kitter, wbs, po, priority, status, comments, date } = req.body;
    const result = db.prepare(
      'INSERT INTO items (kitter, wbs, po, priority, status, comments, date) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(kitter || '', wbs || '', po || '', priority || 'NORMAL', status || 'Pending', comments || '', date || new Date().toISOString().split('T')[0]);
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(item);
  }

  if (req.method === 'PUT') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id query parameter required' });
    const { kitter, wbs, po, priority, status, comments, date } = req.body;
    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    db.prepare(
      'UPDATE items SET kitter = ?, wbs = ?, po = ?, priority = ?, status = ?, comments = ?, date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(
      kitter ?? existing.kitter, wbs ?? existing.wbs, po ?? existing.po,
      priority ?? existing.priority, status ?? existing.status,
      comments ?? existing.comments, date ?? existing.date, id
    );
    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    return res.json(updated);
  }

  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id query parameter required' });
    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Item not found' });
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    return res.json({ success: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
};
