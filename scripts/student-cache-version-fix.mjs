import { readFileSync, writeFileSync } from "node:fs";

const path="src/StudentPortal.tsx";
let src=readFileSync(path,"utf8");
const old='rpc<CacheVersions>("api_cache_versions")';
const next='rpc<CacheVersions>("api_student_cache_version")';
if(src.includes(old)) src=src.replace(old,next);
else if(!src.includes('api_student_cache_version')) throw new Error("student-cache-version-fix: cache version call missing");
writeFileSync(path,src);
