import {useEffect,useMemo,useRef,useState} from "react";
import {niceError,rpc} from "./client";
import "./teacher-student-report.css";

type Teacher={id:string;name:string;subject?:string};
type ReportClass={id:string;label:string};
type Student={id:string;name:string;student_no:string;class_id:string;class_name:string;grade_name:string};
type Activity={
  source_id:string;student_id:string;student_no:string;student_name:string;
  class_id:string;class_name:string;grade_name:string;event_at:string;
  category:string;title:string;detail?:string|null;subject?:string|null;
  status?:string|null;points?:number|null;effective_points?:number|null;
};
type StudentStats={student_id:string;student_name:string;student_no:string;class_id:string;class_name:string;
  grade_name:string;events:number;referrals:number;followup:number;checks:number;evaluations:number;valid_points:number};
type Summary={events:number;students:number;valid_points:number;referrals:number;followup:number;checks:number;evaluations:number;other:number};
type ReportData={can_select_teacher:boolean;teacher:Teacher|null;teachers:Teacher[];
  classes:ReportClass[];students:Student[];activities:Activity[];summary:Summary;student_stats:StudentStats[]};

const categories:[string,string][]=[
  ["ALL","جميع التعاملات"],["REFERRAL","التحويلات"],["FOLLOWUP","دفتر المتابعة"],
  ["CHECK","شيكات التميز"],["EVALUATION_REPORT","تقارير التقييم"],
  ["PERIODIC_EVALUATION","التقييم الدوري"],["BEHAVIORAL","التميز السلوكي"],
  ["ABSENCE","غياب الحصص"],["CLASS_EXIT","الاستئذان"]
];
const stateNames:Record<string,string>={
  OPEN:"مفتوح",COMPLETED:"مكتمل",PENDING:"بانتظار الاستكمال",
  APPROVED:"معتمد",REJECTED:"مرفوض",ISSUED:"صادر",REDEEMED:"مصروف",
  CANCELLED:"ملغي",REVERSED:"مسترجع",EXPIRED:"منتهي",
  POSITIVE:"إيجابي",NEGATIVE:"سلبي",HOMEWORK:"واجبات",GENERAL:"عام",
  NOMINATED:"مرشح",ABSENT:"غائب",RETURNED:"عاد",OUT:"خرج",
  NOT_EXITED:"لم يخرج"
};
const stamp=(raw:string)=>raw?new Date(raw).toLocaleString("ar-SA",{timeZone:"Asia/Riyadh",dateStyle:"medium",timeStyle:"short"}):"—";
const statusText=(s?:string|null)=>s?s.split(" / ").map(x=>stateNames[x]||x).join(" / "):"—";
const formatNumber=(n:number|undefined)=>Number(n||0).toLocaleString("ar-SA");
const blank:Summary={events:0,students:0,valid_points:0,referrals:0,followup:0,checks:0,evaluations:0,other:0};
const errorText=(e:unknown)=>{
  const s=String((e as Error)?.message||e||"");
  if(s.includes("TEACHER_REPORT_ACCESS_DENIED"))return "ليس لديك صلاحية الاطلاع على تقرير هذا المعلم.";
  if(s.includes("TEACHER_REPORT_CLASS_FORBIDDEN"))return "الفصل خارج نطاق المعلم المحدد.";
  if(s.includes("TEACHER_REPORT_STUDENT_FORBIDDEN"))return "الطالب خارج الفصول المسندة لهذا المعلم.";
  if(s.includes("TEACHER_REPORT_TEACHER_NOT_FOUND"))return "المعلم غير متاح أو غير مرتبط بهذه المدرسة.";
  if(s.includes("REPORT_DATE_RANGE_INVALID"))return "تاريخ البداية يجب أن يسبق تاريخ النهاية.";
  return niceError(e);
};
const quoteCsv=(v:unknown)=>'"'+String(v??"").replace(/"/g,'""')+'"';

export default function TeacherStudentReport({schoolName,initialTeacherId=""}:{schoolName:string;initialTeacherId?:string}){
  const[data,setData]=useState<ReportData|null>(null);
  const[teacherId,setTeacherId]=useState(initialTeacherId);
  const[classId,setClassId]=useState("");
  const[studentId,setStudentId]=useState("");
  const[from,setFrom]=useState("");
  const[to,setTo]=useState("");
  const[category,setCategory]=useState("ALL");
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  const[refresh,setRefresh]=useState(0);
  const[query,setQuery]=useState("");
  const requestRef=useRef(0);

  useEffect(()=>{
    let active=true;
    const request=++requestRef.current;
    async function load(){
      if(from&&to&&from>to){setError("تاريخ البداية يجب أن يسبق تاريخ النهاية.");return;}
      setBusy(true);setError("");
      try{
        // Send the complete RPC signature, including explicit nulls. This avoids
        // PostgREST treating an empty filter object as a no-argument RPC.
        const args:Record<string,string|null>={
          p_teacher_user_id:teacherId||null,
          p_class_id:classId||null,
          p_student_id:studentId||null,
          p_from_date:from||null,
          p_to_date:to||null
        };
        const result=await rpc<ReportData>("api_teacher_student_report",args);
        if(!active||request!==requestRef.current)return;
        setData(result);
        // Administrators deliberately choose the teacher; never export the first teacher by default.
      }catch(e){if(active&&request===requestRef.current){setData(null);setError(errorText(e));}}
      finally{if(active&&request===requestRef.current)setBusy(false);}
    }
    void load();
    return()=>{active=false};
  },[teacherId,classId,studentId,from,to,refresh]);

  const activities=useMemo(()=>{
    const all=data?.activities||[];
    const text=query.trim().toLocaleLowerCase("ar");
    return all.filter(a=>(category==="ALL"||a.category===category) &&
      (!text||[a.student_name,a.student_no,a.title,a.detail,a.subject,a.grade_name,a.class_name]
        .some(v=>String(v||"").toLocaleLowerCase("ar").includes(text))));
  },[data?.activities,category,query]);
  const students=useMemo(()=>data?.students||[],[data?.students]);
  const selectedStudent=students.find(s=>s.id===studentId);
  const selectedClass=data?.classes?.find(c=>c.id===classId);
  const total=data?.summary||blank;
  const reportReady=Boolean(data?.teacher)&&!busy&&(!data?.can_select_teacher||data.teacher?.id===teacherId);
  const countByCategory=(key:string)=>data?.activities?.filter(a=>a.category===key).length||0;
  const stats=useMemo(()=>{
    const counts=new Map((data?.student_stats||[]).map(s=>[s.student_id,s]));
    return students.map(s=>counts.get(s.id)||{
      student_id:s.id,student_name:s.name,student_no:s.student_no,class_id:s.class_id,
      class_name:s.class_name,grade_name:s.grade_name,events:0,referrals:0,
      followup:0,checks:0,evaluations:0,valid_points:0
    });
  },[data?.student_stats,students]);
  const exportExcel=async()=>{
    if(!data?.teacher)return;
    const XLSX=await import("xlsx");
    const wb=XLSX.utils.book_new();
    const summaryRows=stats.filter(s=>!studentId||s.student_id===studentId).map(s=>({
      "اسم الطالب":s.student_name,"رقم الطالب":s.student_no,
      "الصف":s.grade_name,"الفصل":s.class_name,"التحويلات":s.referrals,
      "ملاحظات المتابعة":s.followup,"الشيكات":s.checks,"التقييمات":s.evaluations,
      "إجمالي التعاملات":s.events,"النقاط السارية التي منحها المعلم":s.valid_points
    }));
    // Force data strings beginning with spreadsheet control symbols to be treated as text.
    const excelSafe=(v:unknown)=>typeof v==="string"&&/^[=+@-]/.test(v)?"'"+v:v;
    const detailRows=activities.map(a=>({
      "التاريخ":stamp(a.event_at),"المعلم":data.teacher!.name,"الطالب":a.student_name,
      "رقم الطالب":a.student_no,"الصف":a.grade_name,"الفصل":a.class_name,
      "نوع التعامل":categories.find(c=>c[0]===a.category)?.[1]||a.category,
      "الإجراء":a.title,"التفاصيل":a.detail||"","المادة":a.subject||"",
      "الحالة":statusText(a.status),"النقاط الصادرة":a.points??"",
      "النقاط السارية":a.effective_points??""
    }));
    const meta=[
      ["المدرسة",schoolName],["المعلم",data.teacher.name],
      ["المادة",data.teacher.subject||"—"],["الفصل",selectedClass?.label||"جميع الفصول المسندة"],
      ["الطالب",selectedStudent?.name||"جميع الطلاب"],
      ["الفترة",from||"من البداية",to||"حتى اليوم"],
      ["تاريخ الإصدار",new Date().toLocaleDateString("ar-SA",{timeZone:"Asia/Riyadh"})]
    ];
    const cover=XLSX.utils.aoa_to_sheet(meta);
    const summary=XLSX.utils.json_to_sheet(summaryRows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,excelSafe(v)]))));
    const detail=XLSX.utils.json_to_sheet(detailRows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,excelSafe(v)]))));
    XLSX.utils.book_append_sheet(wb,cover,"بيانات التقرير");
    XLSX.utils.book_append_sheet(wb,summary,"ملخص الطلاب");
    XLSX.utils.book_append_sheet(wb,detail,"سجل التعاملات");
    const fileName=["تقارير المعلم",data.teacher.name,selectedStudent?.name||selectedClass?.label||"كل الفصول"]
      .join("-").replace(/[^\p{L}\p{N}_. -]/gu,"_")+".xlsx";
    XLSX.writeFile(wb,fileName);
  };

  const safeExportName=(type:string)=>[
    type,data?.teacher?.name||"المعلم",selectedStudent?.name||selectedClass?.label||"كل الفصول"
  ].join("-").replace(/[^\p{L}\p{N}_. -]/gu,"_");

  const exportDetailsExcel=async()=>{
    if(!reportReady||!data?.teacher)return;
    try{
      const XLSX=await import("xlsx");
      const headers=["التاريخ","المعلم","اسم الطالب","رقم الطالب","الصف","الفصل",
        "نوع التعامل","الإجراء المسجل","التفاصيل","المادة","الحالة","النقاط الصادرة","النقاط السارية"];
      const excelSafe=(v:unknown)=>typeof v==="string"&&/^[=+@-]/.test(v)?"'"+v:v;
      const rows=activities.map(a=>[
        stamp(a.event_at),data.teacher!.name,a.student_name,a.student_no,
        a.grade_name,a.class_name,categories.find(c=>c[0]===a.category)?.[1]||a.category,
        a.title,a.detail||"",a.subject||"",statusText(a.status),
        a.points??"",a.effective_points??""
      ].map(excelSafe));
      const wb=XLSX.utils.book_new();
      const info=XLSX.utils.aoa_to_sheet([
        ["سجل التعاملات التفصيلي — بنك التميز"],["المدرسة",schoolName],
        ["المعلم",data.teacher.name],["المادة",data.teacher.subject||"—"],
        ["الفصل",selectedClass?.label||"جميع الفصول"],
        ["الطالب",selectedStudent?.name||"جميع الطلاب"],
        ["الفترة",from||"من البداية",to||"حتى اليوم"],
        ["نوع التعامل",categories.find(c=>c[0]===category)?.[1]||"جميع التعاملات"],
        ["البحث",query||"بدون تصفية"],
        ["السجلات المصدرة",rows.length]
      ]);
      const sheet=XLSX.utils.aoa_to_sheet([headers,...rows]);
      sheet["!cols"]=[{wch:23},{wch:27},{wch:30},{wch:17},{wch:20},{wch:18},
        {wch:19},{wch:30},{wch:60},{wch:18},{wch:20},{wch:16},{wch:16}];
      sheet["!autofilter"]={ref:"A1:M"+Math.max(1,rows.length+1)};
      XLSX.utils.book_append_sheet(wb,info,"بيانات الاستخراج");
      XLSX.utils.book_append_sheet(wb,sheet,"السجل التفصيلي");
      XLSX.writeFile(wb,safeExportName("السجل التفصيلي للتعاملات")+".xlsx");
    }catch(e){setError("تعذر تصدير السجل التفصيلي: "+niceError(e))}
  };

  // Open a separate document for print preview. App-wide print rules previously
  // hide .content > section, causing an apparently successful blank PDF.
  const openPrintPreview=(detailsOnly=false)=>{
    if(!reportReady||!data?.teacher)return;
    const preview=window.open("","_blank");
    if(!preview){setError("المتصفح منع فتح معاينة الطباعة. اسمح بالنوافذ المنبثقة لموقع بنك التميز وأعد المحاولة.");return;}
    const esc=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]||c));
    const td=(value:unknown)=>"<td>"+esc(value)+"</td>";
    const th=(value:unknown)=>"<th>"+esc(value)+"</th>";
    const line=(label:string,value:unknown)=>"<div class='metadata'><small>"+esc(label)+"</small><strong>"+esc(value)+"</strong></div>";
    const schoolLogo=new URL(import.meta.env.BASE_URL+"school-logo.png",window.location.origin).href;
    const guidanceLogo=new URL(import.meta.env.BASE_URL+"guidance-logo.png",window.location.origin).href;
    const rows=activities.map(a=>"<tr>"+[
      stamp(a.event_at),a.student_name,a.student_no,a.grade_name+" / "+a.class_name,
      categories.find(c=>c[0]===a.category)?.[1]||a.category,
      a.title,a.detail||"—",a.subject||"—",statusText(a.status),
      a.points==null?"—":formatNumber(a.points),
      a.effective_points==null?"—":formatNumber(a.effective_points)
    ].map(td).join("")+"</tr>").join("");
    const detailHead=["التاريخ","الطالب","رقم الطالب","الصف / الفصل","التصنيف",
      "الإجراء","التفاصيل","المادة","الحالة","النقاط","النقاط السارية"].map(th).join("");
    const statsHead=["الطالب","رقم الطالب","الصف / الفصل","التحويلات","المتابعة",
      "الشيكات","التقييمات","النقاط السارية","الإجمالي"].map(th).join("");
    const statsRows=stats.map(a=>"<tr>"+[
      a.student_name,a.student_no,a.grade_name+" / "+a.class_name,a.referrals,
      a.followup,a.checks,a.evaluations,a.valid_points,a.events
    ].map(td).join("")+"</tr>").join("");
    const statsHtml=!detailsOnly&&!studentId
      ?"<section><h3>ملخص الطلاب ("+esc(stats.length)+")</h3><table><thead><tr>"+statsHead+
        "</tr></thead><tbody>"+(statsRows||"<tr><td colspan='9'>لا يوجد طلاب</td></tr>")+"</tbody></table></section>":"";
    const kpis=!detailsOnly
      ?"<div class='kpis'>"+
        [["إجمالي التعاملات",total.events],["التحويلات",total.referrals],
          ["ملاحظات المتابعة",total.followup],["الشيكات",total.checks],
          ["التقييمات",total.evaluations],["النقاط السارية",total.valid_points]]
          .map(p=>"<div><small>"+esc(p[0])+"</small><b>"+esc(p[1])+"</b></div>").join("")+"</div>":"";
    const css=[
      "@page{size:A4 landscape;margin:12mm}",
      "*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#193047;direction:rtl}",
      "body{font-family:Cairo,Tahoma,Arial,sans-serif;font-size:11px;line-height:1.6}",
      ".toolbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:12px;",
      "padding:12px 20px;background:#e9f0f8;border-bottom:1px solid #cedae6}",
      ".toolbar button{border:0;border-radius:8px;padding:10px 20px;background:#185787;",
      "color:white;font:inherit;font-weight:bold;cursor:pointer}",
      ".toolbar button.secondary{background:#596b7a}.toolbar span{flex:1;color:#456}",
      ".document{padding:22px;max-width:1450px;margin:auto;min-height:100px}",
      ".header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #174b79;padding-bottom:14px}",
      ".header img{width:60px;height:60px;object-fit:contain}",
      ".header .title{flex:1;text-align:center}.header h1{font-size:20px;color:#153c64;margin:4px 0}",
      ".header h2{font-size:13px;margin:0}.header small{font-size:11px;color:#677f91}",
      ".grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;",
      "border:1px solid #e2e8ef;background:#f5f8fc;padding:10px;margin:12px 0}",
      ".metadata{min-width:0}.metadata small{display:block;color:#61768a}",
      ".metadata strong{display:block;overflow-wrap:anywhere}",
      ".kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin:12px 0}",
      ".kpis>div{background:#eff5fb;padding:9px;border:1px solid #dce6f0}",
      ".kpis small{display:block}.kpis b{font-size:18px;color:#164b78}",
      "h3{font-size:15px;margin:18px 0 8px;color:#163d63}",
      "table{width:100%;border-collapse:collapse;table-layout:auto;font-size:10px}",
      "th,td{border:1px solid #cfdce8;padding:6px;text-align:right;vertical-align:top;",
      "overflow-wrap:anywhere;white-space:pre-wrap}",
      "th{background:#e9f1f9;color:#173c60;font-weight:700}",
      "tbody tr:nth-child(even){background:#fafcff}",
      "p.note{font-size:10px;margin:16px 0 0;color:#596c7e}",
      "thead{display:table-header-group}tfoot{display:table-footer-group}",
      "tr{break-inside:avoid;page-break-inside:avoid}",
      "@media print{html,body{background:white!important}body{print-color-adjust:exact;",
      "-webkit-print-color-adjust:exact}.toolbar{display:none!important}",
      ".document{padding:0;margin:0;max-width:none}.header img{width:47px;height:47px}",
      "th,td{padding:4px;font-size:9px}section{break-inside:auto}",
      "h3{break-after:avoid}.kpis{grid-template-columns:repeat(6,1fr)}}"
    ].join("");
    const html="<!doctype html><html lang='ar' dir='rtl'><head><meta charset='utf-8'>"+
      "<meta name='viewport' content='width=device-width,initial-scale=1'>"+
      "<title>"+esc(detailsOnly?"السجل التفصيلي للتعاملات":"تقرير المعلم")+" — "+esc(data.teacher.name)+"</title>"+
      "<style>"+css+"</style></head><body>"+
      "<nav class='toolbar'><button type='button' onclick='window.print()'>طباعة / حفظ PDF</button>"+
      "<button type='button' class='secondary' onclick='window.close()'>إغلاق المعاينة</button>"+
      "<span>راجع البيانات أدناه ثم اختر حفظ PDF من إعدادات الطباعة.</span></nav>"+
      "<main class='document'><header class='header'>"+
      "<img alt='شعار المدرسة' src='"+esc(schoolLogo)+"'>"+
      "<div class='title'><h2>"+esc(schoolName)+"</h2><h1>"+
      (detailsOnly?"السجل التفصيلي لتعاملات المعلم":"تقرير المعلم عن الطلاب")+
      "</h1><small>بنك التميز — تاريخ الإصدار: "+
      esc(new Date().toLocaleString("ar-SA",{timeZone:"Asia/Riyadh"}))+
      "</small></div><img alt='شعار التوجيه' src='"+esc(guidanceLogo)+"'></header>"+
      "<div class='grid'>"+line("المعلم",data.teacher.name)+
      line("المادة",data.teacher.subject||"—")+
      line("الفصل",selectedClass?.label||"كل الفصول المسندة")+
      line("الطالب",selectedStudent?.name||"جميع الطلاب")+
      line("الفترة",(from||"من البداية")+" — "+(to||"حتى اليوم"))+
      line("نوع السجل",categories.find(c=>c[0]===category)?.[1]||"جميع التعاملات")+
      line("بحث السجل",query.trim()||"بدون تصفية")+
      line("عدد السجلات المعروضة",activities.length)+
      "</div>"+kpis+statsHtml+
      "<section><h3>السجل التفصيلي للتعاملات ("+esc(activities.length)+" سجل)</h3>"+
      "<table><thead><tr>"+detailHead+"</tr></thead><tbody>"+
      (rows||"<tr><td colspan='11'>لا توجد تعاملات مطابقة للنطاق المختار.</td></tr>")+
      "</tbody></table></section>"+
      "<p class='note'>يحتوي هذا المستند على تعاملات المعلم المحدد وفق النطاق والفلاتر المبينة أعلاه. "+
      "النقاط السارية لا تمثل الرصيد الإجمالي لمحفظة الطالب.</p></main></body></html>";
    try{
      preview.document.open();
      preview.document.write(html);
      preview.document.close();
      preview.opener=null;
      preview.focus();
    }catch(e){
      preview.close();
      setError("تعذر فتح معاينة التقرير: "+niceError(e));
    }
  };

  const changeClass=(id:string)=>{setClassId(id);setStudentId("");};
  const changeTeacher=(id:string)=>{setTeacherId(id);setClassId("");setStudentId("");};
  return <div className="tsr-root">
    <header className="topbar tsr-no-print"><div><h1>تقرير المعلم عن الطلاب</h1>
      <p>سجل موحد لكل ما سجله المعلم على الطالب أو طلاب الفصل في بنك التميز.</p></div></header>
    <main className="content tsr-content">
      <section className="panel tsr-filter tsr-no-print">
        <div className="panel-title"><div><h3>اختيار المعلم وإصدار التقرير</h3>
          <p>مدير النظام يحدد المعلم والفصل أو الطالب، ثم يصدر السجل الكامل PDF أو Excel. ويمكن اختيار كل الفصول للحصول على تقرير شامل.</p></div>
          <button className="mini-btn" type="button" onClick={()=>setRefresh(v=>v+1)} disabled={busy}>تحديث البيانات</button></div>
        <div className="tsr-fields">
          {data?.can_select_teacher&&<label>المعلم
            <select value={teacherId} onChange={e=>changeTeacher(e.target.value)}>
              <option value="">— اختر المعلم لإصدار التقرير —</option>
              {(data.teachers||[]).map(t=><option key={t.id} value={t.id}>{t.name} — {t.subject||"—"}</option>)}
            </select>
          </label>}
          <label>الفصل
            <select value={classId} onChange={e=>changeClass(e.target.value)} disabled={!data?.teacher}>
              <option value="">كل الفصول المسندة</option>
              {(data?.classes||[]).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label>الطالب
            <select value={studentId} onChange={e=>setStudentId(e.target.value)} disabled={!data?.teacher}>
              <option value="">جميع الطلاب (تقرير فصل)</option>
              {students.map(s=><option value={s.id} key={s.id}>{s.name} — {s.grade_name} / {s.class_name}</option>)}
            </select>
          </label>
          <label>من تاريخ<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
          <label>إلى تاريخ<input type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/></label>
        </div>
        <div className="tsr-actions">
          <button className="btn primary" type="button" onClick={()=>openPrintPreview(false)} disabled={!reportReady}>معاينة / طباعة التقرير PDF</button>
          <button className="btn ghost" type="button" onClick={()=>void exportExcel()} disabled={!reportReady}>إصدار تقرير Excel</button>
          {(classId||studentId||from||to||query||category!=="ALL")&&<button className="mini-btn" type="button" onClick={()=>{
            setClassId("");setStudentId("");setFrom("");setTo("");setQuery("");setCategory("ALL");
          }}>مسح عوامل التصفية</button>}
          {busy&&<span className="tsr-loading">جارٍ تحميل التقرير...</span>}
        </div>
        {error&&<div className="notice error" role="alert">{error}</div>}
      </section>

      {data?.teacher&&<>
        <section className="panel tsr-printable">
          <div className="tsr-print-heading">
            <div className="tsr-logos">
              <img src={import.meta.env.BASE_URL+"school-logo.png"} alt="شعار المدرسة"/>
              <img src={import.meta.env.BASE_URL+"guidance-logo.png"} alt="شعار التوجيه الطلابي"/>
            </div>
            <div><small>{schoolName}</small><h2>تقرير المعلم عن الطالب / الفصل</h2>
              <p>سجل تعاملات المعلم مع الطلاب داخل بنك التميز</p></div>
            <span className="tsr-report-date">تاريخ الاستخراج: {new Date().toLocaleDateString("ar-SA",{timeZone:"Asia/Riyadh"})}</span>
          </div>
          <div className="tsr-report-meta">
            <div><small>اسم المعلم</small><strong>{data.teacher.name}</strong></div>
            <div><small>المادة</small><strong>{data.teacher.subject||"—"}</strong></div>
            <div><small>الفصل</small><strong>{selectedClass?.label||"كل الفصول المسندة"}</strong></div>
            <div><small>الطالب</small><strong>{selectedStudent?.name||"جميع الطلاب"}</strong></div>
            <div><small>المدة</small><strong>{from||"من البداية"} — {to||"حتى اليوم"}</strong></div>
          </div>
          <div className="tsr-stat-grid">
            <div><small>إجمالي التعاملات</small><strong>{formatNumber(total.events)}</strong></div>
            <div><small>التحويلات</small><strong>{formatNumber(total.referrals)}</strong></div>
            <div><small>دفتر المتابعة</small><strong>{formatNumber(total.followup)}</strong></div>
            <div><small>الشيكات</small><strong>{formatNumber(total.checks)}</strong></div>
            <div><small>التقييمات</small><strong>{formatNumber(total.evaluations)}</strong></div>
            <div><small>النقاط السارية الممنوحة</small><strong>{formatNumber(total.valid_points)}</strong></div>
          </div>

          {!studentId&&<div className="tsr-section">
            <div className="tsr-section-title"><h3>ملخص الطلاب {selectedClass?"في الفصل":"في الفصول المسندة"}</h3><small>{formatNumber(stats.length)} طالب</small></div>
            <div className="table-wrap"><table className="tsr-table">
              <thead><tr><th>الطالب</th><th>الصف / الفصل</th><th>تحويلات</th><th>متابعة</th><th>شيكات</th><th>تقييمات</th><th>النقاط السارية</th><th>الإجمالي</th><th className="tsr-no-print">إجراء</th></tr></thead>
              <tbody>{stats.map(s=><tr key={s.student_id}>
                <td><b>{s.student_name}</b><small>{s.student_no}</small></td>
                <td>{s.grade_name} / {s.class_name}</td>
                <td>{formatNumber(s.referrals)}</td><td>{formatNumber(s.followup)}</td>
                <td>{formatNumber(s.checks)}</td><td>{formatNumber(s.evaluations)}</td>
                <td><b>{formatNumber(s.valid_points)}</b></td><td>{formatNumber(s.events)}</td>
                <td className="tsr-no-print"><button type="button" className="mini-btn" onClick={()=>setStudentId(s.student_id)}>تقرير الطالب</button></td>
              </tr>)}
              {!stats.length&&<tr><td colSpan={9}>لا يوجد طلاب في النطاق المختار.</td></tr>}</tbody>
            </table></div>
          </div>}

          <div className="tsr-section">
            <div className="tsr-section-title"><h3>السجل التفصيلي للتعاملات</h3>
              <small>{formatNumber(activities.length)} سجل</small></div>
            <div className="tsr-detail-tools tsr-no-print">
              <button className="btn ghost" type="button" onClick={()=>void exportDetailsExcel()} disabled={!reportReady}>تصدير السجل التفصيلي Excel</button>
              <button className="btn primary" type="button" onClick={()=>openPrintPreview(true)} disabled={!reportReady}>معاينة / طباعة السجل التفصيلي PDF</button>
            </div>
            <div className="tsr-categories tsr-no-print">
              {categories.map(([id,label])=><button type="button" key={id}
                className={category===id?"active":""} onClick={()=>setCategory(id)}>
                {label}<span>{id==="ALL"?data.activities.length:countByCategory(id)}</span>
              </button>)}
            </div>
            <div className="tsr-search tsr-no-print"><input value={query} onChange={e=>setQuery(e.target.value)}
              placeholder="ابحث باسم الطالب أو نص الملاحظة أو المادة أو نوع التعامل"/></div>
            <div className="table-wrap"><table className="tsr-table tsr-events">
              <thead><tr><th>التاريخ</th>{!studentId&&<th>الطالب</th>}<th>النوع</th>
                <th>الإجراء المسجل</th><th>التفاصيل</th><th>المادة</th><th>الحالة</th><th>النقاط</th></tr></thead>
              <tbody>
                {activities.map(a=><tr key={a.category+":"+a.source_id}>
                  <td className="tsr-date">{stamp(a.event_at)}</td>
                  {!studentId&&<td><b>{a.student_name}</b><small>{a.grade_name} / {a.class_name}</small></td>}
                  <td><span className={"tsr-type tsr-"+a.category.toLowerCase()}>{categories.find(c=>c[0]===a.category)?.[1]||a.category}</span></td>
                  <td><b>{a.title}</b></td><td className="tsr-detail">{a.detail||"—"}</td>
                  <td>{a.subject||"—"}</td><td>{statusText(a.status)}</td>
                  <td>{a.points==null?"—":<><b>{formatNumber(a.points)}</b>
                    {a.effective_points===0&&<small>غير محتسبة</small>}</>}</td>
                </tr>)}
                {!activities.length&&<tr><td colSpan={studentId?7:8} className="tsr-empty">لا توجد تعاملات مطابقة للفلاتر المختارة.</td></tr>}
              </tbody>
            </table></div>
          </div>
          <p className="tsr-legal">يتضمن التقرير التعاملات المسجلة بواسطة المعلم المحدد فقط. إجمالي النقاط السارية لا يشمل الشيكات الملغاة أو المعكوسة أو المرفوضة، ولا يمثل الرصيد الكلي للطالب.</p>
        </section>
      </>}
      {!data?.teacher&&!busy&&!error&&<section className="panel tsr-no-print">
        <div className="empty">اختر المعلم لعرض تقرير الطلاب والفصول المسندة إليه.</div>
      </section>}
      {!data&&busy&&<section className="panel tsr-no-print"><div className="empty">جارٍ إعداد سجل المعلم...</div></section>}
    </main>
  </div>;
}
