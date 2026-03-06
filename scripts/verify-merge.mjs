import { readFileSync } from "fs";
const v = JSON.parse(readFileSync("data/plants/vegetables.json"));
const h = JSON.parse(readFileSync("data/plants/herbs.json"));
const f = JSON.parse(readFileSync("data/plants/flowers.json"));
const fr = JSON.parse(readFileSync("data/plants/fruits.json"));
const all = [...v, ...h, ...f, ...fr];
console.log("Total:", all.length);
console.log("All have cropGroup:", all.every((e) => e.cropGroup));
console.log("With scheduling:", all.filter((e) => e.scheduling).length);
console.log("Without scheduling:", all.filter((e) => !e.scheduling).length);
const keys = all.map((e) => e.species + "::" + (e.variety || ""));
const seen = new Set();
const dupes = [];
for (const k of keys) {
  if (seen.has(k)) dupes.push(k);
  seen.add(k);
}
console.log("Cross-file duplicates:", dupes.length === 0 ? "none" : dupes);
const tomato = v.find(
  (e) => e.variety === "Cherry" && e.species === "Solanum lycopersicum",
);
console.log("Cherry Tomato scheduling:", JSON.stringify(tomato.scheduling));
console.log("Cherry Tomato cropGroup:", tomato.cropGroup);
console.log("Cherry Tomato family:", tomato.family);

// Show cropGroups
const cropGroups = new Set(all.map((e) => e.cropGroup));
console.log("\nUnique cropGroups:", cropGroups.size);
console.log("cropGroups:", [...cropGroups].sort().join(", "));
