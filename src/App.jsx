import { useState, useRef, useEffect, useCallback } from "react";

const SE_GREEN = "#3DCD58";
const SE_GREEN_DARK = "#009530";
const SE_BORDER = "#E2E2E2";
const SE_TEXT = "#1A1A1A";
const SE_MUTED = "#9A9A9A";
const SE_BLUE = "#007AC9";
const SE_BG = "#FAFAFA";

const STATUS_COLORS = {
  "Pending":     "#9A9A9A",
  "In Progress": "#007AC9",
  "On Hold":     "#F57F17",
  "Complete":    "#009530",
  "OOS":         "#D32F2F",
  "Expedite":    "#7B1FA2",
};
const STATUS_OPTIONS = ["Pending", "In Progress", "On Hold", "Complete", "OOS", "Expedite"];
const PRIORITY_OPTIONS = ["LOW", "NORMAL", "HIGH", "CRITICAL"];
const PRIORITY_COLORS = { CRITICAL: "#D32F2F", HIGH: "#F57F17", NORMAL: "#007AC9", LOW: "#9A9A9A" };

const HASHTAGS = ["#Expedite","#OOS","#OutOfStock","#TransferOrder","#OnHold","#BackOrder","#SAPUpdate","#WIPComplete","#VerifyQty","#PriorityShip"];
const SLASH_CMDS = [
  { cmd: "/restock", desc: "Trigger restock order for a SKU" },
  { cmd: "/status", desc: "Query current item or line status" },
  { cmd: "/transfer", desc: "Initiate transfer order between warehouses" },
  { cmd: "/escalate", desc: "Escalate issue to supervisor + CORTEX" },
  { cmd: "/inspect", desc: "Flag item for QC inspection" },
  { cmd: "/dispatch", desc: "Mark kit as dispatched" },
  { cmd: "/hold", desc: "Place item on hold with reason" },
  { cmd: "/audit", desc: "Trigger SAP vs physical count audit" },
  { cmd: "/replenish", desc: "Auto-generate replenishment PO via SAP" },
];

const FALLBACK_ROWS = [
  { id: 1, kitter: "KIT-441-A", wbs: "EP44-2024-003", po: "PO-78412", priority: "HIGH",     status: "In Progress", comments: "#Expedite — awaiting MV panel", date: "2024-12-18" },
  { id: 2, kitter: "KIT-441-B", wbs: "EP44-2024-007", po: "PO-78519", priority: "CRITICAL",  status: "OOS",         comments: "#OOS #TransferOrder from WHB",  date: "2024-12-19" },
  { id: 3, kitter: "KIT-441-C", wbs: "EP44-2024-011", po: "PO-78601", priority: "NORMAL",    status: "Pending",     comments: "",                              date: "2024-12-20" },
  { id: 4, kitter: "KIT-442-A", wbs: "EP44-2024-014", po: "PO-78644", priority: "HIGH",      status: "On Hold",     comments: "#OnHold — SAP qty mismatch",    date: "2024-12-20" },
  { id: 5, kitter: "KIT-442-B", wbs: "EP44-2024-016", po: "PO-78701", priority: "NORMAL",    status: "Complete",    comments: "#WIPComplete dispatched 12/18", date: "2024-12-18" },
];

const FALLBACK_CHAT = [
  { id: 1, user: "Martinez, J.", msg: "/restock KIT-441-B qty:48",         time: "14:22", agent: "RACHEL",  reply: "PO-2024-7841 generated in SAP. ETA 2 days. Stock threshold updated." },
  { id: 2, user: "Okonkwo, T.",  msg: "/status EP44-2024-007",             time: "14:31", agent: "CADENCE", reply: "WBS EP44-2024-007: OOS. #TransferOrder active. SAP SO-88212 open." },
  { id: 3, user: "System",       msg: "/escalate KIT-441-B — no movement", time: "14:45", agent: "CORTEX",  reply: "Escalated to Procurement + Floor Lead. SAP ticket #INC-40012 opened." },
];

async function apiFetch(url, options) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch {
    return null;
  }
}

function Tag({ text }) {
  const color = text.startsWith("/") ? SE_GREEN_DARK : SE_BLUE;
  return (
    <span style={{ display: "inline-block", background: color + "12", color, border: `1px solid ${color}30`, borderRadius: 3, padding: "1px 6px", fontSize: 11, fontWeight: 600, marginRight: 4 }}>
      {text}
    </span>
  );
}

function renderWithTags(text) {
  if (!text) return null;
  const parts = text.split(/(#\w+|\/\w+)/g);
  return parts.map((p, i) =>
    (p.startsWith("#") || p.startsWith("/")) ? <Tag key={i} text={p} /> : <span key={i}>{p}</span>
  );
}

function InlineEdit({ value, onChange, type = "text" }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);
  if (!editing) return (
    <span onClick={() => setEditing(true)} style={{ cursor: "text", color: val ? SE_TEXT : SE_MUTED, fontSize: 13, minWidth: 40, display: "inline-block" }}>
      {val || <span style={{ color: SE_MUTED }}>—</span>}
    </span>
  );
  return (
    <input autoFocus value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { onChange(val); setEditing(false); }}
      onKeyDown={e => e.key === "Enter" && e.target.blur()}
      style={{ border: `1px solid ${SE_GREEN}`, borderRadius: 3, padding: "2px 6px", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", color: SE_TEXT }} />
  );
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [chat, setChat] = useState([]);
  const [tab, setTab] = useState("tracker");
  const [input, setInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [menuType, setMenuType] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const chatBottom = useRef(null);

  // Load data from API on mount
  useEffect(() => {
    async function load() {
      const [itemsData, chatData] = await Promise.all([
        apiFetch("/api/items"),
        apiFetch("/api/chat"),
      ]);
      setRows(itemsData || FALLBACK_ROWS);
      setChat(chatData || FALLBACK_CHAT);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const updateRow = useCallback(async (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    const row = rows.find(r => r.id === id);
    if (row) {
      apiFetch(`/api/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...row, [field]: value }),
      });
    }
  }, [rows]);

  const addRow = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const newItem = { kitter: "", wbs: "", po: "", priority: "NORMAL", status: "Pending", comments: "", date: today };
    const created = await apiFetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
    });
    if (created) {
      setRows(prev => [...prev, created]);
    } else {
      setRows(prev => [...prev, { id: Date.now(), ...newItem }]);
    }
  }, []);

  const deleteRow = useCallback(async (id) => {
    setRows(prev => prev.filter(r => r.id !== id));
    apiFetch(`/api/items/${id}`, { method: "DELETE" });
  }, []);

  const filteredRows = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [r.kitter, r.wbs, r.po, r.status, r.comments, r.priority].some(v => v?.toLowerCase().includes(s));
  });

  const handleInput = (e) => {
    const v = e.target.value;
    setInput(v);
    if (v.endsWith("/") || (v.includes("/") && !v.includes(" "))) { setShowMenu(true); setMenuType("slash"); }
    else if (v.endsWith("#")) { setShowMenu(true); setMenuType("hash"); }
    else setShowMenu(false);
  };

  const insertTag = (tag) => { setInput(prev => prev.replace(/[/#]\w*$/, "") + tag + " "); setShowMenu(false); };

  const sendChat = async (e) => {
    if (e.key === "Enter" && input.trim()) {
      const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      const payload = {
        user: "Celaya, C.",
        msg: input.trim(),
        time,
        agent: "CORTEX",
        reply: "Command received. Routing to agent. SAP sync in progress.",
      };
      const created = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setChat(prev => [...prev, created || { id: Date.now(), ...payload }]);
      setInput(""); setShowMenu(false);
    }
  };

  const TABS = ["tracker", "chat", "reference"];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: SE_BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 4, height: 40, background: SE_GREEN, borderRadius: 2, margin: "0 auto 16px" }} />
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1.5, color: SE_GREEN_DARK }}>SCHNEIDER ELECTRIC</div>
          <div style={{ fontSize: 12, color: SE_MUTED, marginTop: 4 }}>Loading EP44 Platform...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: SE_BG, fontFamily: "'Segoe UI', Arial, sans-serif", color: SE_TEXT }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: `3px solid ${SE_GREEN}`, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 4, height: 40, background: SE_GREEN, borderRadius: 2 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1.5, color: SE_GREEN_DARK }}>SCHNEIDER ELECTRIC</div>
            <div style={{ fontSize: 11, color: SE_MUTED, letterSpacing: 1 }}>EP44 · Warehouse Intelligence Platform</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: SE_GREEN }} />
            <span style={{ fontSize: 11, color: SE_GREEN_DARK, fontWeight: 600 }}>CORTEX LIVE</span>
          </div>
          <div style={{ fontSize: 11, color: SE_MUTED }}>SAP · Symmetry Connected</div>
          <div style={{ fontSize: 12, color: SE_TEXT, fontWeight: 500 }}>Celaya, C.</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${SE_BORDER}`, display: "flex", padding: "0 32px" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "14px 20px 12px",
            fontSize: 13, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? SE_GREEN_DARK : SE_MUTED,
            borderBottom: tab === t ? `2px solid ${SE_GREEN}` : "2px solid transparent",
            marginBottom: -1, textTransform: "capitalize", fontFamily: "inherit",
          }}>{t}</button>
        ))}
      </div>

      {/* TRACKER TAB */}
      {tab === "tracker" && (
        <div style={{ padding: 32 }}>
          {/* Toolbar */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by Kitter, WBS, PO, status, #hashtag…"
              style={{ flex: 1, maxWidth: 360, border: `1px solid ${SE_BORDER}`, borderRadius: 6, padding: "8px 14px", fontSize: 13, outline: "none", fontFamily: "inherit", color: SE_TEXT }} />
            <button onClick={addRow} style={{ background: SE_GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Add Row</button>
            <button style={{ background: "#fff", color: SE_BLUE, border: `1px solid ${SE_BLUE}`, borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>↑ Export SAP</button>
          </div>

          {/* Table */}
          <div style={{ background: "#fff", border: `1px solid ${SE_BORDER}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F5F7F5", borderBottom: `2px solid ${SE_BORDER}` }}>
                  {["Kitter", "WBS", "PO", "Priority", "Status", "Comments", "Date", ""].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: SE_MUTED, letterSpacing: 1, whiteSpace: "nowrap" }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr key={row.id} style={{ borderBottom: `1px solid ${SE_BORDER}`, background: idx % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                    <td style={{ padding: "10px 16px", minWidth: 110 }}>
                      <InlineEdit value={row.kitter} onChange={v => updateRow(row.id, "kitter", v)} />
                    </td>
                    <td style={{ padding: "10px 16px", minWidth: 130 }}>
                      <InlineEdit value={row.wbs} onChange={v => updateRow(row.id, "wbs", v)} />
                    </td>
                    <td style={{ padding: "10px 16px", minWidth: 110 }}>
                      <InlineEdit value={row.po} onChange={v => updateRow(row.id, "po", v)} />
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <select value={row.priority} onChange={e => updateRow(row.id, "priority", e.target.value)}
                        style={{ border: "none", background: "transparent", fontSize: 13, fontWeight: 600, color: PRIORITY_COLORS[row.priority], cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                        {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <select value={row.status} onChange={e => updateRow(row.id, "status", e.target.value)}
                        style={{ border: `1px solid ${SE_BORDER}`, borderRadius: 4, padding: "3px 8px", fontSize: 12, fontWeight: 500, color: STATUS_COLORS[row.status], cursor: "pointer", fontFamily: "inherit", background: "#fff", outline: "none" }}>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "10px 16px", minWidth: 220 }}>
                      <div style={{ fontSize: 13 }}>{renderWithTags(row.comments)}</div>
                      <InlineEdit value={row.comments} onChange={v => updateRow(row.id, "comments", v)} />
                    </td>
                    <td style={{ padding: "10px 16px", minWidth: 120 }}>
                      <InlineEdit value={row.date} onChange={v => updateRow(row.id, "date", v)} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button onClick={() => deleteRow(row.id)} style={{ background: "none", border: "none", color: SE_MUTED, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRows.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: SE_MUTED, fontSize: 13 }}>No results for &quot;{search}&quot;</div>
            )}
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: SE_MUTED }}>{filteredRows.length} of {rows.length} items · Click any cell to edit · Use #hashtags in Comments to tag and filter</div>
        </div>
      )}

      {/* CHAT TAB */}
      {tab === "chat" && (
        <div style={{ padding: 32, maxWidth: 860, margin: "0 auto" }}>
          <div style={{ background: "#fff", border: `1px solid ${SE_BORDER}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            {/* Channel header */}
            <div style={{ padding: "14px 24px", borderBottom: `1px solid ${SE_BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>EP44 · Warehouse Command Channel</span>
                <span style={{ marginLeft: 12, fontSize: 11, color: SE_MUTED }}>Use /commands and #hashtags · All actions sync to SAP + CORTEX</span>
              </div>
              <div style={{ fontSize: 11, color: SE_GREEN_DARK, fontWeight: 600 }}>● Live</div>
            </div>

            {/* Messages */}
            <div style={{ padding: "20px 24px", minHeight: 380, maxHeight: 420, overflowY: "auto" }}>
              {chat.map(msg => (
                <div key={msg.id} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: SE_GREEN + "20", border: `1px solid ${SE_GREEN}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: SE_GREEN_DARK, flexShrink: 0 }}>
                      {msg.user === "System" ? "SYS" : msg.user.split(",")[0].slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{msg.user}</span>
                        <span style={{ fontSize: 11, color: SE_MUTED }}>{msg.time}</span>
                      </div>
                      <div style={{ background: SE_BG, border: `1px solid ${SE_BORDER}`, borderRadius: 6, padding: "8px 14px", fontSize: 13, marginBottom: 6, fontFamily: "monospace" }}>
                        {renderWithTags(msg.msg)}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: SE_MUTED, background: "#F0F0F0", padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>↳ {msg.agent}</span>
                        <span style={{ fontSize: 12, color: SE_MUTED }}>{msg.reply}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatBottom} />
            </div>

            {/* Input */}
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${SE_BORDER}`, position: "relative" }}>
              {showMenu && (
                <div style={{ position: "absolute", bottom: 70, left: 24, background: "#fff", border: `1px solid ${SE_BORDER}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: 8, zIndex: 10, minWidth: 300 }}>
                  {menuType === "slash" && SLASH_CMDS.map(c => (
                    <div key={c.cmd} onClick={() => insertTag(c.cmd)}
                      style={{ padding: "8px 12px", cursor: "pointer", borderRadius: 4, display: "flex", gap: 12, alignItems: "center" }}
                      onMouseEnter={e => e.currentTarget.style.background = SE_BG}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: SE_GREEN_DARK, fontSize: 13 }}>{c.cmd}</span>
                      <span style={{ fontSize: 12, color: SE_MUTED }}>{c.desc}</span>
                    </div>
                  ))}
                  {menuType === "hash" && HASHTAGS.map(h => (
                    <div key={h} onClick={() => insertTag(h)}
                      style={{ padding: "8px 12px", cursor: "pointer", borderRadius: 4 }}
                      onMouseEnter={e => e.currentTarget.style.background = SE_BG}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: SE_BLUE, fontSize: 13 }}>{h}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <input value={input} onChange={handleInput} onKeyDown={sendChat}
                  placeholder="Type / for commands  ·  Type # for hashtags  ·  Enter to send"
                  style={{ flex: 1, border: `1px solid ${SE_BORDER}`, borderRadius: 6, padding: "10px 16px", fontSize: 13, fontFamily: "monospace", outline: "none", color: SE_TEXT }} />
                <button onClick={() => sendChat({ key: "Enter" })}
                  style={{ background: SE_GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "0 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Send</button>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["/restock","/status","/transfer","/escalate","/hold"].map(c => (
                  <button key={c} onClick={() => setInput(c + " ")}
                    style={{ background: SE_GREEN + "12", color: SE_GREEN_DARK, border: `1px solid ${SE_GREEN}30`, borderRadius: 4, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "monospace" }}>{c}</button>
                ))}
                {["#Expedite","#OOS","#TransferOrder"].map(h => (
                  <button key={h} onClick={() => setInput(prev => prev + h + " ")}
                    style={{ background: SE_BLUE + "12", color: SE_BLUE, border: `1px solid ${SE_BLUE}30`, borderRadius: 4, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "monospace" }}>{h}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REFERENCE TAB */}
      {tab === "reference" && (
        <div style={{ padding: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 900 }}>
          <div style={{ background: "#fff", border: `1px solid ${SE_BORDER}`, borderRadius: 8, padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: SE_GREEN_DARK, letterSpacing: 1, marginBottom: 16 }}>SLASH COMMANDS</div>
            {SLASH_CMDS.map(c => (
              <div key={c.cmd} style={{ marginBottom: 12 }}>
                <code style={{ color: SE_GREEN_DARK, fontWeight: 700, fontSize: 13 }}>{c.cmd}</code>
                <div style={{ fontSize: 12, color: SE_MUTED, marginTop: 2 }}>{c.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#fff", border: `1px solid ${SE_BORDER}`, borderRadius: 8, padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: SE_BLUE, letterSpacing: 1, marginBottom: 16 }}>HASHTAGS — SEARCHABLE LABELS</div>
            <p style={{ fontSize: 12, color: SE_MUTED, marginBottom: 16, lineHeight: 1.6 }}>Add hashtags to Comments on any row. Use the search bar in Tracker to filter all items by hashtag instantly. Multiple hashtags per row supported.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {HASHTAGS.map(h => (
                <span key={h} style={{ background: SE_BLUE + "12", color: SE_BLUE, border: `1px solid ${SE_BLUE}30`, borderRadius: 4, padding: "4px 10px", fontSize: 12, fontWeight: 600, fontFamily: "monospace" }}>{h}</span>
              ))}
            </div>
            <div style={{ marginTop: 24, fontSize: 13, fontWeight: 700, color: SE_MUTED, letterSpacing: 1, marginBottom: 12 }}>INTEGRATIONS</div>
            {["SAP — PO, SO, stock sync", "Symmetry — access + audit logs", "MS Teams — command channel mirror", "CORTEX — agent orchestration"].map(i => (
              <div key={i} style={{ fontSize: 12, color: SE_MUTED, marginBottom: 8, display: "flex", gap: 8 }}>
                <span style={{ color: SE_GREEN }}>✓</span>{i}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: "16px 32px", borderTop: `1px solid ${SE_BORDER}`, marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
        <div style={{ fontSize: 11, color: SE_MUTED }}>Schneider Electric EP44 · Warehouse Intelligence Platform</div>
        <div style={{ fontSize: 11, color: SE_MUTED }}>Built by <span style={{ color: SE_GREEN_DARK, fontWeight: 600 }}>Celaya Solutions</span></div>
      </div>
    </div>
  );
}
