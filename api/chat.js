const { getDb } = require('../lib/db');

module.exports = function handler(req, res) {
  const db = getDb();

  if (req.method === 'GET') {
    const messages = db.prepare('SELECT * FROM chat_messages ORDER BY id ASC').all();
    return res.json(messages);
  }

  if (req.method === 'POST') {
    const { user, msg, time, agent, reply } = req.body;
    if (!user || !msg) return res.status(400).json({ error: 'user and msg are required' });

    const result = db.prepare(
      'INSERT INTO chat_messages (user, msg, time, agent, reply) VALUES (?, ?, ?, ?, ?)'
    ).run(
      user, msg,
      time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      agent || 'CORTEX',
      reply || 'Command received. Routing to agent. SAP sync in progress.'
    );
    const message = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(message);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
