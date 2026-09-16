import { readFileSync, writeFileSync } from "node:fs";

const path="src/App.tsx";
let src=readFileSync(path,"utf8");

if(!src.includes('import NotificationCenter from "./NotificationCenter";')){
  const marker='import StudentClassEditor from "./StudentClassEditor";';
  if(!src.includes(marker)) throw new Error("NotificationCenter import marker not found");
  src=src.replace(marker,`${marker}\nimport NotificationCenter from "./NotificationCenter";`);
}

if(!src.includes('<NotificationCenter/>')){
  const marker='<div className="main-area">{children}';
  if(!src.includes(marker)) throw new Error("NotificationCenter shell marker not found");
  src=src.replace(marker,'<div className="main-area"><NotificationCenter/>{children}');
}

writeFileSync(path,src);
