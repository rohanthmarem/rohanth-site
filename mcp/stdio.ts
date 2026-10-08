#!/usr/bin/env node
// Local entry point for CLI agents (Codex, Claude Code, ...): `node mcp/stdio.ts`.
// Needs GITHUB_TOKEN, or falls back to the GitHub CLI's login on this machine.
import { execFileSync } from "node:child_process";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { configFromEnv, createSiteServer } from "./server.ts";

function ghCliToken(): string | undefined {
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
  } catch {
    return undefined;
  }
}

const config = configFromEnv(process.env, process.env.GITHUB_TOKEN ? undefined : ghCliToken());
if (!config) {
  console.error("rohanth-site MCP: set GITHUB_TOKEN (or log in with `gh auth login`).");
  process.exit(1);
}

await createSiteServer(config).connect(new StdioServerTransport());
