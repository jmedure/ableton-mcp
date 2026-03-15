import type {
  RawTrack,
  RawDevice,
  SemanticSession,
  SemanticTrack,
  SemanticDevice,
  SessionCache,
} from "./types.js";
import { lookupParamMap, translateParameter } from "./param-maps/index.js";

// ============================================================
// Volume / pan conversions
// ============================================================

export function rawVolumeToDb(raw: number): string {
  if (raw <= 0) return "-inf dB";
  const db = 20 * Math.log10(raw / 0.85);
  if (db <= -70) return "-inf dB";
  const rounded = Math.round(db * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}dB`;
}

export function rawPanToHuman(raw: number): string {
  if (Math.abs(raw) < 0.01) return "center";
  const pct = Math.round(Math.abs(raw) * 100);
  const side = raw < 0 ? "left" : "right";
  if (pct >= 99) return `hard ${side}`;
  return `${pct}% ${side}`;
}

export function rawSendToPercent(raw: number): string {
  return `${Math.round(raw * 100)}%`;
}

// ============================================================
// Device assembly
// ============================================================

function assembleDevice(device: RawDevice): SemanticDevice {
  const paramMap = lookupParamMap(device.className);
  const isThirdParty = device.type === "PluginDevice";

  const parameters: Record<string, string> = {};
  const observations: string[] = [];

  for (const param of device.parameters) {
    parameters[param.name] = translateParameter(
      device.className,
      param.name,
      param.value,
      paramMap,
    );
  }

  // Generate observations from param map advisors
  if (paramMap) {
    for (const param of device.parameters) {
      const mapEntry = paramMap.parameters[param.name];
      if (mapEntry?.observe) {
        const observation = mapEntry.observe(param.value, parameters[param.name]);
        if (observation) observations.push(observation);
      }
    }
  }

  return {
    id: device.id,
    name: device.name,
    active: device.isActive,
    isThirdParty,
    parameters,
    observations,
  };
}

// ============================================================
// Track assembly
// ============================================================

function assembleTrack(
  track: RawTrack,
  returnTrackNames: Map<string, string>,
): SemanticTrack {
  const sends: Record<string, string> = {};
  if (Array.isArray(track.sends)) {
    for (const send of track.sends) {
      const returnName =
        returnTrackNames.get(send.returnTrackId) ?? send.returnTrackId;
      sends[returnName] = rawSendToPercent(send.amount);
    }
  }

  // Handle both full device objects and lightweight device name arrays
  const devices: SemanticDevice[] = Array.isArray(track.devices)
    ? track.devices.map(assembleDevice)
    : [];

  // If we only have deviceNames (lightweight snapshot), show them as simple entries
  const deviceNameList: string[] = (track as any).deviceNames ?? [];
  if (devices.length === 0 && deviceNameList.length > 0) {
    for (const dn of deviceNameList) {
      devices.push({
        id: dn,
        name: dn,
        active: true,
        isThirdParty: false,
        parameters: {},
        observations: [],
      });
    }
  }

  return {
    id: track.id,
    name: track.name,
    type: track.type,
    volume: rawVolumeToDb(track.volume),
    panning: rawPanToHuman(track.panning),
    muted: track.mute,
    soloed: track.solo,
    group: track.groupId,
    outputRouting: track.outputRouting,
    sends,
    devices,
  };
}

// ============================================================
// Session assembly
// ============================================================

function generateSessionSummary(
  tracks: SemanticTrack[],
  returnTracks: SemanticTrack[],
  masterTrack: SemanticTrack,
): string {
  const parts: string[] = [];

  const groupCount = tracks.filter((t) => t.type === "group").length;
  parts.push(
    `${tracks.length} tracks${groupCount > 0 ? ` (${groupCount} groups)` : ""}, ${returnTracks.length} returns.`,
  );

  // Note any devices on master
  const masterDevices = masterTrack.devices.filter((d) => d.active);
  if (masterDevices.length > 0) {
    parts.push(
      `Master chain: ${masterDevices.map((d) => d.name).join(" → ")}.`,
    );
  }

  // Collect observations across all tracks
  for (const track of [...tracks, ...returnTracks, masterTrack]) {
    for (const device of track.devices) {
      for (const obs of device.observations) {
        parts.push(`[${track.name}] ${obs}`);
      }
    }
  }

  return parts.join(" ");
}

export function assembleContext(cache: SessionCache): SemanticSession | null {
  if (!cache.raw) return null;

  const { tempo, signature, tracks, returnTracks, masterTrack } = cache.raw;

  // Build return track name map for send labels
  const returnTrackNames = new Map<string, string>();
  for (const rt of returnTracks) {
    returnTrackNames.set(rt.id, rt.name);
  }

  const semanticTracks = tracks.map((t) =>
    assembleTrack(t, returnTrackNames),
  );
  const semanticReturns = returnTracks.map((t) =>
    assembleTrack(t, returnTrackNames),
  );
  const semanticMaster = assembleTrack(masterTrack, returnTrackNames);

  const groupCount = tracks.filter((t) => t.isGroupTrack).length;

  return {
    tempo: `${tempo} BPM`,
    signature: `${signature.numerator}/${signature.denominator}`,
    trackCount: tracks.length,
    groupCount,
    returnTrackCount: returnTracks.length,
    m4lConnected: cache.isConnected,
    tracks: semanticTracks,
    returnTracks: semanticReturns,
    masterTrack: semanticMaster,
    sessionSummary: generateSessionSummary(
      semanticTracks,
      semanticReturns,
      semanticMaster,
    ),
  };
}
