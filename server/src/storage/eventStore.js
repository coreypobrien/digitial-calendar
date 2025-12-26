import { readJsonFile, resolveDataPath, writeJsonAtomic } from "./jsonStore.js";

const eventCachePath = resolveDataPath("event_cache.json");

export const loadEventCache = async () =>
  readJsonFile(eventCachePath, { updatedAt: null, range: null, events: [] });

export const saveEventCache = async (payload) => writeJsonAtomic(eventCachePath, payload);
