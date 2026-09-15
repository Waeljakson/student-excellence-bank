import { readFileSync, writeFileSync } from "node:fs";

const path="src/ReferralCenter.tsx";
let src=readFileSync(path,"utf8");

const oldFn='  async function returnToTeacher(r:Referral){const note=(returnDraft[r.id]||"ليست من اختصاصي، يرجى تحويلها لوكيل المدرسة.").trim();setActionBusy(r.id+"r");setGlobalMsg("");try{await rpc("api_return_student_referral_to_teacher",{p_referral_id:r.id,p_note:note});setGlobalMsg(`تم إرجاع التحويل ${r.referral_no} للمعلم مع الرد، وسيظهر له خيار تحويله للوكيل.`);await load()}catch(e){setGlobalMsg(niceError(e))}finally{setActionBusy("")}}';
const newFn='  async function returnToTeacher(r:Referral){const note=(returnDraft[r.id]||"ليست من اختصاصي، يرجى تحويلها لوكيل المدرسة.").trim();setActionBusy(r.id+"r");setGlobalMsg("");try{await rpc("api_return_student_referral_to_teacher",{p_referral_id:r.id,p_note:note});setItems(v=>v.filter(x=>x.id!==r.id));setGlobalMsg(`تم إرجاع التحويل ${r.referral_no} للمعلم بنجاح، وتمت إزالته من الحالات الواردة لديك.`);void load()}catch(e){setGlobalMsg(`لم يتم إرجاع التحويل: ${niceError(e)}`)}finally{setActionBusy("")}}';

if(src.includes(oldFn)) src=src.replace(oldFn,newFn);
else if(!src.includes('تمت إزالته من الحالات الواردة لديك')) throw new Error("referral-return-feedback-fix: return function marker missing");

writeFileSync(path,src);
