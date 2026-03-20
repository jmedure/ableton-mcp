# Setup Talkback MCP

You are helping the user set up **talkback-mcp** — an MCP server that connects AI assistants to Ableton Live.

## What to do

Run through these checks in order, fixing any issues you find:

### 1. Check Node.js version
Run `node --version` and verify it's 18 or later. If not:
- Check if nvm or fnm is available (`nvm --version`, `fnm --version`)
- If so, suggest `nvm install 22 && nvm use 22` or `fnm install 22 && fnm use 22`
- If not, direct them to https://nodejs.org (download LTS)

### 2. Check if talkback-mcp is installed
Run `npm list -g talkback-mcp` to check. If not installed, run `npm install -g talkback-mcp`.

### 3. Resolve the npx path
Run `which npx` to get the absolute path. Save this — it's needed for Claude Desktop config to avoid nvm/fnm PATH issues.

### 4. Configure the MCP client

**For Claude Code (this CLI):**
Run: `claude mcp add --transport stdio talkback-mcp -- npx -y talkback-mcp`

**For Claude Desktop:**
Check if the config file exists:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Read the file if it exists. Add or update the talkback-mcp entry using the **absolute npx path** from step 3:

```json
{
  "mcpServers": {
    "talkback-mcp": {
      "command": "/absolute/path/to/npx",
      "args": ["-y", "talkback-mcp"],
      "env": { "WS_PORT": "8765" }
    }
  }
}
```

If the file has existing entries, merge — don't overwrite them.

### 5. Verify the connection
Tell the user:
- Open Ableton Live with the talkback M4L device on the master track (download from https://talkback.createwcare.com/docs/getting-started if needed)
- Restart Claude Desktop (if configured)
- Try asking: "What's happening in my Ableton session?"

### 6. Troubleshooting
If anything goes wrong, check:
- `node --version` — must be 18+
- Port 8765 isn't in use: `lsof -i :8765`
- Claude Desktop was restarted after config change
- The M4L device is on the master track and toggled on

Link them to https://talkback.createwcare.com/docs/troubleshooting for more help.

## Tone
Be friendly and clear. The user may be a music producer who isn't familiar with Terminal. Explain what you're doing as you go. Celebrate when things work.
