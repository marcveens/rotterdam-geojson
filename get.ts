import fetch from "node-fetch";
import osmtogeojson from "osmtogeojson";
import fs from "fs";
import path from "path";
import slugify from "slugify";
import capitalize from "capitalize";
import input from "./input.json";

const processLocation = async (location: string) => {
  const nominatimResponse = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${location}&format=geojson`
  );
  const nominatimData = await nominatimResponse.json();
  const matches = nominatimData.features.filter(
    (f: any) =>
      f.properties.display_name.includes("Rotterdam") &&
      (f.properties.type === "quarter" || f.properties.type === "neighbourhood")
  );

  if (matches.length === 0) {
    throw new Error(`No match for ${location}`);
  }

  console.log(
    location,
    matches.map((m: any) => m.properties.type)
  );

  const osmId = matches[0].properties.osm_id;

  const osmResponse = await fetch(
    `https://www.openstreetmap.org/api/0.6/relation/${osmId}/full.json`
  );
  const osmData = await osmResponse.json();

  const geojson = osmtogeojson(osmData);

  const dataPath = path.join(__dirname, "data");
  const fileName = slugify(location, {
    lower: true,
    strict: true,
  });
  fs.writeFileSync(`${dataPath}/${fileName}.json`, JSON.stringify(geojson));
};

const resetDataFolder = () => {
  const dataPath = path.join(__dirname, "data");
  fs.rmdirSync(dataPath, { recursive: true });
  fs.mkdirSync(dataPath);
  fs.writeFileSync(`${dataPath}/.gitkeep`, "");
};

const createExportTsFile = () => {
  const dataPath = path.join(__dirname, "data");
  const files = fs.readdirSync(dataPath);
  const exportTs = `// Path: data/index.ts
${files
  .filter((f) => f !== "index.ts" && f !== ".gitkeep")
  .map(
    (f) =>
      `import ${capitalize
        .words(f.replace(".json", ""))
        .replace(/-/g, "")} from "./${f}";`
  )
  .join("\n")}

export default {
${files
  .filter((f) => f !== "index.ts" && f !== ".gitkeep")
  .map(
    (f) =>
      `  ${capitalize
        .words(f.replace(".json", ""))
        .replace(/-/g, "")},`
  )
  .join("\n")}
}
`;
  fs.writeFileSync(`${dataPath}/index.ts`, exportTs);
};

const init = async () => {
  resetDataFolder();

  let processed = 0;
  for (const location of input) {
    try {
      await processLocation(location);
      processed++;
    } catch (e) {
      console.log(`Error processing ${location}`);
    }
  }

  createExportTsFile();

  console.log(`Processed ${processed} of ${input.length} locations`);
};

init();
