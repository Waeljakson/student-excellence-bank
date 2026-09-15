import { readFileSync, writeFileSync } from "node:fs";

const path="src/ReferralCenter.tsx";
let src=readFileSync(path,"utf8");

if(!src.includes('returned_to_teacher?:boolean;')){
  src=src.replace('guidance_return_note?:string|null;guidance_returned_at?:string|null;guidance_returned_by_name?:string|null;',
    'guidance_return_note?:string|null;guidance_returned_at?:string|null;guidance_returned_by_name?:string|null;returned_to_teacher?:boolean;');
}

src=src.replaceAll('isTeacher&&r.target_role==="TEACHER"','isTeacher&&r.returned_to_teacher===true');

writeFileSync(path,src);
