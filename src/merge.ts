import { descriptorToCommon, descriptorToTiny, format } from "./descriptor";
import { Mappings, Type } from "./mappings";

export type SplitMappings = {
  intermediary: Mappings;
  yarn: Mappings;
  official: Mappings;
};

type MergedMapping = {
  type: Type;

  obfuscatedName: string;
  intermediaryName: string;
  officialName?: string;
  yarnName?: string;

  officialShortName?: string;
  yarnShortName?: string;
};

export type MergedMappings = MergedMapping[];

function getDescriptors(
  mappings: SplitMappings,
  type: "method" | "field",
  obfuscatedTinyDescriptor: string,
) {
  const obfuscatedDescriptor = descriptorToCommon(
    type,
    obfuscatedTinyDescriptor,
  );
  const intermediaryDescriptor = descriptorToCommon(
    type,
    obfuscatedTinyDescriptor,
    mappings.intermediary,
  );
  const intermediaryTinyDescriptor = descriptorToTiny(
    type,
    intermediaryDescriptor,
  );
  const yarnDescriptor = descriptorToCommon(
    type,
    intermediaryTinyDescriptor,
    mappings.yarn,
  );
  const officialDescriptor = descriptorToCommon(
    type,
    obfuscatedTinyDescriptor,
    mappings.official,
  );

  return {
    obfuscatedDescriptor,
    obfuscatedTinyDescriptor,
    intermediaryDescriptor,
    intermediaryTinyDescriptor,
    yarnDescriptor,
    officialDescriptor,
  };
}

function getShortName(path: string | undefined) {
  return path
    ?.replace(/\(.*\)/g, "")
    .split(".")
    .slice(-2)
    .join(".");
}

function mergeMethodOrField(
  mappings: SplitMappings,
  type: "method" | "field",
  intermediaryName: string,
  obfuscated: string,
): MergedMapping {
  const [obfuscatedTinyDescriptor, obfuscatedName] = obfuscated.split("###");
  const descriptors = getDescriptors(mappings, type, obfuscatedTinyDescriptor);

  const yarnName = mappings.yarn.get(
    type,
    descriptors.intermediaryTinyDescriptor,
    intermediaryName,
  );

  const officialName = mappings.official.get(
    type,
    descriptors.officialDescriptor,
    obfuscatedName,
  );

  const officialShortName = getShortName(officialName);
  const yarnShortName = getShortName(yarnName);

  return {
    type,
    obfuscatedName: format(
      type,
      obfuscatedName,
      descriptors.obfuscatedDescriptor,
    ),
    intermediaryName: format(
      type,
      intermediaryName,
      descriptors.intermediaryDescriptor,
    ),
    officialName: officialName
      ? format(type, officialName, descriptors.officialDescriptor)
      : undefined,
    yarnName: yarnName
      ? format(type, yarnName, descriptors.yarnDescriptor)
      : undefined,

    officialShortName,
    yarnShortName,
  };
}

function mergeClass(
  mappings: SplitMappings,
  intermediaryName: string,
  obfuscatedName: string,
): MergedMapping {
  const yarnName = mappings.yarn.classes.get(intermediaryName);
  const officialName = mappings.official.classes.get(obfuscatedName);

  const officialShortName = officialName?.split(".").pop();
  const yarnShortName = yarnName?.split(".").pop();

  return {
    type: "class",
    obfuscatedName,
    officialName,
    yarnName,
    intermediaryName,

    officialShortName,
    yarnShortName,
  };
}

export function merge(mappings: SplitMappings) {
  const mergedMappings: MergedMappings = [];
  const types = ["class", "method", "field"] as const;

  for (const type of types) {
    mappings.intermediary.getType(type).forEach((intermediary, obfuscated) => {
      if (type === "class") {
        mergedMappings.push(mergeClass(mappings, intermediary, obfuscated));
      } else {
        mergedMappings.push(
          mergeMethodOrField(mappings, type, intermediary, obfuscated),
        );
      }
    });
  }

  return mergedMappings;
}
