import React, { useEffect, useState } from "react";
import ChoreColumn from "./ChoreColumn.jsx";
import Confetti from "./Confetti.jsx";

export default function ChoreView() {
  const [data, setData] = useState({ users: [] });
  const [showConfetti, setShowConfetti] = useState(false);
  
  const loadChores = async () => {
    try {
      const res = await fetch("/api/chores");
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to load chores", err);
    }
  };

  useEffect(() => {
    loadChores();
    // Poll for updates (e.g. midnight reset or admin changes)
    const interval = setInterval(loadChores, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async (userId, choreId) => {
    // Optimistic update
    const prevData = { ...data };
    const nextUsers = data.users.map(u => {
      if (u.id !== userId) return u;
      return {
        ...u,
        chores: u.chores.map(c => {
          if (c.id !== choreId) return c;
          return { ...c, done: !c.done };
        })
      };
    });
    
    setData({ users: nextUsers });

    // Check for completion to trigger confetti
    const userBefore = prevData.users.find(u => u.id === userId);
    const userAfter = nextUsers.find(u => u.id === userId);
    
    const wasDone = userBefore.chores.every(c => c.done);
    const isDone = userAfter.chores.every(c => c.done);
    
    if (!wasDone && isDone && userAfter.chores.length > 0) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
    }

    try {
      await fetch(`/api/chores/${userId}/${choreId}/toggle`, { method: "POST" });
    } catch (err) {
      console.error("Toggle failed", err);
      // Revert on failure
      setData(prevData);
    }
  };

  if (!data.users.length) {
    return (
      <div className="display__panel" style={{ display: "grid", placeItems: "center" }}>
        <p className="display__muted">No chore profiles set up. Use Admin panel to configure.</p>
      </div>
    );
  }

  return (
    <div className="chore-grid">
      <Confetti active={showConfetti} />
      {data.users.map(user => (
        <ChoreColumn 
          key={user.id} 
          user={user} 
          onToggleChore={handleToggle} 
        />
      ))}
    </div>
  );
}
