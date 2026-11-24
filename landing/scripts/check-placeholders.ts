import { productionPlaceholders } from "../src/site.config.ts";

const { blockers, omitted } = productionPlaceholders();
if (omitted.length > 0) {
  console.log("Omitted from the production HTML until they have real content:");
  for (const item of omitted) console.log(`  - ${item}`);
}
if (blockers.length > 0) {
  console.error("\nProduction build stopped. Fill these in src/site.config.ts:");
  for (const item of blockers) console.error(`  - ${item}`);
  process.exit(1);
}
console.log("Placeholder check passed.");
