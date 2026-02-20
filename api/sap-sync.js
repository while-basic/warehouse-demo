const { getDb } = require('../lib/db');

module.exports = function handler(req, res) {
  const db = getDb();

  if (req.method === 'GET') {
    const logs = db.prepare('SELECT * FROM sap_sync_log ORDER BY id DESC LIMIT 50').all();
    return res.json(logs);
  }

  if (req.method === 'POST') {
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
    return res.status(201).json({ ...stubResponse, log });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
