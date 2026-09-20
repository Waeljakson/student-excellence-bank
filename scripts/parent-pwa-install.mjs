import {readFileSync} from "node:fs";

const sourceIndex=readFileSync("source-index.html","utf8");
const install=readFileSync("src/InstallAppButton.tsx","utf8");
const manifest=JSON.parse(readFileSync("public/parent-manifest.webmanifest","utf8"));

if(!sourceIndex.includes("parent-manifest.webmanifest")||!sourceIndex.includes('get("parent") === "1"')){
  throw new Error("parent-pwa-install: dynamic parent manifest is missing");
}
if(!install.includes("تثبيت بوابة ولي الأمر")||!install.includes("تفتح مباشرة على بوابة ولي الأمر")){
  throw new Error("parent-pwa-install: parent install messaging is missing");
}
if(manifest.id!=="/student-excellence-bank/parent-portal"){
  throw new Error("parent-pwa-install: parent manifest id must be distinct");
}
if(manifest.start_url!=="/student-excellence-bank/?parent=1"){
  throw new Error("parent-pwa-install: parent start_url is incorrect");
}
console.log("parent-pwa-install: separate guardian PWA identity and start URL verified");
