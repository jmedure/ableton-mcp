// ============================================================
// Raw types — data as it arrives from the M4L bridge via WebSocket
// ============================================================

export interface RawSessionSnapshot {
  type: "session_snapshot";
  timestamp: number;
  payload: {
    tempo: number;
    signature: { numerator: number; denominator: number };
    sampleRate: number;
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
  arm: boolean;
  monitoring: string; // "in" | "auto" | "off"
  outputRouting: string;
  outputMeterLeft: number; // current meter level 0-1
  outputMeterRight: number;
  hasAudioInput: boolean;
  hasMidiInput: boolean;
  isGroupTrack: boolean;
  groupId: string | null; // id of parent group track
  sends: RawSend[];
  devices: RawDevice[];
  clipNames: string[]; // names of clips in clip slots
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
  sampleRate: string;
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
  armed: boolean;
  monitoring: string;
  group: string | null;
  outputRouting: string;
  outputLevel: string; // human-readable meter level
  sends: Record<string, string>;
  devices: SemanticDevice[];
  clipNames: string[];
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
  | RequestSpectralCommand
  | RequestDetailCommand;

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

export interface RequestDetailCommand {
  type: "request_detail";
  trackId: string;
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
// Bridge performance metrics
// ============================================================

export interface BridgePerf {
  lastPollMs: number;       // most recent bang() execution time
  avgPollMs: number;        // running average
  maxPollMs: number;        // worst case since device load
  pollCount: number;        // total polls since device load
  apiCacheSize: number;     // LiveAPI objects held in memory
  trackCount: number;       // total tracks in snapshot
  snapshotBytes: number;    // last WebSocket message size
  lastStructureRefresh: boolean; // was the last poll a full structure read
  bridgeVersion: string | null;  // version reported by M4L device
}

// ============================================================
// Session cache
// ============================================================

export interface SessionCache {
  raw: RawSessionSnapshot["payload"] | null;
  lastUpdated: number | null;
  isConnected: boolean;
}
