require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Items CRUD ─────────────────────────────────────────────

app.get('/api/items', (_req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT * FROM items ORDER BY id ASC').all();
  res.json(items);
});

app.post('/api/items', (req, res) => {
  const db = getDb();
  const { kitter, wbs, po, priority, status, comments, date } = req.body;
  const result = db.prepare(
    'INSERT INTO items (kitter, wbs, po, priority, status, comments, date) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(kitter || '', wbs || '', po || '', priority || 'NORMAL', status || 'Pending', comments || '', date || new Date().toISOString().split('T')[0]);
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

app.put('/api/items/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { kitter, wbs, po, priority, status, comments, date } = req.body;
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  db.prepare(
    'UPDATE items SET kitter = ?, wbs = ?, po = ?, priority = ?, status = ?, comments = ?, date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(
    kitter ?? existing.kitter,
    wbs ?? existing.wbs,
    po ?? existing.po,
    priority ?? existing.priority,
    status ?? existing.status,
    comments ?? existing.comments,
    date ?? existing.date,
    id
  );

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json(updated);
});

app.delete('/api/items/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
  res.json({ success: true });
});

// ─── Chat Messages ──────────────────────────────────────────

app.get('/api/chat', (_req, res) => {
  const db = getDb();
  const messages = db.prepare('SELECT * FROM chat_messages ORDER BY id ASC').all();
  res.json(messages);
});

app.post('/api/chat', (req, res) => {
  const db = getDb();
  const { user, msg, time, agent, reply } = req.body;
  if (!user || !msg) return res.status(400).json({ error: 'user and msg are required' });
  const result = db.prepare(
    'INSERT INTO chat_messages (user, msg, time, agent, reply) VALUES (?, ?, ?, ?, ?)'
  ).run(user, msg, time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), agent || 'CORTEX', reply || 'Command received. Routing to agent. SAP sync in progress.');
  const message = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(message);
});

// ─── SAP Sync (Stub) ───────────────────────────────────────

app.get('/api/sap-sync', (_req, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM sap_sync_log ORDER BY id DESC LIMIT 50').all();
  res.json(logs);
});

app.post('/api/sap-sync', (req, res) => {
  const db = getDb();
  const { action, payload } = req.body;
  if (!action) return res.status(400).json({ error: 'action is required' });

  const sapEndpoint = process.env.SAP_ENDPOINT || 'https://sap.example.com/api/v1';
  const stubResponse = {
    status: 'accepted',
    sap_endpoint: sapEndpoint,
    transaction_id: `SAP-${Date.now()}`,
    message: `Stub: ${action} would be synced to SAP at ${sapEndpoint}`,
  };

  const result = db.prepare(
    'INSERT INTO sap_sync_log (action, payload, status, response) VALUES (?, ?, ?, ?)'
  ).run(action, JSON.stringify(payload || {}), 'synced', JSON.stringify(stubResponse));

  const log = db.prepare('SELECT * FROM sap_sync_log WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...stubResponse, log });
});

// ─── Symmetry Access Log (Stub) ────────────────────────────

app.get('/api/symmetry', (_req, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM symmetry_access_log ORDER BY id DESC LIMIT 50').all();
  res.json(logs);
});

app.post('/api/symmetry', (req, res) => {
  const db = getDb();
  const { user_id, action, resource, ip_address } = req.body;
  if (!action) return res.status(400).json({ error: 'action is required' });

  const symmetryEndpoint = process.env.SYMMETRY_ENDPOINT || 'https://symmetry.example.com/api/v1';
  const stubResponse = {
    status: 'logged',
    symmetry_endpoint: symmetryEndpoint,
    access_id: `SYM-${Date.now()}`,
    message: `Stub: Access event logged. Would sync to Symmetry at ${symmetryEndpoint}`,
  };

  const result = db.prepare(
    'INSERT INTO symmetry_access_log (user_id, action, resource, ip_address) VALUES (?, ?, ?, ?)'
  ).run(user_id || 'anonymous', action, resource || '', ip_address || '0.0.0.0');

  const log = db.prepare('SELECT * FROM symmetry_access_log WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...stubResponse, log });
});

// ─── Health Check ───────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', platform: 'EP44 Warehouse Intelligence Platform', timestamp: new Date().toISOString() });
});

// ─── Serve React Frontend (Production) ─────────────────────

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`EP44 Warehouse Intelligence Platform running on port ${PORT}`);
});
