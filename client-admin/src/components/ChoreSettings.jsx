import React, { useState } from "react";

export default function ChoreSettings({ data, onSave }) {
  const [localData, setLocalData] = useState(data || { users: [] });
  const [newUser, setNewUser] = useState("");
  const [newColor, setNewColor] = useState("#ff6b6b");
  const [newTasks, setNewTasks] = useState({}); // Map of userId -> task label

  const addUser = () => {
    if (!newUser.trim()) return;
    const user = {
      id: `u_${Date.now()}`,
      name: newUser.trim(),
      color: newColor,
      chores: []
    };
    const next = { ...localData, users: [...localData.users, user] };
    setLocalData(next);
    onSave(next);
    setNewUser("");
  };

  const removeUser = (userId) => {
    if (!confirm("Remove this user and all their tasks?")) return;
    const next = { ...localData, users: localData.users.filter(u => u.id !== userId) };
    setLocalData(next);
    onSave(next);
  };

  const addTask = (userId) => {
    const label = newTasks[userId];
    if (!label?.trim()) return;
    
    const next = {
      ...localData,
      users: localData.users.map(u => {
        if (u.id !== userId) return u;
        return {
          ...u,
          chores: [...u.chores, { id: `c_${Date.now()}`, label: label.trim(), done: false }]
        };
      })
    };
    setLocalData(next);
    onSave(next);
    setNewTasks({ ...newTasks, [userId]: "" });
  };

  const removeTask = (userId, choreId) => {
    const next = {
      ...localData,
      users: localData.users.map(u => {
        if (u.id !== userId) return u;
        return {
          ...u,
          chores: u.chores.filter(c => c.id !== choreId)
        };
      })
    };
    setLocalData(next);
    onSave(next);
  };

  return (
    <div className="admin__panel">
      <h3>Chore Management</h3>
      <div className="admin__grid">
        <div className="admin__field-group">
          <h4>Add Person</h4>
          <div style={{ display: "flex", gap: "8px" }}>
            <input 
              type="text" 
              placeholder="Name" 
              value={newUser}
              onChange={e => setNewUser(e.target.value)}
            />
            <input 
              type="color" 
              value={newColor}
              onChange={e => setNewColor(e.target.value)}
            />
            <button className="admin__primary" onClick={addUser}>Add</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "24px", display: "grid", gap: "24px" }}>
        {localData.users.map(user => (
          <div key={user.id} style={{ border: "1px solid #ddd", padding: "16px", borderRadius: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: user.color }} />
                <strong>{user.name}</strong>
              </div>
              <button className="admin__ghost" style={{ color: "red" }} onClick={() => removeUser(user.id)}>Remove</button>
            </div>
            
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0", display: "grid", gap: "8px" }}>
              {user.chores.map(chore => (
                <li key={chore.id} style={{ display: "flex", justifyContent: "space-between", background: "#f5f5f5", padding: "8px", borderRadius: "4px" }}>
                  <span>{chore.label}</span>
                  <button 
                    style={{ border: "none", background: "none", cursor: "pointer", fontSize: "16px" }}
                    onClick={() => removeTask(user.id, chore.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            <div style={{ display: "flex", gap: "8px" }}>
              <input 
                type="text" 
                placeholder="New Task..." 
                value={newTasks[user.id] || ""}
                onChange={e => setNewTasks({ ...newTasks, [user.id]: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && addTask(user.id)}
              />
              <button className="admin__primary" onClick={() => addTask(user.id)}>+</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
