#!/usr/bin/env bash
# Talkback MCP installer
# Usage: curl -fsSL https://talkback.createwcare.com/install.sh | bash
#
# What this does:
#   1. Checks for Node.js 18+
#   2. Installs talkback-mcp globally via npm
#   3. Configures Claude Desktop (if installed)
#   4. Prints next steps

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { echo -e "${BLUE}→${RESET} $1"; }
ok()    { echo -e "${GREEN}✓${RESET} $1"; }
warn()  { echo -e "${YELLOW}!${RESET} $1"; }
fail()  { echo -e "${RED}✗${RESET} $1"; }

echo ""
echo -e "${BOLD}talkback${RESET} — connect your LLM to Ableton Live"
echo -e "${DIM}https://talkback.createwcare.com${RESET}"
echo ""

# ── Step 1: Check Node.js ──────────────────────────────────
info "Checking for Node.js..."

if ! command -v node &>/dev/null; then
  fail "Node.js is not installed."
  echo ""
  echo "  Talkback requires Node.js 18 or later."
  echo ""
  echo "  Install it from: https://nodejs.org"
  echo "  (download the LTS version, run the installer, then run this script again)"
  echo ""
  if command -v brew &>/dev/null; then
    echo -e "  Or with Homebrew: ${DIM}brew install node${RESET}"
    echo ""
  fi
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node.js $NODE_VERSION is too old. Talkback requires Node.js 18+."
  echo ""
  echo "  Update from: https://nodejs.org"
  echo ""
  if command -v brew &>/dev/null; then
    echo -e "  Or with Homebrew: ${DIM}brew upgrade node${RESET}"
    echo ""
  fi
  if command -v nvm &>/dev/null || [ -d "$HOME/.nvm" ]; then
    echo -e "  Or with nvm: ${DIM}nvm install 22 && nvm use 22${RESET}"
    echo ""
  fi
  exit 1
fi

ok "Node.js $NODE_VERSION"

# ── Step 2: Install talkback-mcp ───────────────────────────
info "Installing talkback-mcp..."

if npm install -g talkback-mcp 2>/dev/null; then
  ok "talkback-mcp installed"
else
  fail "npm install failed."
  echo ""
  echo "  If you got a permissions error, try:"
  echo -e "  ${DIM}sudo npm install -g talkback-mcp${RESET}"
  echo ""
  exit 1
fi

# ── Step 3: Resolve paths ─────────────────────────────────
# Use absolute paths to avoid nvm/fnm PATH issues with Claude Desktop
NPX_PATH=$(which npx 2>/dev/null || true)

if [ -z "$NPX_PATH" ]; then
  warn "Could not find npx in PATH. You'll need to configure the MCP server manually."
  NPX_PATH="npx"
fi

ok "Using npx at: $NPX_PATH"

# ── Step 4: Configure Claude Desktop ──────────────────────
CLAUDE_CONFIG=""
CONFIGURED=false

if [ "$(uname)" = "Darwin" ]; then
  CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
elif [ "$(uname)" = "Linux" ]; then
  CLAUDE_CONFIG="$HOME/.config/Claude/claude_desktop_config.json"
else
  # Windows (Git Bash / WSL)
  if [ -n "${APPDATA:-}" ]; then
    CLAUDE_CONFIG="$APPDATA/Claude/claude_desktop_config.json"
  fi
fi

if [ -n "$CLAUDE_CONFIG" ]; then
  info "Configuring Claude Desktop..."

  CONFIG_DIR=$(dirname "$CLAUDE_CONFIG")

  if [ ! -d "$CONFIG_DIR" ]; then
    warn "Claude Desktop config directory not found."
    echo "  Is Claude Desktop installed? Download it from: https://claude.ai/download"
    echo ""
  else
    # Build the talkback MCP server entry
    TALKBACK_ENTRY=$(cat <<JSONEOF
{
  "command": "$NPX_PATH",
  "args": ["-y", "talkback-mcp"],
  "env": { "WS_PORT": "8765" }
}
JSONEOF
)

    if [ -f "$CLAUDE_CONFIG" ]; then
      # Config file exists — check if talkback is already configured
      if grep -q "talkback-mcp" "$CLAUDE_CONFIG" 2>/dev/null; then
        ok "Claude Desktop already has talkback-mcp configured"
        CONFIGURED=true
      else
        # File exists but no talkback entry — need to merge
        # Check if jq is available for safe JSON merging
        if command -v jq &>/dev/null; then
          UPDATED=$(jq --argjson tb "$TALKBACK_ENTRY" '.mcpServers["talkback-mcp"] = $tb' "$CLAUDE_CONFIG")
          echo "$UPDATED" > "$CLAUDE_CONFIG"
          ok "Added talkback-mcp to Claude Desktop config"
          CONFIGURED=true
        else
          warn "Could not auto-configure (jq not found for safe JSON merging)."
          echo ""
          echo "  Add this to your Claude Desktop config file:"
          echo -e "  ${DIM}$CLAUDE_CONFIG${RESET}"
          echo ""
          echo '  "mcpServers": {'
          echo '    "talkback-mcp": {'
          echo "      \"command\": \"$NPX_PATH\","
          echo '      "args": ["-y", "talkback-mcp"],'
          echo '      "env": { "WS_PORT": "8765" }'
          echo '    }'
          echo '  }'
          echo ""
        fi
      fi
    else
      # No config file — create one
      cat > "$CLAUDE_CONFIG" <<CONFIGEOF
{
  "mcpServers": {
    "talkback-mcp": {
      "command": "$NPX_PATH",
      "args": ["-y", "talkback-mcp"],
      "env": { "WS_PORT": "8765" }
    }
  }
}
CONFIGEOF
      ok "Created Claude Desktop config with talkback-mcp"
      CONFIGURED=true
    fi
  fi
fi

# ── Done ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}Setup complete!${RESET}"
echo ""

if [ "$CONFIGURED" = true ]; then
  echo "  Next steps:"
  echo ""
  echo "  1. Download the Max for Live device from https://talkback.createwcare.com/docs/getting-started"
  echo "  2. Drag it onto your master track in Ableton"
  echo "  3. Restart Claude Desktop"
  echo "  4. Start chatting about your session"
else
  echo "  Next steps:"
  echo ""
  echo "  1. Download the Max for Live device from https://talkback.createwcare.com/docs/getting-started"
  echo "  2. Drag it onto your master track in Ableton"
  echo "  3. Configure your MCP client (see https://talkback.createwcare.com/docs/getting-started)"
  echo "  4. Start chatting about your session"
fi

echo ""
echo -e "${DIM}Docs: https://talkback.createwcare.com/docs/getting-started${RESET}"
echo -e "${DIM}Troubleshooting: https://talkback.createwcare.com/docs/troubleshooting${RESET}"
echo ""
