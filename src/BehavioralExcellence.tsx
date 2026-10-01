import { FormEvent, useEffect, useMemo, useState } from "react";
import { niceError, rpc } from "./client";
import * as XLSX from "xlsx";
import "./engagement.css";

type Student={id:string;student_no:string;name:string;grade_name:string;class_name:string;class_id?:string;points:number};
type Cycle={id:string;title_ar:string;description_ar:string;starts_at:string;ends_at:string;status:"SCHEDULED"|"ACTIVE"|"CLOSED";activated_at?:string|null;closed_at?:string|null;winners_published_at?:string|null;winners_count?:number};
type Nomination={class_id:string;student_ids:string[]};
type Leader={student_id:string;student_name:string;student_no:string;grade_name:string;class_name:string;nomination_count:number;rank:number};
type ParticipationClass={class_id:string;grade_name:string;class_name:string;nomination_count:number;complete:boolean};
type TeacherParticipation={staff_id:string;teacher_name:string;subject_name?:string|null;user_id?:string|null;account_ready:boolean;assigned_classes:number;started_classes:number;completed_classes:number;remaining_classes:number;nomination_count:number;classes:ParticipationClass[];status:"COMPLETE"|"PARTIAL"|"NOT_NOMINATED"|"NO_ACCOUNT"|"NO_CLASSES"};
type Data={is_teacher:boolean;can_activate:boolean;can_manage:boolean;visible_to_teacher:boolean;cycle:Cycle|null;cycles:Cycle[];assigned_class_ids:string[];my_nominations:Nomination[];leaderboard:Leader[];teacher_participation?:TeacherParticipation[]};
type Props={students:Student[];schoolName?:string};
const fmt=(v?:string|null)=>v?new Date(v).toLocaleString("ar-SA",{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"—";
const statusLabel=(s?:string)=>s==="ACTIVE"?"مفعلة":s==="SCHEDULED"?"بانتظار تفعيل الموجه":s==="CLOSED"?"منتهية":"غير مجدولة";
const participationLabel=(s:TeacherParticipation["status"])=>s==="COMPLETE"?"أكمل الترشيح":s==="PARTIAL"?"رشّح جزئيًا":s==="NOT_NOMINATED"?"لم يرشح":s==="NO_ACCOUNT"?"لا يوجد حساب مفعل":"لا توجد فصول مسندة";
function localDateTime(d:Date){const pad=(n:number)=>String(n).padStart(2,"0");return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
function cycleEndDefault(){const d=new Date();d.setDate(d.getDate()+7);return localDateTime(d)}

export default function BehavioralExcellence({students,schoolName="مدارس المشكاة الأهلية"}:Props){
  const[data,setData]=useState<Data|null>(null);const[selected,setSelected]=useState<Record<string,string[]>>({});const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");const[cycleStart,setCycleStart]=useState(()=>localDateTime(new Date()));const[cycleEnd,setCycleEnd]=useState(()=>cycleEndDefault());const[cycleDesc,setCycleDesc]=useState("كل معلم يرشح ثلاثة طلاب من كل فصل مسند له، والطلاب الأكثر ترشيحًا يتصدرون البرنامج.");const[reportFilter,setReportFilter]=useState<"ALL"|TeacherParticipation["status"]>("ALL");
  async function load(){try{const d=await rpc<Data>("api_behavioral_excellence");setData(d);const initial:Record<string,string[]>={};for(const n of d.my_nominations||[])initial[n.class_id]=(n.student_ids||[]).map(String);setSelected(initial)}catch(e){setMsg(niceError(e))}}
  useEffect(()=>{load()},[]);
  const classGroups=useMemo(()=>{if(!data)return[];const allowed=new Set((data.assigned_class_ids||[]).map(String));const map=new Map<string,{id:string;grade:string;name:string;students:Student[]}>();for(const s of students){if(!s.class_id||!allowed.has(String(s.class_id)))continue;const key=String(s.class_id);if(!map.has(key))map.set(key,{id:key,grade:s.grade_name,name:s.class_name,students:[]});map.get(key)!.students.push(s)}return [...map.values()].sort((a,b)=>`${a.grade}${a.name}`.localeCompare(`${b.grade}${b.name}`,"ar"))},[students,data]);
  const participation=data?.teacher_participation||[];
  const participationStats=useMemo(()=>({
    total:participation.length,
    complete:participation.filter(x=>x.status==="COMPLETE").length,
    partial:participation.filter(x=>x.status==="PARTIAL").length,
    missing:participation.filter(x=>x.status==="NOT_NOMINATED").length,
    noAccount:participation.filter(x=>x.status==="NO_ACCOUNT").length
  }),[participation]);
  const filteredParticipation=reportFilter==="ALL"?participation:participation.filter(x=>x.status===reportFilter);
  const gradeTopFive=useMemo(()=>{
    const gradeOrder=["الأول المتوسط","الثاني المتوسط","الثالث المتوسط","الأول الثانوي","الثاني الثانوي"];
    return gradeOrder.map(grade_name=>{
      const sorted=[...(data?.leaderboard||[])]
        .filter(x=>x.grade_name===grade_name)
        .sort((a,b)=>b.nomination_count-a.nomination_count||a.student_name.localeCompare(b.student_name,"ar"));
      let lastCount:number|null=null;
      let gradeRank=0;
      const top=sorted.slice(0,5).map((x,index)=>{
        if(lastCount===null||x.nomination_count!==lastCount){gradeRank=index+1;lastCount=x.nomination_count}
        return {...x,grade_rank:gradeRank};
      });
      return{grade_name,students:top};
    });
  },[data?.leaderboard]);
  function toggle(classId:string,studentId:string){setMsg("");setSelected(v=>{const current=v[classId]||[];if(current.includes(studentId))return{...v,[classId]:current.filter(x=>x!==studentId)};if(current.length>=3){setMsg("لكل فصل 3 ترشيحات فقط. ألغِ اختيار طالب أولًا لتختار غيره.");return v}return{...v,[classId]:[...current,studentId]}})}
  async function saveClass(classId:string){const ids=selected[classId]||[];if(ids.length!==3){setMsg("اختر 3 طلاب بالضبط من هذا الفصل قبل الحفظ.");return}if(!data?.cycle)return;setBusy(classId);setMsg("");try{await rpc("api_behavioral_nominate",{p_cycle_id:data.cycle.id,p_class_id:classId,p_student_ids:ids});setMsg("تم حفظ ترشيحات التميز السلوكي لهذا الفصل.");await load()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  async function createCycle(e:FormEvent){
    e.preventDefault();
    if(!data?.can_manage)return;
    if(new Date(cycleEnd)<=new Date(cycleStart)){setMsg("وقت نهاية الدورة يجب أن يكون بعد وقت البداية.");return}
    setBusy("CREATE");setMsg("");
    try{
      await rpc("api_behavioral_create_cycle",{p_starts_at:new Date(cycleStart).toISOString(),p_ends_at:new Date(cycleEnd).toISOString(),p_description_ar:cycleDesc});
      setMsg("تم تجهيز دورة التميز السلوكي لمدرستك. فعّلها من نفس الصفحة عندما تريد إظهارها للمعلمين.");
      setCycleStart(localDateTime(new Date()));setCycleEnd(cycleEndDefault());
      await load();window.dispatchEvent(new Event("behavioral-status-changed"));
    }catch(e){setMsg(niceError(e))}finally{setBusy("")}
  }
    async function cycleAction(action:"ACTIVATE"|"CLOSE"|"PUBLISH_WINNERS"){
    if(!data?.cycle)return;
    if(action==="PUBLISH_WINNERS"&&!window.confirm("سيتم اعتماد أفضل 5 طلاب على مستوى كل صف ونشر التهنئة لأولياء أمور الفائزين. لا يمكن إعادة احتساب المراكز بعد النشر. هل تريد المتابعة؟"))return;
    setBusy(action);setMsg("");
    try{
      const result=await rpc<any>("api_behavioral_set_cycle_state",{p_cycle_id:data.cycle.id,p_action:action});
      setMsg(action==="ACTIVATE"
        ?"تم تفعيل البرنامج. سيظهر للمعلمين داخل المدة المحددة، وأصبح تقرير متابعة الترشيحات متاحًا لك."
        :action==="CLOSE"
          ?"تم إغلاق الدورة وإيقاف الترشيحات. راجع النتائج ثم انشر الفائزين لأولياء الأمور."
          :`تم اعتماد ونشر الفائزين لأولياء الأمور (${Number(result?.published_winners||0).toLocaleString("ar-SA")} طالبًا).`);
      await load();
      window.dispatchEvent(new Event("behavioral-status-changed"));
    }catch(e){setMsg(niceError(e))}finally{setBusy("")}
  }
  
  async function extendCycle(hours:1|2){
    if(!data?.cycle)return;
    const label=hours===1?"ساعة واحدة":"ساعتين";
    if(!window.confirm(`سيتم تمديد فترة ترشيحات التميز السلوكي لمدة ${label}. هل تريد المتابعة؟`))return;
    const action=hours===1?"EXTEND_1H":"EXTEND_2H";
    setBusy(action);setMsg("");
    try{
      const result=await rpc<any>("api_behavioral_set_cycle_state",{p_cycle_id:data.cycle.id,p_action:action});
      setMsg(`تم تمديد التميز السلوكي لمدة ${label}. الموعد الجديد للإغلاق: ${fmt(result?.ends_at)}.`);
      await load();
      window.dispatchEvent(new Event("behavioral-status-changed"));
    }catch(e){setMsg(niceError(e))}finally{setBusy("")}
  }
function printParticipation(){
    if(!data?.cycle)return;
    const esc=(v:any)=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]||m));
    const list=filteredParticipation;
    const rows=list.map((t,i)=>{
      const classText=(t.classes||[]).map(x=>`${x.grade_name} / ${x.class_name}: ${x.nomination_count}/3`).join("، ");
      return `<tr><td class="num">${i+1}</td><td class="teacher"><b>${esc(t.teacher_name)}</b><small>${esc(t.subject_name||"—")}</small></td><td>${esc(participationLabel(t.status))}</td><td>${t.assigned_classes}</td><td>${t.completed_classes}</td><td>${t.remaining_classes}</td><td>${t.nomination_count}</td><td>${esc(classText||"—")}</td></tr>`;
    }).join("");
    const filterLabel=reportFilter==="ALL"?"الكل":participationLabel(reportFilter as TeacherParticipation["status"]);
    const base=new URL(import.meta.env.BASE_URL,window.location.origin).href;
    const schoolLogo=new URL("school-logo.png",base).href;
    const guidanceLogo=new URL("guidance-logo.png",base).href;
    const printedAt=new Date().toLocaleString("ar-SA",{year:"numeric",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"});
    const w=window.open("","_blank","width=1200,height=850");
    if(!w){window.alert("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.");return}
    w.document.open();
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير متابعة ترشيحات المعلمين — التميز السلوكي</title><style>
@page{size:A4 landscape;margin:9mm}
*{box-sizing:border-box}
html,body{background:#fff!important;color:#17242c!important}
body{margin:0;font-family:"Cairo",Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.report{width:100%}
.head{display:grid;grid-template-columns:90px 1fr 90px;align-items:center;gap:12px;border-bottom:3px solid #0b7562;padding-bottom:9px;margin-bottom:10px}
.head img{width:64px;height:64px;object-fit:contain;justify-self:center}
.head .center{text-align:center}
.head h1{margin:2px 0 3px;font-size:20px;color:#153f62}
.head h2{margin:0;font-size:10px;color:#0b7562}
.head p{margin:3px 0 0;font-size:8px;color:#667983}
.meta{display:flex;justify-content:space-between;gap:10px;padding:6px 9px;border:1px solid #dbe5e8;background:#f6f9fa;border-radius:8px;font-size:8px;margin-bottom:9px}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:9px}
.stats div{border:1px solid #d8e2e6;border-radius:8px;padding:7px;text-align:center;background:#fafcfc}
.stats small{display:block;color:#6b7d86;margin-bottom:2px}
.stats b{font-size:15px;color:#153f62}
table{display:table!important;width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;font-size:8px!important;background:#fff!important;visibility:visible!important;opacity:1!important}
thead{display:table-header-group!important}
tbody{display:table-row-group!important}
tr{display:table-row!important;break-inside:avoid;page-break-inside:avoid}
th,td{display:table-cell!important;border:1px solid #cfdadd!important;padding:5px 6px!important;text-align:right!important;vertical-align:middle!important;color:#17242c!important;visibility:visible!important;opacity:1!important;overflow-wrap:anywhere}
th{background:#eaf3f1!important;color:#124d45!important;font-weight:800!important}
tbody tr:nth-child(even) td{background:#f9fbfb!important}
td.num{text-align:center!important;width:4%}.teacher{width:18%}.teacher b,.teacher small{display:block}.teacher small{font-size:7px;color:#6d7d84;margin-top:2px}
th:nth-child(3),td:nth-child(3){width:11%}th:nth-child(4),td:nth-child(4),th:nth-child(5),td:nth-child(5),th:nth-child(6),td:nth-child(6),th:nth-child(7),td:nth-child(7){width:8%}
th:nth-child(8),td:nth-child(8){width:29%}
.empty{text-align:center!important;padding:18px!important;color:#6d7d84}
.footer{display:flex;justify-content:space-between;border-top:1px solid #d5e0e3;margin-top:9px;padding-top:6px;font-size:7px;color:#748690}
.tools{text-align:center;margin-top:10px}.tools button{border:0;border-radius:8px;background:#0b7562;color:#fff;padding:8px 15px;font-family:inherit;font-weight:800}
@media print{.tools{display:none!important}body{margin:0!important}.report{display:block!important;visibility:visible!important}table{display:table!important;visibility:visible!important}}
</style></head><body><main class="report">
<header class="head"><img src="${esc(schoolLogo)}" alt="شعار المدرسة"><div class="center"><h2>${esc(schoolName)} — بنك التميز الطلابي</h2><h1>تقرير متابعة ترشيحات المعلمين — التميز السلوكي</h1><p>${esc(data.cycle.title_ar)} · ${esc(fmt(data.cycle.starts_at))} — ${esc(fmt(data.cycle.ends_at))}</p></div><img src="${esc(guidanceLogo)}" alt="شعار التوجيه الطلابي"></header>
<div class="meta"><span>الفلتر الحالي: <b>${esc(filterLabel)}</b></span><span>عدد المعلمين المعروضين: <b>${list.length.toLocaleString("ar-SA")}</b></span><span>تاريخ الطباعة: <b>${esc(printedAt)}</b></span></div>
<div class="stats"><div><small>إجمالي المعلمين</small><b>${participationStats.total}</b></div><div><small>أكملوا الترشيح</small><b>${participationStats.complete}</b></div><div><small>ترشيح جزئي</small><b>${participationStats.partial}</b></div><div><small>لم يرشحوا</small><b>${participationStats.missing}</b></div><div><small>بدون حساب مفعل</small><b>${participationStats.noAccount}</b></div></div>
<table><thead><tr><th>#</th><th>المعلم</th><th>الحالة</th><th>الفصول المسندة</th><th>المكتمل</th><th>المتبقي</th><th>الترشيحات</th><th>تفاصيل الفصول</th></tr></thead><tbody>${rows||'<tr><td colspan="8" class="empty">لا توجد بيانات مطابقة للفلتر الحالي.</td></tr>'}</tbody></table>
<footer class="footer"><span>التوجيه الطلابي</span><span>تم إنشاء التقرير إلكترونيًا من نظام بنك التميز الطلابي</span></footer>
<div class="tools"><button type="button" onclick="window.print()">طباعة / حفظ PDF</button></div>
</main><script>const startPrint=()=>setTimeout(()=>{window.focus();window.print()},650);if(document.readyState==="complete"){startPrint()}else{window.addEventListener("load",startPrint,{once:true})}<\/script></body></html>`);
    w.document.close();
  }
  function printGradeTopFive(){
    if(!data?.cycle)return;
    const esc=(v:any)=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]||m));
    const base=new URL(import.meta.env.BASE_URL,window.location.origin).href;
    const schoolLogo=new URL("school-logo.png",base).href;
    const guidanceLogo=new URL("guidance-logo.png",base).href;
    const printedAt=new Date().toLocaleString("ar-SA",{year:"numeric",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"});
    const rows=gradeTopFive.map(group=>{
      if(!group.students.length){
        return `<tr class="grade-separator"><td colspan="6">الصف ${esc(group.grade_name)}</td></tr><tr><td colspan="6" class="empty">لا توجد ترشيحات في هذا الصف حتى الآن.</td></tr>`;
      }
      return `<tr class="grade-separator"><td colspan="6">الصف ${esc(group.grade_name)}</td></tr>`+
        group.students.map((x:any)=>`<tr><td class="rank">${x.grade_rank}</td><td class="student"><b>${esc(x.student_name)}</b></td><td>${esc(x.student_no)}</td><td>${esc(x.class_name)}</td><td class="count">${Number(x.nomination_count).toLocaleString("ar-SA")}</td><td>${esc(group.grade_name)}</td></tr>`).join("");
    }).join("");

    const w=window.open("","_blank","width=1200,height=850");
    if(!w){window.alert("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.");return}
    w.document.open();
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>أفضل 5 طلاب في كل صف — التميز السلوكي</title><style>
@page{size:A4 landscape;margin:9mm}
*{box-sizing:border-box}
html,body{background:#fff!important;color:#17242c!important}
body{margin:0;padding:0;font-family:"Cairo",Tahoma,Arial,sans-serif!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.report{display:block!important;width:100%!important;visibility:visible!important;opacity:1!important}
.head{display:grid!important;grid-template-columns:90px 1fr 90px;align-items:center;gap:12px;border-bottom:3px solid #0b7562;padding:0 0 9px;margin-bottom:9px}
.head img{width:64px;height:64px;object-fit:contain;justify-self:center}
.head .center{text-align:center}.head h1{margin:2px 0 3px;font-size:20px;color:#153f62}.head h3{margin:0;font-size:10px;color:#0b7562}.head p{margin:3px 0 0;font-size:8px;color:#6f808a}
.meta{display:flex!important;justify-content:space-between;gap:10px;padding:6px 9px;border:1px solid #dbe5e8;background:#f6f9fa!important;border-radius:8px;font-size:8px;margin-bottom:9px}
.table-shell{display:block!important;width:100%!important;overflow:visible!important;visibility:visible!important}
table{display:table!important;width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;background:#fff!important;font-size:8.5px!important;visibility:visible!important;opacity:1!important}
thead{display:table-header-group!important}tbody{display:table-row-group!important}tr{display:table-row!important;break-inside:avoid;page-break-inside:avoid}
th,td{display:table-cell!important;border:1px solid #d5e0e3!important;padding:5px 6px!important;text-align:right!important;vertical-align:middle!important;color:#17242c!important;background:#fff!important;visibility:visible!important;opacity:1!important}
th{background:#eaf3f1!important;color:#124d45!important;font-weight:800!important}
.grade-separator td{background:#dff0ec!important;color:#124d45!important;font-weight:900!important;font-size:10px!important;padding:6px 8px!important}
.rank,.count{text-align:center!important;font-weight:900!important}.rank{width:9%}.student{width:30%}
.empty{text-align:center!important;color:#7b8b94!important;padding:10px!important}
.footer{display:flex!important;justify-content:space-between;border-top:1px solid #d5e0e3;margin-top:9px;padding-top:6px;font-size:7px;color:#748690}
.tools{text-align:center;margin-top:10px}.tools button{border:0;border-radius:8px;background:#0b7562;color:#fff;padding:8px 15px;font-family:inherit;font-weight:800}
@media print{.tools{display:none!important}html,body,.report,.table-shell,table{display:block!important;visibility:visible!important;opacity:1!important}table{display:table!important}thead{display:table-header-group!important}tbody{display:table-row-group!important}tr{display:table-row!important}th,td{display:table-cell!important}}
</style></head><body><main class="report">
<header class="head"><img src="${esc(schoolLogo)}" alt="شعار المدرسة"><div class="center"><h3>${esc(schoolName)} — بنك التميز الطلابي</h3><h1>أفضل 5 طلاب في كل صف — التميز السلوكي</h1><p>${esc(data.cycle.title_ar)} · ${esc(fmt(data.cycle.starts_at))} — ${esc(fmt(data.cycle.ends_at))}</p></div><img src="${esc(guidanceLogo)}" alt="شعار التوجيه الطلابي"></header>
<div class="meta"><span>التجميع: <b>على مستوى الصف الدراسي بالكامل</b></span><span>تاريخ إعداد التقرير: <b>${esc(printedAt)}</b></span></div>
<div class="table-shell"><table><thead><tr><th>المركز</th><th>الطالب</th><th>رقم الطالب</th><th>الفصل</th><th>الترشيحات</th><th>الصف الدراسي</th></tr></thead><tbody>${rows}</tbody></table></div>
<footer class="footer"><span>التوجيه الطلابي</span><span>تم إنشاء التقرير إلكترونيًا من نظام بنك التميز الطلابي</span></footer>
<div class="tools"><button type="button" onclick="window.print()">طباعة / حفظ PDF</button></div>
</main><script>
const doPrint=()=>setTimeout(()=>{window.focus();window.print()},800);
const imgs=Array.from(document.images);
Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve}))).then(doPrint);
if(!imgs.length)doPrint();
<\/script></body></html>`);
    w.document.close();
  }

  function exportGradeTopFiveExcel(){
    if(!data?.cycle)return;
    const generatedAt=new Date().toLocaleString("ar-SA",{year:"numeric",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"});
    const allRows:any[][]=[
      ["تقرير أفضل 5 طلاب في كل صف — التميز السلوكي"],
      [data.cycle.title_ar],
      [`الفترة: ${fmt(data.cycle.starts_at)} — ${fmt(data.cycle.ends_at)}`],
      [`تاريخ التصدير: ${generatedAt}`],
      [],
      ["الصف الدراسي","المركز","اسم الطالب","رقم الطالب","الفصل","عدد الترشيحات"]
    ];
    for(const group of gradeTopFive){
      for(const x of group.students){
        allRows.push([group.grade_name,x.grade_rank,x.student_name,x.student_no,x.class_name,x.nomination_count]);
      }
    }

    const workbook=XLSX.utils.book_new();
    const allSheet=XLSX.utils.aoa_to_sheet(allRows);
    allSheet["!cols"]=[{wch:22},{wch:10},{wch:34},{wch:16},{wch:12},{wch:14}];
    (allSheet as any)["!rtl"]=true;
    XLSX.utils.book_append_sheet(workbook,allSheet,"جميع الصفوف");

    for(const group of gradeTopFive){
      const rows:any[][]=[
        [`أفضل 5 طلاب — ${group.grade_name}`],
        [data.cycle.title_ar],
        [],
        ["المركز","اسم الطالب","رقم الطالب","الفصل","عدد الترشيحات"]
      ];
      for(const x of group.students)rows.push([x.grade_rank,x.student_name,x.student_no,x.class_name,x.nomination_count]);
      const sheet=XLSX.utils.aoa_to_sheet(rows);
      sheet["!cols"]=[{wch:10},{wch:34},{wch:16},{wch:12},{wch:14}];
      (sheet as any)["!rtl"]=true;
      const safeName=group.grade_name.replace(/[\\/?*\[\]:]/g," ").slice(0,31)||"صف";
      XLSX.utils.book_append_sheet(workbook,sheet,safeName);
    }

    const fileDate=new Date().toISOString().slice(0,10);
    XLSX.writeFile(workbook,`فائزو-التميز-السلوكي-${fileDate}.xlsx`);
    setMsg("تم تجهيز ملف Excel للفائزين في جميع الصفوف.");
  }

  if(!data)return <><header className="topbar"><div><h1>التميز السلوكي</h1><p>جارٍ تحميل البرنامج...</p></div></header><main className="content"><div className="panel empty">جارٍ التحميل...</div></main></>;
  const c=data.cycle;
  return <><header className="topbar"><div><h1>التميز السلوكي</h1><p>برنامج دوري لترشيح الطلاب الأكثر تميزًا في السلوك</p></div>{c&&<span className={`behavioral-header-status ${c.status.toLowerCase()}`}>{statusLabel(c.status)}</span>}</header><main className="content behavioral-page">
    {c?<section className="panel behavioral-hero"><div><span className="eyebrow">برنامج دوري</span><h2>{c.title_ar}</h2><p>{c.description_ar}</p><div className="behavioral-dates"><span><small>البداية</small><b>{fmt(c.starts_at)}</b></span><span><small>النهاية</small><b>{fmt(c.ends_at)}</b></span></div></div><div className="behavioral-rule"><strong>3</strong><span>طلاب من كل فصل<br/>لكل معلم</span></div></section>:!data.can_manage?<section className="panel empty">لم يجهز مدير نظام المدرسة دورة للتميز السلوكي حتى الآن.</section>:null}

    {data.can_manage&&(!c||c.status==="CLOSED")&&<section className="panel behavioral-admin-panel"><div className="panel-title"><div><h3>تجهيز دورة التميز السلوكي</h3><p>بصفتك مدير نظام المدرسة يمكنك إنشاء دورة جديدة لمدرستك فقط، ثم تفعيلها للمعلمين من نفس الصفحة.</p></div><span className="counter">مدير المدرسة</span></div><form className="behavioral-cycle-form" onSubmit={createCycle}><div className="behavioral-cycle-head"><div><span>اسم البرنامج</span><strong>التميز السلوكي</strong></div><div className="behavioral-time-fields"><label>بداية الدورة<input type="datetime-local" required value={cycleStart} onChange={e=>setCycleStart(e.target.value)}/></label><label>نهاية الدورة<input type="datetime-local" required value={cycleEnd} onChange={e=>setCycleEnd(e.target.value)}/></label></div></div><label>وصف الدورة<textarea rows={3} required value={cycleDesc} onChange={e=>setCycleDesc(e.target.value)}/></label><div className="behavioral-admin-note"><b>آلية البرنامج:</b><span>3 طلاب من كل فصل لكل معلم · كل ترشيح = صوت واحد · الصدارة للأكثر ترشيحًا.</span></div><button className="btn primary" disabled={busy==="CREATE"}>{busy==="CREATE"?"جارٍ تجهيز الدورة...":"تجهيز دورة جديدة"}</button></form></section>}

    {c&&data.can_activate&&<section className="panel guidance-activation"><div><h3>تحكم الموجه الطلابي</h3><p>{c.status==="SCHEDULED"?"الدورة مجهزة ولكنها مخفية عن المعلمين. فعّلها عندما تريد بدء البرنامج.":c.status==="ACTIVE"?"الدورة مفعلة. يمكنك تمديد وقت الترشيح ساعة أو ساعتين، أو إغلاق الدورة عند الانتهاء.":"هذه الدورة منتهية."}</p></div>{c.status==="SCHEDULED"?<button className="btn primary" disabled={!!busy} onClick={()=>cycleAction("ACTIVATE")}>{busy==="ACTIVATE"?"جارٍ التفعيل...":"تفعيل البرنامج للمعلمين"}</button>:c.status==="ACTIVE"?<div className="behavioral-guidance-actions"><button className="btn secondary" disabled={!!busy} onClick={()=>extendCycle(1)}>{busy==="EXTEND_1H"?"جارٍ التمديد...":"تمديد ساعة"}</button><button className="btn secondary" disabled={!!busy} onClick={()=>extendCycle(2)}>{busy==="EXTEND_2H"?"جارٍ التمديد...":"تمديد ساعتين"}</button><button className="btn danger" disabled={!!busy} onClick={()=>cycleAction("CLOSE")}>{busy==="CLOSE"?"جارٍ الإغلاق...":"إغلاق الدورة"}</button></div>:null}</section>}

    {c&&c.status==="CLOSED"&&(data.can_activate||data.can_manage)&&<section className="panel behavioral-publish-winners"><div><span className="eyebrow">النتيجة النهائية</span><h3>{c.winners_published_at?"تم نشر الفائزين لأولياء الأمور":"نشر الفائزين لأولياء الأمور"}</h3><p>{c.winners_published_at?`تم اعتماد ${Number(c.winners_count||0).toLocaleString("ar-SA")} فائزًا، وستظهر التهنئة والمركز في بوابة ولي أمر كل طالب فائز.`:"بعد مراجعة أفضل 5 طلاب في كل صف، اضغط نشر لاعتماد المراكز وإظهار التهنئة لأولياء الأمور."}</p>{c.winners_published_at&&<small>تاريخ النشر: {fmt(c.winners_published_at)}</small>}</div>{!c.winners_published_at&&<button className="btn primary" disabled={busy==="PUBLISH_WINNERS"} onClick={()=>cycleAction("PUBLISH_WINNERS")}>{busy==="PUBLISH_WINNERS"?"جارٍ اعتماد الفائزين...":"نشر الفائزين لأولياء الأمور"}</button>}</section>}

    {c&&(data.can_activate||data.can_manage)&&c.status!=="SCHEDULED"&&<section className="panel behavioral-participation-report"><div className="panel-title"><div><h3>تقرير متابعة ترشيحات المعلمين</h3><p>يعرض من أكمل ترشيح 3 طلاب في كل فصل مسند له، ومن لم يبدأ أو لم يكمل بعد.</p></div><div className="behavioral-report-actions no-print"><button className="mini-btn" onClick={()=>load()}>تحديث التقرير</button><button className="mini-btn" onClick={printParticipation}>طباعة التقرير</button></div></div><div className="behavioral-report-stats"><article><span>إجمالي المعلمين</span><strong>{participationStats.total}</strong></article><article className="complete"><span>أكملوا الترشيح</span><strong>{participationStats.complete}</strong></article><article className="partial"><span>ترشيح جزئي</span><strong>{participationStats.partial}</strong></article><article className="missing"><span>لم يرشحوا</span><strong>{participationStats.missing}</strong></article><article className="account"><span>بدون حساب مفعل</span><strong>{participationStats.noAccount}</strong></article></div><div className="behavioral-report-filters no-print"><button className={reportFilter==="ALL"?"active":""} onClick={()=>setReportFilter("ALL")}>الكل</button><button className={reportFilter==="NOT_NOMINATED"?"active":""} onClick={()=>setReportFilter("NOT_NOMINATED")}>لم يرشح</button><button className={reportFilter==="PARTIAL"?"active":""} onClick={()=>setReportFilter("PARTIAL")}>جزئي</button><button className={reportFilter==="COMPLETE"?"active":""} onClick={()=>setReportFilter("COMPLETE")}>مكتمل</button><button className={reportFilter==="NO_ACCOUNT"?"active":""} onClick={()=>setReportFilter("NO_ACCOUNT")}>بدون حساب</button></div>{filteredParticipation.length?<div className="table-wrap behavioral-report-table"><table className="behavioral-participation-table"><colgroup><col className="col-teacher"/><col className="col-status"/><col className="col-classes"/><col className="col-number"/><col className="col-number"/><col className="col-nominations"/></colgroup><thead><tr><th className="teacher-col">المعلم</th><th className="status-col">الحالة</th><th className="classes-col">الفصول</th><th className="number-col">المكتمل</th><th className="number-col">المتبقي</th><th className="nominations-col">المرشحون</th></tr></thead><tbody>{filteredParticipation.map(t=><tr key={t.staff_id} className={`participation-${t.status.toLowerCase()}`}><td className="teacher-col"><div className="behavioral-teacher-cell"><b title={t.teacher_name}>{t.teacher_name}</b><small title={t.subject_name||"—"}>{t.subject_name||"—"}</small></div></td><td className="status-col"><span className={`participation-status ${t.status.toLowerCase()}`}>{participationLabel(t.status)}</span></td><td className="classes-col"><div className="behavioral-classes-cell"><b>{t.assigned_classes} فصل</b>{t.classes?.length>0&&<div className="participation-classes">{t.classes.map(x=><span key={x.class_id} title={`${x.grade_name} / ${x.class_name}: ${x.nomination_count}/3`} className={x.complete?"done":"pending"}>{x.grade_name} / {x.class_name}: {x.nomination_count}/3</span>)}</div>}</div></td><td className="number-col"><strong>{t.completed_classes}</strong></td><td className="number-col"><strong>{t.remaining_classes}</strong></td><td className="nominations-col"><strong>{t.nomination_count}</strong></td></tr>)}</tbody></table></div>:<div className="empty">لا توجد نتائج مطابقة لهذا الفلتر.</div>}</section>}

    {c&&(data.can_activate||data.can_manage)&&c.status!=="SCHEDULED"&&<section className="panel behavioral-grade-top5-report"><div className="panel-title"><div><h3>أفضل 5 طلاب في كل صف</h3><p>الترتيب محسوب على مستوى الصف الدراسي بالكامل، وليس على مستوى الفصل، حسب إجمالي ترشيحات المعلمين.</p></div><div className="behavioral-top5-actions no-print"><button className="mini-btn" onClick={printGradeTopFive}>طباعة / حفظ PDF</button><button className="mini-btn" onClick={exportGradeTopFiveExcel}>تصدير Excel لكل الصفوف</button></div></div><div className="behavioral-grade-top5-grid">{gradeTopFive.map(group=><article className="behavioral-grade-card" key={group.grade_name}><div className="behavioral-grade-card-head"><div><small>الصف الدراسي</small><h4>{group.grade_name}</h4></div><span>{group.students.length}/5</span></div>{group.students.length?<table><thead><tr><th>المركز</th><th>الطالب</th><th>الفصل</th><th>الترشيحات</th></tr></thead><tbody>{group.students.map((x:any)=><tr key={x.student_id}><td><span className={"grade-top-rank rank-"+Math.min(x.grade_rank,4)}>{x.grade_rank}</span></td><td><div className="grade-top-student"><b>{x.student_name}</b><small>{x.student_no}</small></div></td><td><span className="grade-top-class">{x.class_name}</span></td><td><strong className="grade-top-count">{x.nomination_count}</strong></td></tr>)}</tbody></table>:<div className="behavioral-grade-empty">لا توجد ترشيحات في هذا الصف حتى الآن.</div>}</article>)}</div></section>}

    {c&&data.is_teacher&&data.visible_to_teacher&&<section className="behavioral-nomination-area"><div className="section-intro"><div><h3>ترشيحاتك</h3><p>اختر 3 طلاب من كل فصل مسند لك. يمكنك تعديل الاختيارات وإعادة حفظها ما دامت الدورة مفتوحة.</p></div></div>{classGroups.length?<div className="behavioral-class-grid">{classGroups.map(group=>{const choices=selected[group.id]||[];return <article className="panel behavioral-class-card" key={group.id}><div className="behavioral-class-head"><div><span>{group.grade}</span><h4>فصل {group.name}</h4></div><b className={choices.length===3?"complete":""}>{choices.length}/3</b></div><div className="behavioral-student-picker">{group.students.map(s=><button type="button" key={s.id} className={choices.includes(s.id)?"selected":""} onClick={()=>toggle(group.id,s.id)}><span className="student-choice-mark">{choices.includes(s.id)?"✓":""}</span><div><b>{s.name}</b><small>{s.student_no}</small></div></button>)}</div><button className="btn primary full" disabled={busy===group.id||choices.length!==3} onClick={()=>saveClass(group.id)}>{busy===group.id?"جارٍ الحفظ...":"حفظ 3 ترشيحات"}</button></article>})}</div>:<div className="panel empty">لا توجد فصول مسندة لحسابك.</div>}</section>}

    {c&&data.is_teacher&&!data.visible_to_teacher&&c.status!=="CLOSED"&&!data.can_activate&&<section className="panel empty">البرنامج غير متاح للترشيح الآن. لن يظهر للمعلمين إلا بعد تفعيل الموجه وبدء المدة المحددة.</section>}

    {c&&<section className="panel behavioral-leaderboard"><div className="panel-title"><div><h3>{c.status==="CLOSED"?"النتيجة النهائية":"صدارة التميز السلوكي"}</h3><p>الترتيب حسب إجمالي عدد ترشيحات المعلمين. عند التعادل يشترك الطلاب في نفس المركز، وبعد الإغلاق يفوز صاحب/أصحاب المركز الأول.</p></div><span className="counter">{data.leaderboard?.length||0}</span></div>{data.leaderboard?.length?<div className="behavioral-ranking-list">{data.leaderboard.map(x=><article key={x.student_id} className={x.rank<=3?`top rank-${x.rank}`:""}><span className="behavioral-rank">{x.rank}</span><div><b>{x.student_name}</b><small>{x.grade_name} — فصل {x.class_name} · {x.student_no}</small></div><strong>{x.nomination_count}<small> ترشيح</small></strong>{c.status==="CLOSED"&&x.rank===1&&<em>فائز</em>}</article>)}</div>:<div className="empty">لم تسجل ترشيحات في هذه الدورة حتى الآن.</div>}</section>}
    {msg&&<div className="notice sticky-note">{msg}</div>}
  </main></>;
}
