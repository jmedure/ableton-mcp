import { compressorMap } from "./compressor.js";
import { eqEightMap } from "./eq-eight.js";
import { genericMap } from "./generic.js";

// ============================================================
// Parameter map types
// ============================================================

export interface ParamMapEntry {
  unit: string;
  toHuman: (raw: number) => string;
  fromHuman?: (value: number, unit: string) => number; // human → raw 0-1
  observe?: (raw: number, human: string) => string | null;
}

export interface ParamMap {
  deviceClassName: string;
  parameters: Record<string, ParamMapEntry>;
}

// ============================================================
// Registry
// ============================================================

const registry = new Map<string, ParamMap>();

function register(map: ParamMap): void {
  registry.set(map.deviceClassName, map);
}

register(compressorMap);
register(eqEightMap);
// TODO: register remaining maps as they're implemented
// register(glueCompressorMap);
// register(reverbMap);
// register(delayMap);
// register(saturatorMap);
// register(limiterMap);
// register(gateMap);
// register(autoFilterMap);
// register(chorusMap);

export function lookupParamMap(deviceClassName: string): ParamMap | null {
  return registry.get(deviceClassName) ?? null;
}

export function translateParameter(
  deviceClassName: string,
  paramName: string,
  rawValue: number,
  paramMap: ParamMap | null,
): string {
  const entry = paramMap?.parameters[paramName];
  if (entry) {
    return entry.toHuman(rawValue);
  }
  // Fallback: generic percentage
  return genericMap.parameters["_default"].toHuman(rawValue);
}

export function humanToRaw(
  deviceClassName: string,
  paramName: string,
  value: number,
  unit: string,
): number | null {
  const map = registry.get(deviceClassName);
  const entry = map?.parameters[paramName];
  if (entry?.fromHuman) {
    return entry.fromHuman(value, unit);
  }
  // No conversion available — caller must handle
  return null;
}
