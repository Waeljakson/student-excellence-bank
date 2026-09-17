import {readFileSync,writeFileSync} from "node:fs";
const path="src/App.tsx";
let s=readFileSync(path,"utf8");
if(!s.includes('import StudentMobileEditor from "./StudentMobileEditor";')){
  s=s.replace('import StudentClassEditor from "./StudentClassEditor";','import StudentClassEditor from "./StudentClassEditor";\nimport StudentMobileEditor from "./StudentMobileEditor";');
}
const old='<StudentClassEditor student={s} onChanged={reload}/>';
const replacement='<div className="student-row-actions"><StudentClassEditor student={s} onChanged={reload}/><StudentMobileEditor student={s}/></div>';
if(s.includes(old)&&!s.includes('<StudentMobileEditor student={s}/>'))s=s.replace(old,replacement);
writeFileSync(path,s);
