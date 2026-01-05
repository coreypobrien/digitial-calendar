# PRD: Daily Chore Chart & Gamification

## 1. Overview
A dedicated "Chore Mode" for the wall calendar that allows up to 4 family members to view and interactively complete daily tasks. The feature focuses on positive reinforcement through visual gamification and provides parents with history tracking via the Admin panel.

## 2. User Stories

### The "Kid" (Display User)
- **Identification:** I want to easily see my own column or section identified by my name/avatar.
- **Action:** I want to tap a chore to mark it as "Done."
- **Feedback:** I want to see a satisfying visual animation (e.g., checkmark, color change) when I finish a task.
- **Completion:** I want a "Big Reward" animation (e.g., confetti) when I finish *all* my chores for the day.
- **Focus:** I want the chore chart to take up the whole screen so I can't miss it.

### The "Parent" (Admin User)
- **Setup:** I want to create profiles for my children (Name, Color).
- **Management:** I want to add/remove daily chores for each child.
- **Monitoring:** I want to see a history log in the Admin panel to verify if chores were done yesterday or last week.
- **Reset:** I want chores to automatically reset to "Not Done" every night at midnight.

## 3. Functional Requirements

### 3.1 Display Application (The Interface)
- **New View Mode:** "Chores" added to the main navigation (Month / Week / Upcoming / **Chores**).
- **Layout:**
    - Split screen into columns (1 to 4 columns based on user count).
    - Large, touch-friendly touch targets for each task.
- **States:**
    - *Pending:* Neutral color / Empty circle.
    - *Completed:* Bright user-specific color / Checked circle / Strikethrough text.
- **Visuals:**
    - No audio.
    - Particle effect (Confetti) triggered upon 100% completion for a specific user.
- **Interactivity:**
    - Tapping a pending chore marks it complete (optimistic UI update).
    - Tapping a completed chore toggles it back to pending (in case of accidental taps).

### 3.2 Backend & Data
- **Storage:**
    - `data/chores.json`: Stores user definitions and their current chore configurations.
    - `data/chore_history.json`: Appended to daily (or on completion) to store historical records.
- **API Endpoints:**
    - `GET /api/chores`: Get current configuration and today's status.
    - `POST /api/chores/:userId/:choreId/toggle`: Toggle status.
    - `GET /api/chores/history`: Admin view for past data.
- **Background Jobs:**
    - **Midnight Reset:** A job that runs at 00:00 local time to:
        1. Archive today's state to history.
        2. Reset all statuses to `false`.

### 3.3 Admin Application
- **Chore Management Tab:**
    - **Users:** Add/Delete users (Name, Theme Color).
    - **Task List:** Add/Edit/Delete chores per user.
- **History Tab:**
    - A calendar or table view showing completion rates (e.g., "Alice: 5/5" for Dec 30).

## 4. Technical Implementation Plan

### 4.1 Data Structures

**`data/chores.json`**
```json
{
  "users": [
    {
      "id": "u_123",
      "name": "Alice",
      "color": "#FF6B6B",
      "chores": [
        { "id": "c_1", "label": "Make Bed", "done": false },
        { "id": "c_2", "label": "Brush Teeth", "done": true }
      ]
    }
  ]
}
```

**`data/chore_history.json`**
```json
[
  {
    "date": "2025-12-30",
    "users": [
      {
        "name": "Alice",
        "completed": 2,
        "total": 2,
        "items": ["Make Bed", "Brush Teeth"]
      }
    ]
  }
]
```

### 4.2 API Routes
- `routes/chores.js`
    - `router.get('/')` -> Reads `chores.json`
    - `router.post('/toggle')` -> Updates specific boolean in `chores.json`
    - `router.get('/history')` -> Reads `chore_history.json`
    - `router.post('/config')` -> Admin updates to users/tasks.

### 4.3 Frontend Components
- `Client-Display`:
    - `ChoreView.jsx`: The main grid container.
    - `ChoreColumn.jsx`: Individual user column.
    - `ChoreItem.jsx`: The touchable task button.
    - `Confetti.jsx`: A simple canvas overlay for the "win" state.
- `Client-Admin`:
    - `ChoresSettings.jsx`: Form to manage users/tasks.
    - `ChoreHistory.jsx`: Data visualization for past performance.

## 5. Constraints & Assumptions
- **Daily Only:** Chores repeat every day. No specific logic for "Tuesdays only" in V1.
- **Local Time:** Resets happen based on the server's local time.
- **Screen Size:** Optimized for 1920x1080 (Landscape).
