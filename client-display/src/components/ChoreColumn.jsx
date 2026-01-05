import React from "react";
import ChoreItem from "./ChoreItem.jsx";

export default function ChoreColumn({ user, onToggleChore }) {
  const completedCount = user.chores.filter(c => c.done).length;
  const totalCount = user.chores.length;
  const isDone = totalCount > 0 && completedCount === totalCount;

  return (
    <div className="chore-column">
      <div className="chore-header">
        <div 
          className="chore-avatar" 
          style={{ backgroundColor: user.color }}
        >
          {user.name.charAt(0)}
        </div>
        <h3 className="chore-name">{user.name}</h3>
        <span className="chore-progress">
            {completedCount}/{totalCount}
        </span>
      </div>
      <div className="chore-list">
        {user.chores.map(chore => (
          <ChoreItem 
            key={chore.id} 
            chore={chore} 
            color={user.color}
            onToggle={(choreId) => onToggleChore(user.id, choreId)} 
          />
        ))}
        {isDone && (
            <div style={{ textAlign: "center", padding: "20px", color: user.color, fontWeight: "bold" }}>
                ALL DONE! 🎉
            </div>
        )}
      </div>
    </div>
  );
}
