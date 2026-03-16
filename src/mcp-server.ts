import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WsBridge } from "./ws-bridge.js";
import { assembleContext } from "./context-assembler.js";
import { getPluginLibrary } from "./plugin-library.js";
import { runHeuristics } from "./heuristics/index.js";
import { formatSpectralSummary } from "./spectral.js";
import { humanToRaw } from "./param-maps/index.js";

// ============================================================
// System prompt — prepended to session context responses
// ============================================================

const SYSTEM_PROMPT = `You are an experienced mixing and mastering engineer working alongside a music producer in their Ableton Live session. You have real-time access to their session via Talkback MCP tools.

The Talkback Bridge is a Max for Live Audio Effect device already installed in the producer's session. It connects to this MCP server via WebSocket. You do NOT need to guide setup — if you can read session data, the bridge is working.

Guidelines:

SESSION AWARENESS
1. Call get_session_context once to orient yourself. Only call again if the user says the session has changed.
2. Do NOT call analyze_mix on every message. Only when the user explicitly asks for mix feedback or describes a problem.

EMPTY TRACKS & NORMAL VARIANCE
3. Empty tracks, unused sends, tracks at 0dB, hard-panned pairs — all normal production choices, never flag as issues. The only time an empty track matters is if it has active devices AND non-zero output meters (e.g., a vinyl emulation plugin generating noise on a track the producer thinks is silent). Never suggest cleaning up or deleting empty tracks.
4. Sessions vary wildly between producers. Do not assume any track layout, gain structure, or routing pattern is wrong.

NO OBJECTIVE "GOOD MIX"
5. A mix is not objectively good or bad. There is no benchmark to optimize toward. When a user says "make it better" or "improve the mix," ask what they mean — louder? cleaner? drums hit harder while vocals stay present? more space? more aggression? The goal is to help the producer overcome technical limitations to achieve THEIR artistic vision, not a textbook standard.
6. A "technically rough" mix may be exactly right for the song's emotional intent. Respect that. Never assume a non-standard setting is a mistake.

PARAMETER CHANGES REQUIRE CONSENT
7. NEVER change a parameter without explicit user approval. Before any write operation, present the full plan: track name, device name, parameter name, current value → proposed value, and why. Wait for a clear "yes." If the user modifies the plan, re-present the updated changes and confirm again before executing. Never batch-execute changes without per-change approval.

FREQUENCY ANALYSIS
8. Your primary frequency insight comes from reading device parameters — EQ curves, filter cutoffs, compressor settings, device chains. Use get_track_details to read these. This works without playback and covers most mixing advice.
9. Spectral analysis (get_spectral_snapshot) is a secondary verification tool. It captures ~2 seconds of live audio from the master bus at the moment of capture. Transport must be playing. Use it only to confirm suspicions or detect issues invisible in device parameters (masking between tracks, phase cancellation, unexpected resonances). It is a microscope on a moment, not a full-song analyzer.

COMMUNICATION
10. Be specific — reference exact track names, device names, parameter values, and suggested values.
11. When suggesting devices, prefer plugins already in the session, then plugins the producer owns (use get_plugin_library). Don't suggest plugins without checking availability.
12. Speak like a knowledgeable colleague, not a textbook. Be direct and conversational. Prioritize by impact — lead with the highest-leverage suggestion.
13. When the producer describes a subjective problem ("muddy", "harsh", "thin"), use get_track_details to read device parameters on the relevant tracks BEFORE reaching for analyze_mix or spectral.
14. If session data is unavailable, simply say the bridge isn't connected. Do NOT fabricate setup instructions, GitHub URLs, or troubleshooting steps.`;

// ============================================================
// MCP server setup
// ============================================================

export function createMcpServer(bridge: WsBridge): McpServer {
  const server = new McpServer({
    name: "talkback-mcp",
    version: "0.1.0",
  });

  // ----------------------------------------------------------
  // Tool: get_session_context
  // ----------------------------------------------------------
  server.tool(
    "get_session_context",
    "Returns a snapshot of the current Ableton session: all tracks (names, volumes, panning, mutes, sends, device chains), return tracks, master track, and routing. Call once at the start of a conversation to orient yourself. No need to call again unless the user says the session has changed.",
    {},
    async () => {
      const context = assembleContext(bridge.cache);
      if (!context) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No session data available. Is the Talkback Bridge device loaded in Ableton and is the WebSocket connection active?",
            },
          ],
        };
      }
      return {
        content: [
          { type: "text" as const, text: SYSTEM_PROMPT },
          { type: "text" as const, text: JSON.stringify(context, null, 2) },
        ],
      };
    },
  );

  // ----------------------------------------------------------
  // Tool: get_track_details
  // ----------------------------------------------------------
  server.tool(
    "get_track_details",
    "Returns full detail for a specific track including all devices, every parameter in human-readable units, and per-device observations.",
    { track_name: z.string().describe("Track name (case-insensitive match)") },
    async ({ track_name }) => {
      const context = assembleContext(bridge.cache);
      if (!context) {
        return {
          content: [{ type: "text" as const, text: "No session data available." }],
        };
      }

      const lower = track_name.toLowerCase();
      const allTracks = [
        ...context.tracks,
        ...context.returnTracks,
        context.masterTrack,
      ];
      const track = allTracks.find((t) => t.name.toLowerCase() === lower);

      if (!track) {
        const names = allTracks.map((t) => t.name).join(", ");
        return {
          content: [
            {
              type: "text" as const,
              text: `Track "${track_name}" not found. Available tracks: ${names}`,
            },
          ],
        };
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(track, null, 2) },
        ],
      };
    },
  );

  // ----------------------------------------------------------
  // Tool: get_spectral_snapshot
  // ----------------------------------------------------------
  server.tool(
    "get_spectral_snapshot",
    "Captures ~2 seconds of live audio from the master bus and returns peak/RMS levels across frequency bands. Transport MUST be playing — coordinate with the user on which section to analyze (e.g., 'play the chorus'). This is a point-in-time microscope, not a full-song analyzer. Use as a secondary check to verify what device parameter analysis suggests, or to detect issues invisible in the device chain (masking, phase, resonances). For most frequency questions, reading EQ and filter parameters via get_track_details is more informative.",
    {
      source: z
        .string()
        .default("master")
        .describe("'master' for master bus, or a track name"),
    },
    async ({ source }) => {
      try {
        const snapshot = await bridge.requestSpectral(source);
        const summary = formatSpectralSummary(snapshot);
        return {
          content: [
            { type: "text" as const, text: summary },
            { type: "text" as const, text: JSON.stringify(snapshot, null, 2) },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Spectral analysis unavailable: ${message}`,
            },
          ],
        };
      }
    },
  );

  // ----------------------------------------------------------
  // Tool: get_plugin_library
  // ----------------------------------------------------------
  server.tool(
    "get_plugin_library",
    "Returns all audio plugins (AU, VST3) installed on this system. Use to know what tools the producer has available.",
    {
      filter: z
        .string()
        .optional()
        .describe("Optional search string to filter by plugin name"),
    },
    async ({ filter }) => {
      const plugins = await getPluginLibrary(filter);
      return {
        content: [
          {
            type: "text" as const,
            text: `${plugins.length} plugins found${filter ? ` matching "${filter}"` : ""}:\n${JSON.stringify(plugins, null, 2)}`,
          },
        ],
      };
    },
  );

  // ----------------------------------------------------------
  // Tool: analyze_mix
  // ----------------------------------------------------------
  server.tool(
    "analyze_mix",
    "Runs rule-based heuristic analysis for potential mix issues: frequency buildup, dynamics problems, routing inefficiencies, headroom. Only call when the user explicitly asks for mix feedback or describes a specific problem — do NOT call proactively. Findings are suggestions to consider, not problems to fix. Mix quality is subjective — frame results in context of what the user is trying to achieve. A technically 'imperfect' setting may be an intentional artistic choice.",
    {},
    async () => {
      const context = assembleContext(bridge.cache);
      if (!context) {
        return {
          content: [{ type: "text" as const, text: "No session data available." }],
        };
      }

      const findings = runHeuristics(context);

      if (findings.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No issues detected by automated analysis. This doesn't mean the mix is perfect — it means no common problems were flagged. Describe what you're hearing and I can dig deeper.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(findings, null, 2),
          },
        ],
      };
    },
  );

  // ----------------------------------------------------------
  // Tool: set_device_parameter
  // ----------------------------------------------------------
  server.tool(
    "set_device_parameter",
    "Sets a device parameter to a new value. Pass values in human-readable units (dB, ms, Hz, ratio, percent). NEVER call without explicit user approval. Present the planned change with current → proposed values first, wait for a clear 'yes', then execute. If the user modifies the plan, re-present and re-confirm before executing.",
    {
      track_name: z.string(),
      device_name: z.string(),
      parameter_name: z.string(),
      value: z.number(),
      unit: z.enum(["dB", "ms", "Hz", "ratio", "percent"]),
    },
    async ({ track_name, device_name, parameter_name, value, unit }) => {
      if (!bridge.cache.raw) {
        return {
          content: [{ type: "text" as const, text: "No session data available." }],
        };
      }

      // Find the track and device in raw cache to get device className
      const allTracks = [
        ...bridge.cache.raw.tracks,
        ...bridge.cache.raw.returnTracks,
        bridge.cache.raw.masterTrack,
      ];
      const lower = track_name.toLowerCase();
      const track = allTracks.find((t) => t.name.toLowerCase() === lower);
      if (!track) {
        return {
          content: [
            { type: "text" as const, text: `Track "${track_name}" not found.` },
          ],
        };
      }

      const device = track.devices.find(
        (d) => d.name.toLowerCase() === device_name.toLowerCase(),
      );
      if (!device) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Device "${device_name}" not found on track "${track_name}".`,
            },
          ],
        };
      }

      // Convert human value to raw
      let rawValue = humanToRaw(device.className, parameter_name, value, unit);
      if (rawValue === null) {
        // Fallback: assume 0-100 percent mapping
        rawValue = unit === "percent" ? value / 100 : value;
      }

      // Clamp to 0-1
      rawValue = Math.max(0, Math.min(1, rawValue));

      const sent = bridge.sendCommand({
        type: "set_parameter",
        trackId: track.id,
        deviceId: device.id,
        parameterName: parameter_name,
        value: rawValue,
      });

      if (!sent) {
        return {
          content: [
            { type: "text" as const, text: "Failed to send command — M4L bridge not connected." },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Set ${track_name} → ${device_name} → ${parameter_name} to ${value}${unit} (raw: ${rawValue.toFixed(4)})`,
          },
        ],
      };
    },
  );

  // ----------------------------------------------------------
  // Tool: toggle_device_bypass
  // ----------------------------------------------------------
  server.tool(
    "toggle_device_bypass",
    "Enables or bypasses a device on a track. Useful for A/B comparison. Always confirm with the user before toggling.",
    {
      track_name: z.string(),
      device_name: z.string(),
      active: z.boolean().describe("true = device on, false = bypassed"),
    },
    async ({ track_name, device_name, active }) => {
      if (!bridge.cache.raw) {
        return {
          content: [{ type: "text" as const, text: "No session data available." }],
        };
      }

      const allTracks = [
        ...bridge.cache.raw.tracks,
        ...bridge.cache.raw.returnTracks,
        bridge.cache.raw.masterTrack,
      ];
      const track = allTracks.find(
        (t) => t.name.toLowerCase() === track_name.toLowerCase(),
      );
      if (!track) {
        return {
          content: [{ type: "text" as const, text: `Track "${track_name}" not found.` }],
        };
      }

      const device = track.devices.find(
        (d) => d.name.toLowerCase() === device_name.toLowerCase(),
      );
      if (!device) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Device "${device_name}" not found on track "${track_name}".`,
            },
          ],
        };
      }

      const sent = bridge.sendCommand({
        type: "set_device_active",
        trackId: track.id,
        deviceId: device.id,
        isActive: active,
      });

      if (!sent) {
        return {
          content: [
            { type: "text" as const, text: "Failed — M4L bridge not connected." },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `${device_name} on ${track_name} is now ${active ? "enabled" : "bypassed"}.`,
          },
        ],
      };
    },
  );

  // ----------------------------------------------------------
  // Tool: create_group_track
  // ----------------------------------------------------------
  server.tool(
    "create_group_track",
    "Creates a new group track containing the specified tracks. Always confirm with the producer first.",
    {
      track_names: z.array(z.string()).describe("Names of tracks to group"),
      group_name: z.string().describe("Name for the new group track"),
    },
    async ({ track_names, group_name }) => {
      if (!bridge.cache.raw) {
        return {
          content: [{ type: "text" as const, text: "No session data available." }],
        };
      }

      const trackIds: string[] = [];
      const notFound: string[] = [];

      for (const name of track_names) {
        const track = bridge.cache.raw.tracks.find(
          (t) => t.name.toLowerCase() === name.toLowerCase(),
        );
        if (track) {
          trackIds.push(track.id);
        } else {
          notFound.push(name);
        }
      }

      if (notFound.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not find tracks: ${notFound.join(", ")}`,
            },
          ],
        };
      }

      const sent = bridge.sendCommand({
        type: "create_group",
        trackIds,
        groupName: group_name,
      });

      if (!sent) {
        return {
          content: [
            { type: "text" as const, text: "Failed — M4L bridge not connected." },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Creating group "${group_name}" with tracks: ${track_names.join(", ")}`,
          },
        ],
      };
    },
  );

  // ----------------------------------------------------------
  // Tool: set_track_routing
  // ----------------------------------------------------------
  server.tool(
    "set_track_routing",
    "Changes a track's output routing. Always confirm with the producer first.",
    {
      track_name: z.string(),
      output_target: z.string().describe("Name of the target track/group/bus"),
    },
    async ({ track_name, output_target }) => {
      if (!bridge.cache.raw) {
        return {
          content: [{ type: "text" as const, text: "No session data available." }],
        };
      }

      const track = bridge.cache.raw.tracks.find(
        (t) => t.name.toLowerCase() === track_name.toLowerCase(),
      );
      if (!track) {
        return {
          content: [{ type: "text" as const, text: `Track "${track_name}" not found.` }],
        };
      }

      const sent = bridge.sendCommand({
        type: "set_routing",
        trackId: track.id,
        outputTarget: output_target,
      });

      if (!sent) {
        return {
          content: [
            { type: "text" as const, text: "Failed — M4L bridge not connected." },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Routing ${track_name} output to ${output_target}.`,
          },
        ],
      };
    },
  );

  // ----------------------------------------------------------
  // Tool: get_bridge_health
  // ----------------------------------------------------------
  server.tool(
    "get_bridge_health",
    "Returns performance metrics from the M4L bridge device: poll execution time (avg/max), WebSocket message size, LiveAPI cache size, and track count. Use to diagnose performance issues or confirm the device is running efficiently.",
    {},
    async () => {
      if (!bridge.cache.isConnected) {
        return {
          content: [{ type: "text" as const, text: "M4L bridge not connected." }],
        };
      }

      const p = bridge.perf;
      const snapshotKb = (p.snapshotBytes / 1024).toFixed(1);

      const lines = [
        `Poll time: ${p.lastPollMs}ms (avg ${p.avgPollMs}ms, max ${p.maxPollMs}ms over ${p.pollCount} polls)`,
        `Snapshot size: ${snapshotKb}KB (${p.snapshotBytes} bytes)`,
        `Tracks in snapshot: ${p.trackCount}`,
        `LiveAPI cache: ${p.apiCacheSize} objects`,
        `Last poll was structure refresh: ${p.lastStructureRefresh}`,
        ``,
        `Benchmarks:`,
        `  Poll time < 50ms = excellent, 50-200ms = acceptable, >200ms = needs work`,
        `  Snapshot < 30KB = good, 30-100KB = fine at 10s intervals, >100KB = large`,
        `  Cache should stabilize after first few polls — growth = potential leak`,
      ];

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    },
  );

  return server;
}
