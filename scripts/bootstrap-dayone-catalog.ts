import { bootstrapDayOneCatalogs } from "../src/lib/dayone-catalog-bootstrap.ts";

const report = await bootstrapDayOneCatalogs();
console.log(JSON.stringify(report, null, 2));
if (report.seeded.length === 0) {
  console.error("No Day One Electric workspace was found. Catalog was not seeded into any other company.");
  process.exit(2);
}
const failed = report.seeded.filter((row) => !row.inserted);
if (failed.length) {
  console.error("Day One catalog seed failed for", failed.map((row) => row.name).join(", "));
  process.exit(1);
}
