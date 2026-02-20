const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.VERCEL
  ? '/tmp/warehouse.db'
  : path.join(__dirname, '..', 'data', 'warehouse.db');

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let db;

function getDb() {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kitter TEXT DEFAULT '',
      wbs TEXT DEFAULT '',
      po TEXT DEFAULT '',
      priority TEXT DEFAULT 'NORMAL',
      status TEXT DEFAULT 'Pending',
      comments TEXT DEFAULT '',
      date TEXT DEFAULT (date('now')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT NOT NULL,
      msg TEXT NOT NULL,
      time TEXT NOT NULL,
      agent TEXT DEFAULT 'CORTEX',
      reply TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sap_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      payload TEXT,
      status TEXT DEFAULT 'pending',
      response TEXT,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS symmetry_access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action TEXT NOT NULL,
      resource TEXT,
      ip_address TEXT,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seed(db);
  return db;
}

function seed(db) {
  const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM items').get();
  if (cnt > 0) return;

  const insertItem = db.prepare(
    'INSERT INTO items (kitter, wbs, po, priority, status, comments, date) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const items = [
    ['KIT-441-A', 'EP44-2024-003', 'PO-78412', 'HIGH', 'In Progress', '#Expedite — awaiting MV panel', '2024-12-18'],
    ['KIT-441-B', 'EP44-2024-007', 'PO-78519', 'CRITICAL', 'OOS', '#OOS #TransferOrder from WHB', '2024-12-19'],
    ['KIT-441-C', 'EP44-2024-011', 'PO-78601', 'NORMAL', 'Pending', '', '2024-12-20'],
    ['KIT-442-A', 'EP44-2024-014', 'PO-78644', 'HIGH', 'On Hold', '#OnHold — SAP qty mismatch', '2024-12-20'],
    ['KIT-442-B', 'EP44-2024-016', 'PO-78701', 'NORMAL', 'Complete', '#WIPComplete dispatched 12/18', '2024-12-18'],
  ];

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insertItem.run(...row);
  });
  insertMany(items);

  const insertChat = db.prepare(
    'INSERT INTO chat_messages (user, msg, time, agent, reply) VALUES (?, ?, ?, ?, ?)'
  );

  const messages = [
    ['Martinez, J.', '/restock KIT-441-B qty:48', '14:22', 'RACHEL', 'PO-2024-7841 generated in SAP. ETA 2 days. Stock threshold updated.'],
    ['Okonkwo, T.', '/status EP44-2024-007', '14:31', 'CADENCE', 'WBS EP44-2024-007: OOS. #TransferOrder active. SAP SO-88212 open.'],
    ['System', '/escalate KIT-441-B — no movement', '14:45', 'CORTEX', 'Escalated to Procurement + Floor Lead. SAP ticket #INC-40012 opened.'],
  ];

  const insertMsgs = db.transaction((rows) => {
    for (const row of rows) insertChat.run(...row);
  });
  insertMsgs(messages);
}

module.exports = { getDb };
