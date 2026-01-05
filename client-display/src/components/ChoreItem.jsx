import React from "react";

export default function ChoreItem({ chore, color, onToggle }) {
  const statusClass = chore.done ? "chore-item--done" : "chore-item--pending";
  
  return (
    <div 
      className={`chore-item ${statusClass}`} 
      onClick={() => onToggle(chore.id)}
      style={{ color: chore.done ? color : "inherit" }}
      role="button"
    >
      <div className="chore-check">
        {chore.done && "✓"}
      </div>
      <span className="chore-label">{chore.label}</span>
    </div>
  );
}
