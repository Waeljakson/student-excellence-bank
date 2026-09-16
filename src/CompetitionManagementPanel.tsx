import { useEffect, useState } from "react";
import { niceError, rpc } from "./client";
import { printTableReport } from "./report-print";
import "./engagement.css";
import "./report-print.css";

type Comp={id:string;title_ar:string;body_ar:string;starts_at:string;ends_at?:string|null;is_published:boolean;announcement_type?:string;participant_count?:number;target_classes?:Array<{id:string;grade_name:string;class_name:string}>};
type Participant={student_id:string;student_no:string;student_name:string;grade_name:string;class_name:string;joined_at:string};
const fmt=(v?:string|null)=>v?new Date(v).toLocaleString("ar-SA",{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"—";

export default function CompetitionManagementPanel(){
  const[items,setItems]=useState<Comp[]>([]);const[open,setOpen]=useState("");const[people,setPeople]=useState<Record<string,Participant[]>>({});const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");
  async function load(){try{const rows=await rpc<Comp[]>("api_admin_announcements");setItems((rows||[]).filter(x=>x.announcement_type==="TARGETED_COMPETITION"))}catch(e){setMsg(niceError(e))}}
  useEffect(()=>{load()},[]);
  async function getPeople(id:string){if(people[id])return people[id];const list=await rpc<Participant[]>("api_admin_competition_participants",{p_competition_id:id});const ready=list||[];setPeople(v=>({...v,[id]:ready}));return ready}
  async function showPeople(id:string){if(open===id){setOpen("");return}setOpen(id);try{await getPeople(id)}catch(e){setMsg(niceError(e))}}
  async function printPeople(c:Comp){
    setBusy(c.id+"PRINT");setMsg("");
    try{
      const list=await getPeople(c.id);
      if(!list.length){setMsg("لا يوجد طلاب منضمون لهذه المسابقة حتى الآن.");return}
      const table=document.createElement("table");
      const thead=document.createElement("thead");
      const hr=document.createElement("tr");
      ["#","الطالب","الصف / الفصل","رقم الطالب","وقت الانضمام"].forEach(text=>{const th=document.createElement("th");th.textContent=text;hr.appendChild(th)});
      thead.appendChild(hr);table.appendChild(thead);
      const tbody=document.createElement("tbody");
      list.forEach((p,index)=>{const tr=document.createElement("tr");[String(index+1),p.student_name,`${p.grade_name} / ${p.class_name}`,p.student_no,fmt(p.joined_at)].forEach(text=>{const td=document.createElement("td");td.textContent=text;tr.appendChild(td)});tbody.appendChild(tr)});
      table.appendChild(tbody);
      const targets=c.target_classes?.map(x=>`${x.grade_name} / ${x.class_name}`).join("، ")||"جميع الفصول المستهدفة";
      printTableReport(table,{title:`قائمة المنضمين — ${c.title_ar}`,subtitle:`الفترة: ${fmt(c.starts_at)} — ${fmt(c.ends_at)} | الفصول المستهدفة: ${targets}`,orientation:"landscape"});
    }catch(e){setMsg(niceError(e))}finally{setBusy("")}
  }
  async function action(id:string,kind:"STOP"|"RESUME"|"DELETE"){if(kind==="DELETE"&&!window.confirm("حذف المسابقة من النظام؟ ستختفي من الطلاب ومن قائمة المسابقات، مع الاحتفاظ بسجل داخلي للتدقيق."))return;setBusy(id+kind);setMsg("");try{await rpc("api_admin_manage_competition",{p_competition_id:id,p_action:kind});setMsg(kind==="STOP"?"تم إيقاف المسابقة ولن تظهر للطلاب.":kind==="RESUME"?"تم إعادة تفعيل المسابقة.":"تم حذف المسابقة من القوائم.");setOpen("");await load()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  return <section className="panel competition-management"><div className="panel-title"><div><h3>إدارة المسابقات المنشورة</h3><p>إيقاف أو إعادة تشغيل أو حذف المسابقة، ومتابعة الطلاب الذين ضغطوا «انضمام».</p></div><span className="counter">{items.length}</span></div>{items.length?<div className="competition-admin-list">{items.map(c=><article key={c.id}><div className="competition-admin-head"><div><span className={c.is_published?"status-live":"status-stopped"}>{c.is_published?"منشورة":"موقوفة"}</span><h4>{c.title_ar}</h4><p>{c.body_ar}</p><small>{fmt(c.starts_at)} — {fmt(c.ends_at)} · {c.target_classes?.map(x=>`${x.grade_name} / ${x.class_name}`).join("، ")||"—"}</small></div><div className="competition-admin-actions"><button className="mini-btn" onClick={()=>showPeople(c.id)}>المنضمون ({c.participant_count||0})</button>{c.is_published?<button className="mini-btn warning" disabled={busy.startsWith(c.id)} onClick={()=>action(c.id,"STOP")}>إيقاف</button>:<button className="mini-btn" disabled={busy.startsWith(c.id)} onClick={()=>action(c.id,"RESUME")}>إعادة تشغيل</button>}<button className="mini-btn danger" disabled={busy.startsWith(c.id)} onClick={()=>action(c.id,"DELETE")}>حذف</button></div></div>{open===c.id&&<div className="competition-participants"><div className="participant-title"><div><b>الطلاب المنضمون</b><span>{people[c.id]?.length||0} طالب</span></div>{(people[c.id]?.length||0)>0&&<button className="report-print-btn no-print" disabled={busy===c.id+"PRINT"} onClick={()=>printPeople(c)}>{busy===c.id+"PRINT"?"جارٍ تجهيز التقرير...":"طباعة / حفظ PDF"}</button>}</div>{people[c.id]?.length?<div className="compact-table no-auto-report-print"><table><thead><tr><th>الطالب</th><th>الصف / الفصل</th><th>رقم الطالب</th><th>وقت الانضمام</th></tr></thead><tbody>{people[c.id].map(p=><tr key={p.student_id}><td>{p.student_name}</td><td>{p.grade_name} / {p.class_name}</td><td>{p.student_no}</td><td>{fmt(p.joined_at)}</td></tr>)}</tbody></table></div>:<div className="empty">لا يوجد طلاب منضمون حتى الآن.</div>}</div>}</article>)}</div>:<div className="empty">لا توجد مسابقات موجهة تم إطلاقها حتى الآن.</div>}{msg&&<div className="notice compact-notice">{msg}</div>}</section>;
}
