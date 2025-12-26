import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let tempDir;
let googleAuth;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wall-calendar-googleauth-"));
  process.env.DATA_DIR = tempDir;
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  googleAuth = await import("./googleAuth.js");
});

afterAll(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REDIRECT_URI;
});

describe("googleAuth", () => {
  it("returns null when no tokens exist", async () => {
    const tokens = await googleAuth.loadTokens();
    expect(tokens).toBe(null);
  });

  it("saves and loads tokens", async () => {
    const payload = { access_token: "abc", refresh_token: "def" };
    await googleAuth.saveTokens(payload);
    const tokens = await googleAuth.loadTokens();
    expect(tokens.access_token).toBe("abc");
  });

  it("clears tokens", async () => {
    await googleAuth.saveTokens({ access_token: "abc" });
    await googleAuth.clearTokens();
    const tokens = await googleAuth.loadTokens();
    expect(tokens).toBe(null);
  });

  it("generates an auth URL with the client id", () => {
    const url = googleAuth.getAuthUrl();
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("calendar.readonly");
  });

  it("returns a redirect URI when not provided", () => {
    delete process.env.GOOGLE_REDIRECT_URI;
    const uri = googleAuth.getRedirectUri();
    expect(uri).toContain("/api/google/callback");
  });
});
