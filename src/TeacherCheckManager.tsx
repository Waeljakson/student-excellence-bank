import { useEffect, useState } from "react";
import { niceError, rpc } from "./client";
import "./engagement.css";

type CheckRow={id:string;serial_no:string;points:number;reason:string;status:string;issued_at:string;reversed_at?:string|null;reversal_reason?:string|null;student_name:string;student_no:string;grade_name:string;class_name:string;can_reverse:boolean};
const fmt=(v?:string|null)=>v?new Date(v).toLocaleString("ar-SA",{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"—";
const label=(s:string)=>s==="REVERSED"?"موقوف":s==="ISSUED"?"ساري":s==="PENDING"?"معلق":s==="CANCELLED"?"ملغي":s;

export default function TeacherCheckManager({onChanged}:{onChanged?:()=>Promise<void>|void}){
 const[rows,setRows]=useState<CheckRow[]>([]);const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");
 async function load(){try{setRows(await rpc<CheckRow[]>("api_teacher_issued_checks"))}catch(e){setMsg(niceError(e))}}
 useEffect(()=>{load()},[]);
 async function stop(c:CheckRow){const reason=window.prompt(`سبب إيقاف الشيك ${c.serial_no} للطالب ${c.student_name}:`,"تم إيقاف الشيك بواسطة المعلم المصدر");if(reason===null)return;if(!window.confirm(`تأكيد إيقاف الشيك؟ سيتم خصم ${c.points} نقطة من رصيد ${c.student_name}.`))return;setBusy(c.id);setMsg("");try{const r=await rpc<any>("api_teacher_reverse_check",{p_check_id:c.id,p_reason:reason||null});setMsg(`تم إيقاف الشيك وخصم ${r.points_removed} نقطة. الرصيد الجديد للطالب: ${r.new_balance} نقطة.`);await load();if(onChanged)await onChanged()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
 return <section className="panel teacher-check-manager"><div className="panel-title"><div><h3>شيكاتي الصادرة</h3><p>يمكنك إيقاف الشيك الذي أصدرته أنت فقط. عند الإيقاف تُعكس نقاطه من محفظة الطالب ويظهر الإيقاف في حسابه.</p></div><span className="counter">{rows.length}</span></div>{rows.length?<div className="teacher-issued-checks">{rows.map(c=><article key={c.id} className={c.status==="REVERSED"?"reversed":""}><div className="teacher-check-main"><span className={`check-state ${c.status.toLowerCase()}`}>{label(c.status)}</span><div><b>{c.student_name}</b><small>{c.grade_name} — فصل {c.class_name} · {c.student_no}</small><p>{c.reason}</p><em>{c.serial_no} · {fmt(c.issued_at)}</em></div></div><div className="teacher-check-points"><strong>{c.status==="REVERSED"?"−":"+"}{c.points}</strong><span>نقطة</span></div>{c.can_reverse?<button className="mini-btn danger" disabled={busy===c.id} onClick={()=>stop(c)}>{busy===c.id?"جارٍ الإيقاف...":"إيقاف الشيك"}</button>:c.status==="REVERSED"?<div className="teacher-check-reversal"><b>تم الإيقاف</b><span>{c.reversal_reason||"—"}</span><small>{fmt(c.reversed_at)}</small></div>:null}</article>)}</div>:<div className="empty">لم تصدر أي شيكات حتى الآن.</div>}{msg&&<div className="notice compact-notice">{msg}</div>}</section>;
}
