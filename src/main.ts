import {
  fetchMojangVersionManifest,
  getOfficialMappings,
  parseOfficial,
} from "./official";
import { Mappings, Type } from "./shared";
import { getIntermediaryMappings, getYarnMappings, parseMapping } from "./tiny";
import './assets/main.css';

const $searchBox = document.getElementById("search") as HTMLInputElement;
const $versionSelect = document.getElementById(
  "version-select",
) as HTMLSelectElement;
const $mappings = document.getElementById("mappings")!;

const versions = await fetchMojangVersionManifest();
versions.versions.forEach((version) => {
  const $version = document.createElement("option");
  $version.value = version.id;
  $version.innerText = version.id;

  $versionSelect.appendChild($version);
});
$versionSelect.value = versions.latest.release;

load($versionSelect.value);

$versionSelect.addEventListener("change", () => load($versionSelect.value));

let merged: MergedMappings = [];

async function load(version: string) {
  $mappings.innerText = "Downloading mappings";

  try {
    const [yarnMappings, intermediaryMappings, mojangMappings] =
      await Promise.all([
        getYarnMappings(version),
        getIntermediaryMappings(version),
        getOfficialMappings(version),
      ]);

    $mappings.innerText = "Parsing mappings";
    const yarnParsed = parseMapping(yarnMappings);
    const intermediaryParsed = parseMapping(intermediaryMappings);
    const officialParsed = parseOfficial(mojangMappings);

    $mappings.innerText = "Merging mappings";
    merged = merge(intermediaryParsed, yarnParsed, officialParsed);

    render();
  } catch (e) {
    $mappings.innerText = `Failed to load mappings\n${e}`;
  }
}

type MergedMappings = {
  type: Type;
  obfuscated: string;
  intermediary: string;
  official?: string;
  officialName?: string;
  yarn?: string;
  yarnName?: string;
  id: number;
}[];

function merge(
  intermediaryMappings: Mappings,
  yarnMappings: Mappings,
  officialMappings: Mappings,
) {
  let id = 0;
  const mappings: MergedMappings = [];
  const types = ["class", "method", "field"] as const;

  for (const type of types) {
    intermediaryMappings.get(type).forEach((intermediary, obfuscated) => {
      const yarn = yarnMappings.get(type).get(intermediary);
      const official = officialMappings.get(type).get(obfuscated);
      let officialName = official;
      let yarnName = yarn;

      if (type === "class") {
        officialName = official?.split(".").pop();
        yarnName = yarn?.split(".").pop();
      }
      if (type !== "class") {
        officialName = official
          ?.replace(/\(.*\)/g, "")
          .split(".")
          .slice(-2)
          .join(".");
        yarnName = yarn
          ?.replace(/\(.*\)/g, "")
          .split(".")
          .slice(-2)
          .join(".");
      }

      mappings.push({
        type,
        obfuscated,
        official,
        officialName,
        intermediary,
        yarn,
        yarnName,
        id: id++,
      });
    });
  }

  return mappings;
}

$searchBox.addEventListener("input", render);

function render() {
  $mappings.innerHTML = "";
  const query = $searchBox.value;

  const filtered = merged
    .filter(
      (m) =>
        m.yarn?.includes(query) ||
        m.intermediary.includes(query) ||
        m.obfuscated.includes(query) ||
        m.official?.includes(query) ||
        m.obfuscated.includes(query),
    )
    .sort(
      (a, b) =>
        (a.yarnName?.length ??
          a.officialName?.length ??
          a.intermediary.length) -
        (b.yarnName?.length ?? b.officialName?.length ?? b.intermediary.length),
    );
  filtered.length = filtered.length > 100 ? 100 : filtered.length;

  filtered.forEach((elem) => {
    const div = document.createElement("div");
    div.className = "mapping-item";

    div.innerHTML = `
      <div>
        <div class="name">${elem.officialName} >> ${elem.yarnName}  </div>
        <div class="type type-${elem.type}">${elem.type}</div>
      </div>
      
      Official: <code class="official">${elem.official}</code>
      Yarn: <code class="yarn">${elem.yarn}</code>
      Intermediary: <code class="intermediary">${elem.intermediary}</code>
      Obfuscated: <code class="obfuscated">${elem.obfuscated}</code>
    `;

    $mappings.appendChild(div);
  });
}
