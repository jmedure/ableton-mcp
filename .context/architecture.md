# AbletonMCP Server — Architecture Context

See the full spec at: ~/Documents/github/ableton-mcp-spec.md

This is the MCP server component of the AbletonMCP project. It connects to the
AbletonMCP Bridge (a Max for Live device in Ableton) via WebSocket and exposes
session data and controls to Claude via the MCP protocol (streamable HTTP).

## Key files

- `src/index.ts` — Entry point, starts both WS and MCP servers
- `src/ws-bridge.ts` — WebSocket server, session cache, command dispatch
- `src/mcp-server.ts` — MCP tool definitions and system prompt
- `src/context-assembler.ts` — Raw LOM values → human-readable semantic JSON
- `src/types.ts` — All TypeScript interfaces for session state
- `src/param-maps/` — Device-specific parameter translation (raw 0-1 ↔ dB/ms/Hz)
- `src/heuristics/` — Rule-based mix analysis
- `src/plugin-library.ts` — Scans macOS plugin directories
- `src/spectral.ts` — Interprets FFT data from M4L bridge
