const { getDb } = require('../lib/db');

module.exports = function handler(req, res) {
  const db = getDb();

  if (req.method === 'GET') {
    const logs = db.prepare('SELECT * FROM symmetry_access_log ORDER BY id DESC LIMIT 50').all();
    return res.json(logs);
  }

  if (req.method === 'POST') {
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
    return res.status(201).json({ ...stubResponse, log });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
