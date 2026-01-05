import React, { useEffect, useState } from "react";

export default function ChoreHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/chores/history")
      .then(res => res.json())
      .then(data => {
        setHistory(data.history || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="admin__panel">Loading history...</div>;

  return (
    <div className="admin__panel">
      <h3>History Log</h3>
      {history.length === 0 ? (
        <p className="admin__muted">No history yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {history.map((entry, i) => (
            <div key={i} style={{ borderBottom: "1px solid #eee", paddingBottom: "16px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "8px" }}>{entry.date}</div>
              <div style={{ display: "grid", gap: "4px" }}>
                {entry.users.map((u, j) => (
                  <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                    <span>{u.name}</span>
                    <span>
                        {u.completed}/{u.total} ({Math.round((u.completed / (u.total || 1)) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
