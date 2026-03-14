// ============================================================
// Raw types — data as it arrives from the M4L bridge via WebSocket
// ============================================================

export interface RawSessionSnapshot {
  type: "session_snapshot";
  timestamp: number;
  payload: {
    tempo: number;
    signature: { numerator: number; denominator: number };
    tracks: RawTrack[];
    returnTracks: RawTrack[];
    masterTrack: RawTrack;
  };
}

export interface RawTrack {
  id: string;
  name: string;
  color: number;
  type: "audio" | "midi" | "group" | "return" | "master";
  volume: number; // 0-1
  panning: number; // -1 to 1
  mute: boolean;
  solo: boolean;
  outputRouting: string;
  hasAudioInput: boolean;
  hasMidiInput: boolean;
  isGroupTrack: boolean;
  groupId: string | null;
  sends: RawSend[];
  devices: RawDevice[];
}

export interface RawSend {
  returnTrackId: string;
  amount: number; // 0-1
}

export interface RawDevice {
  id: string;
  name: string;
  type: string; // "AudioEffectDevice", "MidiEffectDevice", etc.
  className: string; // "Compressor", "Eq8", "PluginDevice"
  isActive: boolean;
  parameters: RawParameter[];
}

export interface RawParameter {
  name: string;
  value: number;
  min: number;
  max: number;
  isQuantized: boolean;
}

// ============================================================
// Semantic types — human-readable, what Claude sees
// ============================================================

export interface SemanticSession {
  tempo: string;
  signature: string;
  trackCount: number;
  groupCount: number;
  returnTrackCount: number;
  m4lConnected: boolean;
  tracks: SemanticTrack[];
  returnTracks: SemanticTrack[];
  masterTrack: SemanticTrack;
  sessionSummary: string;
}

export interface SemanticTrack {
  id: string;
  name: string;
  type: string;
  volume: string;
  panning: string;
  muted: boolean;
  soloed: boolean;
  group: string | null;
  outputRouting: string;
  sends: Record<string, string>;
  devices: SemanticDevice[];
}

export interface SemanticDevice {
  id: string;
  name: string;
  active: boolean;
  isThirdParty: boolean;
  parameters: Record<string, string>;
  observations: string[];
}

// ============================================================
// Spectral types
// ============================================================

export interface SpectralSnapshot {
  source: string;
  timestamp: number;
  windowSeconds: number;
  bands: SpectralBand[];
}

export interface SpectralBand {
  label: string;
  rangeHz: [number, number];
  peakDb: number;
  rmsDb: number;
}

// ============================================================
// WebSocket command types — server → M4L bridge
// ============================================================

export type BridgeCommand =
  | SetParameterCommand
  | SetDeviceActiveCommand
  | CreateGroupCommand
  | SetRoutingCommand
  | AddDeviceCommand
  | RequestSpectralCommand;

export interface SetParameterCommand {
  type: "set_parameter";
  trackId: string;
  deviceId: string;
  parameterName: string;
  value: number; // raw 0-1
}

export interface SetDeviceActiveCommand {
  type: "set_device_active";
  trackId: string;
  deviceId: string;
  isActive: boolean;
}

export interface CreateGroupCommand {
  type: "create_group";
  trackIds: string[];
  groupName: string;
}

export interface SetRoutingCommand {
  type: "set_routing";
  trackId: string;
  outputTarget: string;
}

export interface AddDeviceCommand {
  type: "add_device";
  trackId: string;
  deviceName: string;
  position: number;
}

export interface RequestSpectralCommand {
  type: "request_spectral";
  source: string; // "master" or track id
}

// ============================================================
// Plugin library types
// ============================================================

export interface PluginInfo {
  name: string;
  manufacturer: string | null;
  format: "AU" | "VST3";
  path: string;
}

// ============================================================
// Heuristic types
// ============================================================

export type HeuristicSeverity = "info" | "warning" | "issue";

export interface HeuristicFinding {
  id: string;
  severity: HeuristicSeverity;
  track: string | null;
  device: string | null;
  message: string;
  suggestion: string | null;
}

// ============================================================
// Session cache
// ============================================================

export interface SessionCache {
  raw: RawSessionSnapshot["payload"] | null;
  lastUpdated: number | null;
  isConnected: boolean;
}
