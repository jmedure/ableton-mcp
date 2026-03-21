# talkback mcp

Chat with your Ableton session in natural language. Go deeper in your mix, make it sound like it does in your head, and finally understand compression... jk no one can teach you that.

Talkback is an MCP server and Max for Live device that gives AI assistants real-time access to your Ableton Live session — read tracks, adjust parameters, analyze your mix, and get spectral snapshots, all through conversation.

**[talkback.createwcare.com](https://talkback.createwcare.com)** &nbsp;·&nbsp; **[Docs](https://talkback.createwcare.com/docs/getting-started)** &nbsp;·&nbsp; **[Changelog](https://talkback.createwcare.com/docs/changelog)**

## How it works

```
Ableton Live ↔ M4L Bridge ↔ WebSocket ↔ MCP Server ↔ Claude / Cursor / etc.
```

1. **talkback bridge** — a Max for Live device on your master track that reads the Live Object Model and streams session data over WebSocket
2. **talkback-mcp** (this package) — an MCP server that exposes your session as tools any LLM can use

## Quick start

The fastest way to get set up — installs the MCP server and configures Claude Desktop automatically:

```bash
curl -fsSL https://talkback.createwcare.com/install.sh | bash
```

Requires [Node.js 18+](https://nodejs.org). See the [full setup guide](https://talkback.createwcare.com/docs/getting-started) for more options.

### 1. Install the Max for Live device

Download [talkback-bridge-v1.5.amxd](https://talkback.createwcare.com/downloads/talkback-bridge-v1.5.amxd) and drop it onto your **master track** in Ableton. Make sure the device is toggled on.

### 2. Add the MCP server

Talkback requires a **desktop MCP client** — it runs locally on your machine and connects to Ableton over WebSocket. It does not work with claude.ai in the browser (web chat doesn't support local MCP servers yet).

<details>
<summary><b>Claude Desktop</b> (recommended)</summary>

[Download Claude Desktop](https://claude.ai/download), then add to your config:

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
`%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "talkback-mcp": {
      "command": "npx",
      "args": ["-y", "talkback-mcp"],
      "env": { "WS_PORT": "8765" }
    }
  }
}
```

Restart Claude Desktop after saving.

> **Using nvm or fnm?** Claude Desktop doesn't load your shell profile, so it may pick up an old system Node. Use the full path to `npx` instead — run `which npx` in Terminal, then set that as `"command"` in the config above. See [troubleshooting](https://talkback.createwcare.com/docs/troubleshooting) for details.
</details>

<details>
<summary>Claude Code</summary>

```bash
claude mcp add --transport stdio talkback-mcp -- npx -y talkback-mcp
```
</details>

<details>
<summary>Cursor</summary>

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "talkback-mcp": {
      "command": "npx",
      "args": ["-y", "talkback-mcp"],
      "env": { "WS_PORT": "8765" }
    }
  }
}
```
</details>

<details>
<summary>Other clients (Windsurf, etc.)</summary>

Point your client at `npx -y talkback-mcp` as the server command with `WS_PORT=8765` as an environment variable.

Or use [add-mcp](https://github.com/nichochar/add-mcp) to auto-configure all your installed agents:

```bash
npx add-mcp "npx -y talkback-mcp"
```
</details>

### 3. Start chatting

Open your LLM and start asking about your session:

- *"What's going on in my session?"*
- *"My bass sounds muddy, can you help?"*
- *"Cut 3 dB at 300 Hz on the vocal EQ"*
- *"Does my mix have any obvious problems?"*

Your LLM will ask for approval before making any parameter changes. Undo always works.

## Tools

| Tool | What it does |
|------|-------------|
| `get_session_context` | Reads your full session — tracks, volumes, panning, mutes, sends, devices, routing |
| `get_track_details` | Deep-dives a single track with every device parameter in human-readable units |
| `get_spectral_snapshot` | Captures ~2s of live audio from master bus with peak/RMS per frequency band |
| `get_plugin_library` | Lists all installed AU and VST3 plugins on your system |
| `analyze_mix` | Runs heuristic checks for frequency buildup, dynamics, headroom, and routing issues |
| `set_device_parameter` | Changes a device parameter using human-readable units (dB, ms, Hz, etc.) |
| `toggle_device_bypass` | Enables or bypasses a device for A/B comparison |
| `create_group_track` | Creates a new group track containing specified tracks |
| `set_track_routing` | Changes a track's output routing to another track or bus |
| `get_bridge_health` | Returns bridge performance metrics from the M4L device |

## Requirements

- Ableton Live 11+ with Max for Live
- Node.js 18+
- A desktop MCP client — [Claude Desktop](https://claude.ai/download) (recommended), Claude Code, Cursor, or similar

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_PORT` | `8765` | WebSocket port for bridge connection |

## License

[PolyForm Shield 1.0.0](LICENSE) — free to use, modify, and distribute. You may not use this software to build a competing product.
