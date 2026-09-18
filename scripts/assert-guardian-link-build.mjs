import {readdirSync,readFileSync} from "node:fs";
const dir="dist/assets";
const files=readdirSync(dir).filter(x=>x.endsWith(".js"));
let found=false;
for(const file of files){
  const c=readFileSync(`${dir}/${file}`,"utf8");
  if(c.includes("api_guardian_link_for_student")&&c.includes("api_regenerate_guardian_link")){
    found=true;
    break;
  }
}
if(!found)throw new Error("guardian-link-build-assert: guardian link feature missing from production bundle");
console.log("guardian-link-build-assert: production bundle contains guardian link feature");
