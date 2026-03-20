#!/usr/bin/env node
"use strict";

// This file MUST use only syntax compatible with Node.js v0.12+
// so it can print a helpful error on ancient Node versions.
// It exists because Claude Desktop (and similar launchers) do not
// source shell profiles, so nvm/fnm users may resolve an old
// system Node that cannot parse the ESM entry point (stdio.js).

var major = parseInt(process.versions.node.split(".")[0], 10);

if (major < 18) {
  process.stderr.write(
    "\n" +
      "ERROR: talkback-mcp requires Node.js 18 or later.\n" +
      "You are running Node.js " +
      process.version +
      ".\n\n" +
      "This commonly happens with Claude Desktop because it does not\n" +
      "source your shell profile (~/.zshrc, ~/.bashrc), so nvm/fnm\n" +
      "are not initialized and an old system Node is used instead.\n\n" +
      "To fix this, use the full path to npx in your MCP client config.\n" +
      "Run `which npx` in Terminal to find your path, then update:\n\n" +
      '  "command": "/Users/YOU/.nvm/versions/node/v22.x.x/bin/npx"\n\n' +
      "See: https://talkback.dev/docs/troubleshooting\n\n"
  );
  process.exit(1);
}

// Node is new enough — hand off to the real ESM entry point.
import("./stdio.js").catch(function (err) {
  process.stderr.write("Failed to load talkback-mcp: " + err.message + "\n");
  process.exit(1);
});
