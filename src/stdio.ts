#!/usr/bin/env node
import "dotenv/config";

// In stdio mode, stdout is reserved for JSON-RPC.
// All logging in this codebase uses console.error to avoid polluting stdout.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WsBridge } from "./ws-bridge.js";
import { createMcpServer } from "./mcp-server.js";

const WS_PORT = parseInt(process.env.WS_PORT ?? "8765", 10);

// ============================================================
// Start WebSocket bridge (still needed — M4L connects via WS)
// ============================================================

const bridge = new WsBridge();
await bridge.start(WS_PORT);

bridge.on("connected", () => {
  console.error("[stdio] M4L bridge connected — session data will flow");
});

bridge.on("disconnected", () => {
  console.error("[stdio] M4L bridge disconnected");
});

bridge.on("session_updated", () => {
  const trackCount = bridge.cache.raw?.tracks.length ?? 0;
  console.error(`[stdio] Session updated — ${trackCount} tracks`);
});

// ============================================================
// Start MCP server with stdio transport
// ============================================================

const mcpServer = createMcpServer(bridge);
const transport = new StdioServerTransport();

await mcpServer.connect(transport);
console.error("[stdio] Talkback MCP server running via stdio");
console.error(`[stdio] WebSocket bridge: ws://localhost:${WS_PORT}`);
