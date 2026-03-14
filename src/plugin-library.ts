import { readdir, stat } from "fs/promises";
import { join, basename, extname } from "path";
import type { PluginInfo } from "./types.js";

const PLUGIN_DIRS = [
  { path: join(process.env.HOME ?? "", "Library/Audio/Plug-Ins/Components"), format: "AU" as const },
  { path: join(process.env.HOME ?? "", "Library/Audio/Plug-Ins/VST3"), format: "VST3" as const },
  { path: "/Library/Audio/Plug-Ins/Components", format: "AU" as const },
  { path: "/Library/Audio/Plug-Ins/VST3", format: "VST3" as const },
];

async function scanDirectory(
  dirPath: string,
  format: "AU" | "VST3",
): Promise<PluginInfo[]> {
  const plugins: PluginInfo[] = [];

  try {
    const entries = await readdir(dirPath);

    for (const entry of entries) {
      const ext = extname(entry).toLowerCase();
      const expectedExt = format === "AU" ? ".component" : ".vst3";

      if (ext === expectedExt) {
        const name = basename(entry, ext);

        // Attempt to parse manufacturer from name (common pattern: "Manufacturer: Plugin")
        let manufacturer: string | null = null;
        if (name.includes(" - ")) {
          manufacturer = name.split(" - ")[0].trim();
        }

        plugins.push({
          name,
          manufacturer,
          format,
          path: join(dirPath, entry),
        });
      }
    }
  } catch {
    // Directory doesn't exist or isn't readable — skip silently
  }

  return plugins;
}

let cachedPlugins: PluginInfo[] | null = null;

export async function getPluginLibrary(
  filter?: string,
): Promise<PluginInfo[]> {
  if (!cachedPlugins) {
    const results = await Promise.all(
      PLUGIN_DIRS.map((dir) => scanDirectory(dir.path, dir.format)),
    );
    cachedPlugins = results.flat();

    // Deduplicate by name (same plugin may appear in user + system dirs)
    const seen = new Map<string, PluginInfo>();
    for (const plugin of cachedPlugins) {
      const key = `${plugin.name}:${plugin.format}`;
      if (!seen.has(key)) {
        seen.set(key, plugin);
      }
    }
    cachedPlugins = Array.from(seen.values());
    cachedPlugins.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (filter) {
    const lower = filter.toLowerCase();
    return cachedPlugins.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.manufacturer?.toLowerCase().includes(lower) ?? false),
    );
  }

  return cachedPlugins;
}

export function invalidatePluginCache(): void {
  cachedPlugins = null;
}
