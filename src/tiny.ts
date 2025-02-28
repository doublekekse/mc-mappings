import JSZip from "jszip";
import { Mappings } from "./mappings";

type MappingId = "yarn" | "intermediary";

function getUrl(mapping: MappingId) {
  return `https://meta.fabricmc.net/v2/versions/${mapping}`;
}

export type YarnVersionEntry = {
  gameVersion: string;
  seperator: string;
  build: number;
  maven: string;
  version: string;
  stable: boolean;
};

export type IntermediaryVersionEntry = {
  version: string;
  maven: string;
  stable: boolean;
};

export async function yarnMetadata(): Promise<YarnVersionEntry[]> {
  const response = await fetch(getUrl("yarn"));
  return response.json();
}

export async function intermediaryMetadata(): Promise<
  IntermediaryVersionEntry[]
> {
  const response = await fetch(getUrl("intermediary"));
  return response.json();
}

function getMavenUrl(coordinate: string): string {
  const parts = coordinate.split(":");
  if (parts.length !== 3) {
    throw new Error(`Invalid Maven coordinate: ${coordinate}`);
  }

  const [group, artifact, version] = parts;
  const groupPath = group.replace(/\./g, "/");
  return `https://maven.fabricmc.net/${groupPath}/${artifact}/${version}/${artifact}-${version}-v2.jar`;
}

export async function getMappings(url: string) {
  const response = await fetch(url);
  const jarBlob = await response.blob();

  const zip = await JSZip.loadAsync(jarBlob);

  const mappingsFile = zip.file("mappings/mappings.tiny");
  return mappingsFile!.async("string");
}

export async function getYarnMappings(gameVersion: string) {
  const yarn = await yarnMetadata();
  const yarnVersion = yarn
    .filter((version) => version.gameVersion === gameVersion)
    .reduce((prev, curr) => (curr.build > prev.build ? curr : prev));
  const url = getMavenUrl(yarnVersion.maven);
  return getMappings(url);
}

export async function getIntermediaryMappings(gameVersion: string) {
  const intermediary = await intermediaryMetadata();
  const intermediaryVersion = intermediary.filter(
    (version) => version.version === gameVersion,
  )[0];
  const url = getMavenUrl(intermediaryVersion.maven);
  return getMappings(url);
}

function parseV2(lines: string[]) {
  const mappings = new Mappings();
  let stackNamed: string[] = [];
  let stackIntermediary: string[] = [];
  let currentNamed: string = "";
  let currentIntermediary: string = "";

  for (const line of lines) {
    const fields = line.split("\t");
    const layer = fields.findIndex((c) => c);

    if (layer === -1) {
      continue;
    }

    if (stackNamed.length > layer) {
      stackNamed.length = layer;
      stackIntermediary.length = layer;
    } else if (stackNamed.length < layer) {
      stackNamed.push(currentNamed);
      stackIntermediary.push(currentIntermediary);
    }

    const [type, ...rest] = fields.slice(layer);

    // CLASS
    if (type === "c" && layer === 0) {
      const [intermediary, named] = rest;
      mappings.class(
        intermediary.replaceAll("/", "."),
        named.replaceAll("/", "."),
      );

      currentNamed = named;
      currentIntermediary = intermediary;
    }
    // METHOD
    if (type === "m" || type === "f") {
      const [descriptor, intermediary, named] = rest;
      const pathNamed = stackNamed
        .concat([named])
        .join(".")
        .replaceAll("/", ".");
      const pathIntermediary = stackIntermediary
        .concat([intermediary])
        .join(".")
        .replaceAll("/", ".");

      mappings.push(
        descriptor + "###" + pathIntermediary,
        pathNamed,
        type === "m" ? "method" : "field",
      );

      currentNamed = named;
      currentIntermediary = intermediary;
    }
  }

  return mappings;
}

export function parseMapping(mapping: string) {
  const lines = mapping.split("\n");
  const [a, b] = lines.shift()?.split("\t")!;

  if (a === "v1") {
    throw new Error("Tiny v1 mappings are currently not supported");
  }
  if (b === "2") {
    return parseV2(lines);
  }

  throw new Error("Unsupported mappings");
}
