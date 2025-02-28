import { Mappings } from "./mappings";

function typeToCommon(type: string, mappings?: Mappings): string {
  const typeMap: { [key: string]: string } = {
    V: "void",
    I: "int",
    F: "float",
    D: "double",
    J: "long",
    Z: "boolean",
    B: "byte",
    C: "char",
    S: "short",
  };

  if (type in typeMap) return typeMap[type];

  return mapType(type, mappings);
}

function typeToTiny(type: string): string {
  const typeMap: { [key: string]: string } = {
    void: "V",
    int: "I",
    float: "F",
    double: "D",
    long: "J",
    boolean: "Z",
    byte: "B",
    char: "C",
    short: "S",
  };

  if (type in typeMap) return typeMap[type];

  return "L" + type.replace(/\./g, "/") + ";";
}

function mapType(type: string, mappings?: Mappings): string {
  // Object type (L<classname>;)
  if (type.startsWith("L")) {
    const className = type.slice(1, -1).replace(/\//g, ".");

    if (!mappings) {
      return className;
    }

    return mappings.classes.get(className) ?? className;
  }
  return type;
}

function methodToCommon(descriptor: string, mappings?: Mappings): string {
  const match = descriptor.match(/\((.*?)\)(.+)/);
  if (!match) return "Invalid format";

  const [, paramStr, returnTypeCode] = match;

  const returnType = typeToCommon(returnTypeCode, mappings);

  const params: string[] = [];
  let remainingParams = paramStr;

  while (remainingParams.length > 0) {
    // Object type (L<classname>;)
    if (remainingParams.startsWith("L")) {
      const endIndex = remainingParams.indexOf(";");
      if (endIndex === -1) break;
      params.push(
        typeToCommon(remainingParams.substring(0, endIndex + 1), mappings),
      );
      remainingParams = remainingParams.slice(endIndex + 1);
    } else {
      params.push(typeToCommon(remainingParams[0], mappings));
      remainingParams = remainingParams.slice(1);
    }
  }

  return `${returnType}::${params.join(",")}`;
}

function methodToTiny(descriptor: string): string {
  const [returnType, paramsType] = descriptor.split("::");

  const tinyReturnType = typeToTiny(returnType);

  const tinyParamsType = paramsType
    ? paramsType.split(",").map(typeToTiny).join("")
    : "";
  return `(${tinyParamsType})${tinyReturnType}`;
}

function fieldToCommon(descriptor: string, mappings?: Mappings): string {
  return typeToCommon(descriptor, mappings);
}

function fieldToTiny(descriptor: string): string {
  return typeToTiny(descriptor);
}

export function descriptorToCommon(
  type: "method" | "field",
  descriptor: string,
  mappings?: Mappings,
): string {
  if (type === "method") {
    return methodToCommon(descriptor, mappings);
  } else if (type === "field") {
    return fieldToCommon(descriptor, mappings);
  }

  throw new Error("Unsupported type");
}

export function descriptorToTiny(type: "method" | "field", descriptor: string) {
  if (type === "method") {
    return methodToTiny(descriptor);
  } else if (type === "field") {
    return fieldToTiny(descriptor);
  }

  throw new Error("Unsupported type");
}

export function format(
  type: "method" | "field",
  name: string,
  descriptor: string,
) {
  if (type === "method") {
    const [returnType, paramsType] = descriptor.split("::");
    return `${returnType.split(".").pop()} ${name}(${paramsType
      .split(",")
      .map((paramType) => paramType.split(".").pop())
      .join(", ")})`;
  }
  if (type === "field") {
    return `${descriptor.split(".").pop()} ${name}`;
  }

  throw new Error("Unsupported type");
}
