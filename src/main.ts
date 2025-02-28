import {
  fetchMojangVersionManifest,
  getOfficialMappings,
  parseOfficial,
} from "./official";
import { getIntermediaryMappings, getYarnMappings, parseMapping } from "./tiny";
import { merge, type MergedMappings } from "./merge";
import "./assets/main.css";

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
$versionSelect.addEventListener("change", () => load($versionSelect.value));

let merged: MergedMappings = [];

async function load(version: string) {
  $mappings.innerText = "Downloading mappings";
  merged = [];

  try {
    const [yarnMappings, intermediaryMappings, mojangMappings] =
      await Promise.all([
        getYarnMappings(version),
        getIntermediaryMappings(version),
        getOfficialMappings(version),
      ]);

    $mappings.innerText = "Parsing mappings";
    const yarn = parseMapping(yarnMappings);
    const intermediary = parseMapping(intermediaryMappings);
    const official = parseOfficial(mojangMappings);

    $mappings.innerText = "Merging mappings";
    merged = merge({ intermediary, yarn, official });

    render();
  } catch (e) {
    $mappings.innerText = `Failed to load mappings\n${e}`;
    console.error(e);
  }
}

function render() {
  if (!merged || !merged.length) {
    return;
  }

  const query = $searchBox.value;

  const filtered = merged
    .filter(
      (m) =>
        m.yarnName?.includes(query) ||
        m.intermediaryName.includes(query) ||
        m.obfuscatedName.includes(query) ||
        m.officialName?.includes(query) ||
        m.obfuscatedName.includes(query),
    )
    .sort(
      (a, b) =>
        (a.yarnShortName?.length ??
          a.officialShortName?.length ??
          a.intermediaryName.length) -
        (b.yarnShortName?.length ??
          b.officialShortName?.length ??
          b.intermediaryName.length),
    );
  filtered.length = filtered.length > 100 ? 100 : filtered.length;

  $mappings.innerHTML = "";

  filtered.forEach((elem) => {
    const div = document.createElement("div");
    div.className = "mapping-item";

    div.innerHTML = `
      <div>
        <div class="name">${elem.officialShortName} >> ${elem.yarnShortName}</div>
        <div class="tye type-${elem.type}">${elem.type}</div>
      </div>
      
      Official: <code class="official">${elem.officialName}</code>
      Yarn: <code class="yarn">${elem.yarnName}</code>
      Intermediary: <code class="intermediary">${elem.intermediaryName}</code>
      Obfuscated: <code class="obfuscated">${elem.obfuscatedName}</code>
    `;

    $mappings.appendChild(div);
  });
}

$searchBox.addEventListener("input", render);
load($versionSelect.value);
