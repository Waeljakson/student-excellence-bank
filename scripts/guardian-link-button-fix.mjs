import {readFileSync,writeFileSync} from "node:fs";

const path="src/App.tsx";
let s=readFileSync(path,"utf8");

if(!s.includes('import GuardianAccessLinkButton from "./GuardianAccessLinkButton";')){
  const importMarker='import StudentMobileEditor from "./StudentMobileEditor";';
  if(!s.includes(importMarker)) throw new Error("guardian-link-button-fix: StudentMobileEditor import not found");
  s=s.replace(importMarker,importMarker+'\nimport GuardianAccessLinkButton from "./GuardianAccessLinkButton";');
}

if(!s.includes('<GuardianAccessLinkButton student={s}/>')){
  if(s.includes('<StudentMobileEditor student={s}/>')){
    s=s.replace(
      '<StudentMobileEditor student={s}/>',
      '<StudentMobileEditor student={s}/><GuardianAccessLinkButton student={s}/>'
    );
  }else if(s.includes('<StudentClassEditor student={s} onChanged={reload}/>')){
    s=s.replace(
      '<StudentClassEditor student={s} onChanged={reload}/>',
      '<StudentClassEditor student={s} onChanged={reload}/><GuardianAccessLinkButton student={s}/>'
    );
  }
}

if(!s.includes('<GuardianAccessLinkButton student={s}/>')){
  throw new Error("guardian-link-button-fix: guardian button injection failed");
}

writeFileSync(path,s);
