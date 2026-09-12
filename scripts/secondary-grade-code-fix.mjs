import { readFileSync, writeFileSync } from "node:fs";

const path = "src/StudentExcelImporter.tsx";
let src = readFileSync(path, "utf8");

src = src.replace(
  '["1", "01", "7", "07", "070", "730", "0730", "10", "100", "1030"]',
  '["1", "01", "7", "07", "070", "730", "0730", "10", "100", "1030", "1314"]'
);

src = src.replace(
  '["2", "02", "8", "08", "080", "830", "0830", "11", "110", "1130"]',
  '["2", "02", "8", "08", "080", "830", "0830", "11", "110", "1130", "1416"]'
);

writeFileSync(path, src);
