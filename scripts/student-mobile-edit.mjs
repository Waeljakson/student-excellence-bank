import {readFileSync,writeFileSync} from "node:fs";
const path="src/App.tsx";
let s=readFileSync(path,"utf8");

if(!s.includes('import StudentMobileEditor from "./StudentMobileEditor";')){
  s=s.replace(
    'import StudentClassEditor from "./StudentClassEditor";',
    'import StudentClassEditor from "./StudentClassEditor";\nimport StudentMobileEditor from "./StudentMobileEditor";'
  );
}

if(!s.includes('import GuardianAccessLinkButton from "./GuardianAccessLinkButton";')){
  s=s.replace(
    'import StudentMobileEditor from "./StudentMobileEditor";',
    'import StudentMobileEditor from "./StudentMobileEditor";\nimport GuardianAccessLinkButton from "./GuardianAccessLinkButton";'
  );
}

const bare='<StudentClassEditor student={s} onChanged={reload}/>';
const mobileOnly='<div className="student-row-actions"><StudentClassEditor student={s} onChanged={reload}/><StudentMobileEditor student={s}/></div>';
const withGuardian='<div className="student-row-actions"><StudentClassEditor student={s} onChanged={reload}/><StudentMobileEditor student={s}/><GuardianAccessLinkButton student={s}/></div>';

if(s.includes(bare) && !s.includes('<StudentMobileEditor student={s}/>')){
  s=s.replace(bare,withGuardian);
}else if(s.includes(mobileOnly) && !s.includes('<GuardianAccessLinkButton student={s}/>')){
  s=s.replace(mobileOnly,withGuardian);
}else if(s.includes('<StudentMobileEditor student={s}/></div>') && !s.includes('<GuardianAccessLinkButton student={s}/>')){
  s=s.replace(
    '<StudentMobileEditor student={s}/></div>',
    '<StudentMobileEditor student={s}/><GuardianAccessLinkButton student={s}/></div>'
  );
}

writeFileSync(path,s);
