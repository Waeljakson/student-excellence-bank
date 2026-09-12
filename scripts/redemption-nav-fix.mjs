import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let src = readFileSync(appPath, "utf8");
src = src.replace('["redemption","استبدال النقاط","⇄"]', '["redemption","الاستبدال","⇄"]');
writeFileSync(appPath, src);
