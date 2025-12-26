import fs from "node:fs/promises";

import { google } from "googleapis";

import { fileExists, readJsonFile, resolveDataPath, writeJsonAtomic } from "../storage/jsonStore.js";

const tokenPath = resolveDataPath("google_tokens.json");

export const hasGoogleCredentials = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const getRedirectUri = () => {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}/api/google/callback`;
};

export const createOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

export const loadTokens = async () => {
  const exists = await fileExists(tokenPath);
  if (!exists) {
    return null;
  }
  return readJsonFile(tokenPath, null);
};

export const saveTokens = async (tokens) => {
  await writeJsonAtomic(tokenPath, tokens);
  return tokens;
};

export const clearTokens = async () => {
  const exists = await fileExists(tokenPath);
  if (!exists) {
    return;
  }
  await fs.unlink(tokenPath);
};

export const getAuthUrl = () => {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"]
  });
};

export const exchangeCodeForTokens = async (code) => {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  await saveTokens(tokens);
  return tokens;
};

export const getAuthorizedClient = async () => {
  const tokens = await loadTokens();
  if (!tokens) {
    return null;
  }
  const client = createOAuthClient();
  client.setCredentials(tokens);
  return client;
};
