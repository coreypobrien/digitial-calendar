import { z } from "zod";
import { fileExists, readJsonFile, resolveDataPath, writeJsonAtomic } from "./jsonStore.js";

const choresPath = resolveDataPath("chores.json");
const historyPath = resolveDataPath("chore_history.json");

const ChoreItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean().default(false)
});

const ChoreUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  chores: z.array(ChoreItemSchema)
});

const ChoresDataSchema = z.object({
  users: z.array(ChoreUserSchema)
});

const defaultChores = {
  users: []
};

export const loadChores = async () => {
  const exists = await fileExists(choresPath);
  if (!exists) {
    return defaultChores;
  }
  const data = await readJsonFile(choresPath, defaultChores);
  const parsed = ChoresDataSchema.safeParse(data);
  return parsed.success ? parsed.data : defaultChores;
};

export const saveChores = async (data) => {
  const parsed = ChoresDataSchema.parse(data);
  await writeJsonAtomic(choresPath, parsed);
  return parsed;
};

export const toggleChore = async (userId, choreId) => {
  const data = await loadChores();
  const user = data.users.find((u) => u.id === userId);
  if (!user) {
    throw new Error("User not found");
  }
  const chore = user.chores.find((c) => c.id === choreId);
  if (!chore) {
    throw new Error("Chore not found");
  }
  chore.done = !chore.done;
  await saveChores(data);
  return data;
};

export const appendHistory = async (dateStr, usersData) => {
  // usersData should be: [{ name, completed, total, items: [...] }]
  const history = await readJsonFile(historyPath, []);
  
  // Remove existing entry for this date if it exists (overwrite logic for re-runs)
  const filtered = history.filter((entry) => entry.date !== dateStr);
  
  const entry = {
    date: dateStr,
    users: usersData
  };
  
  const nextHistory = [...filtered, entry];
  // Sort by date descending
  nextHistory.sort((a, b) => b.date.localeCompare(a.date));
  
  await writeJsonAtomic(historyPath, nextHistory);
  return nextHistory;
};

export const loadHistory = async () => {
  return readJsonFile(historyPath, []);
};

export const resetDailyChores = async () => {
  const data = await loadChores();
  let changed = false;
  
  const summary = data.users.map(user => {
    const completedItems = user.chores.filter(c => c.done).map(c => c.label);
    const total = user.chores.length;
    
    // Reset status
    if (user.chores.some(c => c.done)) {
      user.chores.forEach(c => { c.done = false; });
      changed = true;
    }
    
    return {
      name: user.name,
      completed: completedItems.length,
      total,
      items: completedItems
    };
  });
  
  if (changed) {
    await saveChores(data);
  }
  
  return summary;
};
