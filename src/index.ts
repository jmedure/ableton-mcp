import "dotenv/config";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { WsBridge } from "./ws-bridge.js";
import { createMcpServer } from "./mcp-server.js";

const WS_PORT = parseInt(process.env.WS_PORT ?? "8765", 10);
const MCP_PORT = parseInt(process.env.MCP_PORT ?? "3000", 10);

// ============================================================
// Start WebSocket bridge
// ============================================================

const bridge = new WsBridge();
await bridge.start(WS_PORT);

bridge.on("connected", () => {
  console.log("[main] M4L bridge connected — session data will flow");
});

bridge.on("disconnected", () => {
  console.log("[main] M4L bridge disconnected");
});

bridge.on("session_updated", () => {
  const trackCount = bridge.cache.raw?.tracks.length ?? 0;
  console.log(`[main] Session updated — ${trackCount} tracks`);
});

// ============================================================
// Start MCP server with streamable HTTP transport
// ============================================================

const mcpServer = createMcpServer(bridge);
const app = express();

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless for now
  });
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res);
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    m4lConnected: bridge.cache.isConnected,
    lastUpdated: bridge.cache.lastUpdated,
    trackCount: bridge.cache.raw?.tracks.length ?? 0,
  });
});

app.listen(MCP_PORT, () => {
  console.log(`[main] AbletonMCP server running`);
  console.log(`[main]   MCP endpoint: http://localhost:${MCP_PORT}/mcp`);
  console.log(`[main]   WebSocket bridge: ws://localhost:${WS_PORT}`);
  console.log(`[main]   Health check: http://localhost:${MCP_PORT}/health`);
});
