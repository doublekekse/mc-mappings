import { Mappings } from "./shared";

export type MojangVersion = {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
};

export type MojangVersionManifest = {
  latest: { release: string; snapshot: string };
  versions: MojangVersion[];
};

export type MojangVersionDetail = {
  downloads: {
    client: { sha1: string; size: number; url: string };
    server: { sha1: string; size: number; url: string };
    client_mappings?: { sha1: string; size: number; url: string };
    server_mappings?: { sha1: string; size: number; url: string };
  };
};

export async function fetchMojangVersionManifest(): Promise<MojangVersionManifest> {
  const response = await fetch(
    "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json",
  );
  return response.json();
}

export async function fetchMojangVersionDetail(
  url: string,
): Promise<MojangVersionDetail> {
  const response = await fetch(url);
  return response.json();
}

export async function getOfficialMappings(gameVersion: string) {
  const manifest = await fetchMojangVersionManifest();
  const version = manifest.versions.find(version => version.id === gameVersion)!;
  const details = await fetchMojangVersionDetail(version.url);
  return downloadOfficialMappings(details);
}

export async function downloadOfficialMappings(
  versionDetail: MojangVersionDetail,
): Promise<string> {
  const officialMappingInfo =
    versionDetail.downloads.client_mappings ||
    versionDetail.downloads.server_mappings;
  if (!officialMappingInfo) {
    throw new Error("No official mappings available in version detail");
  }
  const response = await fetch(officialMappingInfo.url);
  if (!response.ok) {
    throw new Error("Failed to download official mappings");
  }
  return response.text();
}

export function parseOfficial(text: string) {
  const lines = text.split("\n");
  let currentObfuscated: string = '';
  let currentNamed: string = '';
  const mappings = new Mappings();

  const classRegex = /^(\S+)\s+->\s+(\S+):$/;
  const methodRegex =
    /^\s*(?:(\d+:\d+:))?([\w\[\].<>]+)\s+(\S+)\((.*?)\)\s+->\s+(\S+)$/;
  const fieldRegex = /^\s*(?:(\d+:\d+:))?([\w\[\].<>]+)\s+(\S+)\s+->\s+(\S+)$/;

  for (let line of lines) {
    line = line.trimEnd();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    // CLASS
    if (!line.startsWith(" ") && line.endsWith(":")) {
      const classMatch = line.match(classRegex);
      if (classMatch) {
        const from = classMatch[2];
        const to = classMatch[1];

        mappings.push(from, to);

        currentObfuscated = from;
        currentNamed = to;
      }
      continue;
    }
    if (line.trim().startsWith("#")) continue;

    // METHOD
    if (line.includes("(") && line.includes(")")) {
      const m = line.match(methodRegex);
      if (m) {
        const officialMethod = m[3] + "(" + m[4] + ")";
        const obfuscatedMethod = m[5];
        mappings.push(`${currentObfuscated}.${obfuscatedMethod}`, `${currentNamed}.${officialMethod}`)
      }
    } else {
      const m = line.match(fieldRegex);
      // FIELD
      if (m) {
        const officialField = m[3];
        const obfuscatedField = m[4];
        mappings.push(`${currentObfuscated}.${obfuscatedField}`, `${currentNamed}.${officialField}`)
      }
    }
  }

  return mappings;
}
