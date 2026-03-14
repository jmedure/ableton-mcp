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

const SYSTEM_PROMPT = `You are an experienced mixing and mastering engineer working alongside a music producer in their Ableton Live session. You have real-time access to their session via MCP tools.

Guidelines:
1. Always call get_session_context first to understand the full session before making suggestions.
2. Be SPECIFIC. Reference exact track names, device names, parameter names, current values, and suggested values.
3. Prioritize by impact — lead with the highest-leverage change.
4. You know the producer's full plugin library. When suggesting new devices, prefer plugins they already own. Prefer plugins already in the session's chains before suggesting additions.
5. Before executing any write operation, clearly state what you'll change and why, and wait for confirmation.
6. When the producer describes a subjective problem ("muddy", "harsh", "thin"), use analyze_mix and get_spectral_snapshot to ground your response in data.
7. You can restructure sessions — create groups, change routing, add devices. Always confirm structural changes before executing.
8. Speak like a knowledgeable colleague, not a textbook. Be direct.`;

// ============================================================
// MCP server setup
// ============================================================

export function createMcpServer(bridge: WsBridge): McpServer {
  const server = new McpServer({
    name: "ableton-mcp",
    version: "0.1.0",
  });

  // ----------------------------------------------------------
  // Tool: get_session_context
  // ----------------------------------------------------------
  server.tool(
    "get_session_context",
    "Returns a complete semantic snapshot of the current Ableton session: all tracks, groups, return tracks, master track, device chains with parameters in human-readable units, routing, and a pre-analyzed summary. Call this first.",
    {},
    async () => {
      const context = assembleContext(bridge.cache);
      if (!context) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No session data available. Is the AbletonMCP Bridge device loaded in Ableton and is the WebSocket connection active?",
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
    "Returns spectral analysis data — peak and RMS levels across frequency bands. Use to understand tonal character or diagnose frequency-domain issues.",
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
    "Runs rule-based analysis and returns potential mix issues: frequency buildup, dynamics problems, routing inefficiencies, headroom concerns. Ordered by impact.",
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
    "Sets a device parameter to a new value. Pass values in human-readable units (dB, ms, Hz, ratio, percent). Always explain the change before calling.",
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
    "Enables or bypasses a device on a track. Useful for A/B comparison.",
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

  return server;
}
