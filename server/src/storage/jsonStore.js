import fs from "node:fs/promises";
import path from "node:path";

import { dataDir } from "../paths.js";

const TMP_SUFFIX = ".tmp";

export const ensureDataDir = async () => {
  await fs.mkdir(dataDir, { recursive: true });
};

export const resolveDataPath = (fileName) => path.join(dataDir, fileName);

export const readJsonFile = async (filePath, fallback) => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
};

export const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

export const writeJsonAtomic = async (filePath, data) => {
  await ensureDataDir();
  const tempPath = `${filePath}${TMP_SUFFIX}`;
  const payload = JSON.stringify(data, null, 2);
  await fs.writeFile(tempPath, payload, "utf-8");
  await fs.rename(tempPath, filePath);
};
