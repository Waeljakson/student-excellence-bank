import { readFileSync, writeFileSync } from "node:fs";

const path="src/ReferralCenter.tsx";
let src=readFileSync(path,"utf8");

if(!src.includes('import "./referral-routing.css";')){
  src=src.replace('import "./referrals.css";','import "./referrals.css";\nimport "./referral-routing.css";');
}

src=src.replace('target_role:"VICE_PRINCIPAL"|"GUIDANCE_COUNSELOR";target_label:string;','target_role:"VICE_PRINCIPAL"|"GUIDANCE_COUNSELOR"|"TEACHER";target_label:string;');

if(!src.includes('guidance_return_note?:string|null;')){
  src=src.replace('deducted_by_name?:string|null;completed_by_name?:string|null;wallet_points:number;','deducted_by_name?:string|null;completed_by_name?:string|null;wallet_points:number;\n  guidance_return_note?:string|null;guidance_returned_at?:string|null;guidance_returned_by_name?:string|null;');
}

if(!src.includes('const isGuidance=roles.includes("GUIDANCE_COUNSELOR")')){
  src=src.replace('const isTeacher=roles.includes("TEACHER");','const isTeacher=roles.includes("TEACHER");\n  const isGuidance=roles.includes("GUIDANCE_COUNSELOR");');
}

if(!src.includes('const[returnDraft,setReturnDraft]')){
  src=src.replace('const[deductDraft,setDeductDraft]=useState<Record<string,string>>({});const[noteDraft,setNoteDraft]=useState<Record<string,string>>({});const[completeDraft,setCompleteDraft]=useState<Record<string,string>>({});const[actionBusy,setActionBusy]=useState("");',
  'const[deductDraft,setDeductDraft]=useState<Record<string,string>>({});const[noteDraft,setNoteDraft]=useState<Record<string,string>>({});const[completeDraft,setCompleteDraft]=useState<Record<string,string>>({});const[returnDraft,setReturnDraft]=useState<Record<string,string>>({});const[actionBusy,setActionBusy]=useState("");');
}

if(!src.includes('async function returnToTeacher(r:Referral)')){
  const marker='  async function complete(r:Referral){setActionBusy(r.id+"c");setGlobalMsg("");try{await rpc("api_complete_student_referral",{p_referral_id:r.id,p_completion_note:completeDraft[r.id]||null});setGlobalMsg(`تم إنهاء التحويل ${r.referral_no} ونقله إلى أرشيف التحويلات المنتهية.`);await load();setTab("COMPLETED")}catch(e){setGlobalMsg(niceError(e))}finally{setActionBusy("")}}';
  if(!src.includes(marker)) throw new Error("referral-return-routing: complete marker missing");
  src=src.replace(marker,marker+'\n  async function returnToTeacher(r:Referral){const note=(returnDraft[r.id]||"ليست من اختصاصي، يرجى تحويلها لوكيل المدرسة.").trim();setActionBusy(r.id+"r");setGlobalMsg("");try{await rpc("api_return_student_referral_to_teacher",{p_referral_id:r.id,p_note:note});setGlobalMsg(`تم إرجاع التحويل ${r.referral_no} للمعلم مع الرد، وسيظهر له خيار تحويله للوكيل.`);await load()}catch(e){setGlobalMsg(niceError(e))}finally{setActionBusy("")}}\n  async function forwardToVice(r:Referral){setActionBusy(r.id+"v");setGlobalMsg("");try{await rpc("api_forward_returned_referral_to_vice",{p_referral_id:r.id});setGlobalMsg(`تم تحويل ${r.referral_no} إلى وكيل المدرسة بنفس بيانات التحويل ورد الموجه.`);await load()}catch(e){setGlobalMsg(niceError(e))}finally{setActionBusy("")}}');
}

const oldCard='<ReferralCard key={r.id} r={r} canHandle={canHandle} deductDraft={deductDraft} setDeductDraft={setDeductDraft} noteDraft={noteDraft} setNoteDraft={setNoteDraft} completeDraft={completeDraft} setCompleteDraft={setCompleteDraft} actionBusy={actionBusy} deduct={deduct} complete={complete}/>';
const newCard='<ReferralCard key={r.id} r={r} canHandle={canHandle} isTeacher={isTeacher} isGuidance={isGuidance} deductDraft={deductDraft} setDeductDraft={setDeductDraft} noteDraft={noteDraft} setNoteDraft={setNoteDraft} completeDraft={completeDraft} setCompleteDraft={setCompleteDraft} returnDraft={returnDraft} setReturnDraft={setReturnDraft} actionBusy={actionBusy} deduct={deduct} complete={complete} returnToTeacher={returnToTeacher} forwardToVice={forwardToVice}/>';
if(src.includes(oldCard)) src=src.replace(oldCard,newCard);
else if(!src.includes('returnToTeacher={returnToTeacher}')) throw new Error("referral-return-routing: card invocation marker missing");

const oldSig='function ReferralCard({r,canHandle,deductDraft,setDeductDraft,noteDraft,setNoteDraft,completeDraft,setCompleteDraft,actionBusy,deduct,complete}:{r:Referral;canHandle:boolean;deductDraft:Record<string,string>;setDeductDraft:any;noteDraft:Record<string,string>;setNoteDraft:any;completeDraft:Record<string,string>;setCompleteDraft:any;actionBusy:string;deduct:(r:Referral)=>void;complete:(r:Referral)=>void}){';
const newSig='function ReferralCard({r,canHandle,isTeacher,isGuidance,deductDraft,setDeductDraft,noteDraft,setNoteDraft,completeDraft,setCompleteDraft,returnDraft,setReturnDraft,actionBusy,deduct,complete,returnToTeacher,forwardToVice}:{r:Referral;canHandle:boolean;isTeacher:boolean;isGuidance:boolean;deductDraft:Record<string,string>;setDeductDraft:any;noteDraft:Record<string,string>;setNoteDraft:any;completeDraft:Record<string,string>;setCompleteDraft:any;returnDraft:Record<string,string>;setReturnDraft:any;actionBusy:string;deduct:(r:Referral)=>void;complete:(r:Referral)=>void;returnToTeacher:(r:Referral)=>void;forwardToVice:(r:Referral)=>void}){';
if(src.includes(oldSig)) src=src.replace(oldSig,newSig);
else if(!src.includes('forwardToVice:(r:Referral)=>void')) throw new Error("referral-return-routing: card signature marker missing");

if(!src.includes('className="guidance-return-note"')){
  const marker='    {r.deducted_points>0&&<div className="deduction-done"><b>تم خصم {r.deducted_points} نقطة</b><span>{r.deduction_note||"خصم نقاط بناء على التحويل"} · {r.deducted_by_name||""} · {fmt(r.deducted_at)}</span></div>}';
  if(!src.includes(marker)) throw new Error("referral-return-routing: deduction marker missing");
  const addition='\n    {r.guidance_return_note&&<div className="guidance-return-note"><b>رد الموجه الطلابي</b><span>{r.guidance_return_note}</span><small>{r.guidance_returned_by_name||"الموجه الطلابي"} · {fmt(r.guidance_returned_at)}</small></div>}\n    {isTeacher&&r.target_role==="TEACHER"&&<div className="teacher-forward-box no-print"><div className="return-head"><b>التحويل عاد إليك من الموجه الطلابي</b><span>بعد مراجعة رد الموجه يمكنك تحويل نفس التحويل مباشرة إلى وكيل المدرسة دون إعادة كتابة البيانات.</span></div><button className="btn primary" disabled={actionBusy===r.id+"v"} onClick={()=>forwardToVice(r)}>{actionBusy===r.id+"v"?"جارٍ التحويل...":"تحويل للوكيل"}</button></div>}';
  src=src.replace(marker,marker+addition);
}

if(!src.includes('className="referral-return-box"')){
  const marker='      <div className="complete-box"><div><b>إنهاء التحويل</b><span>بعد الإنهاء ينتقل التحويل مباشرة إلى تقرير التحويلات المنتهية.</span></div><input placeholder="الإجراء الذي تم — اختياري (الافتراضي: تم اللازم)" value={completeDraft[r.id]||""} onChange={e=>setCompleteDraft((v:any)=>({...v,[r.id]:e.target.value}))}/><button className="btn primary" disabled={actionBusy===r.id+"c"} onClick={()=>complete(r)}>{actionBusy===r.id+"c"?"جارٍ الإنهاء...":"تم الإجراء ونقل للأرشيف"}</button></div>';
  if(!src.includes(marker)) throw new Error("referral-return-routing: complete box marker missing");
  const addition='\n      {isGuidance&&r.target_role==="GUIDANCE_COUNSELOR"&&r.deducted_points===0&&<div className="referral-return-box"><div className="return-head"><b>إرجاع التحويل للمعلم</b><span>اكتب ردك للمعلم، ثم أعد التحويل له ليتمكن من تحويله مباشرة إلى وكيل المدرسة.</span></div><textarea value={returnDraft[r.id]??"ليست من اختصاصي، يرجى تحويلها لوكيل المدرسة."} onChange={e=>setReturnDraft((v:any)=>({...v,[r.id]:e.target.value}))}/><button className="btn ghost" disabled={actionBusy===r.id+"r"} onClick={()=>returnToTeacher(r)}>{actionBusy===r.id+"r"?"جارٍ الإرجاع...":"إرجاع للمعلم — ليست من اختصاصي"}</button></div>}';
  src=src.replace(marker,marker+addition);
}

writeFileSync(path,src);
