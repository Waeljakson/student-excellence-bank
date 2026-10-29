import {useEffect,useState} from "react";
import {niceError,rpc} from "./client";
import "./period-notices.css";

export type PeriodNotice={
  id:string;title:string;academic_year:string;semester:string;
  period_title:string;grade:string;class_name:string;published_at:string
};
export type PeriodNoticeChild={id:string;name:string;period_notices?:PeriodNotice[]};
export type PeriodNoticeAccess={studentNo?:string;schoolCode?:string;token?:string};

type OriginalFileResponse={name:string;mime:string;base64:string};
const safeName=(name:string)=>String(name||"إشعار نتائج الطالب.xlsx")
  .replace(/[\\/:*?"<>|\x00-\x1F]/g,"_").slice(0,180);

async function downloadOriginalNotice(id:string,access?:PeriodNoticeAccess){
  // Fetch only the selected student's original one-sheet workbook on demand.
  // The database verifies publication, linked school and student/guardian access.
  const d=await rpc<OriginalFileResponse>("api_period_notice_original",{
    p_notice_id:id,
    p_student_no:access?.studentNo||null,
    p_school_code:access?.schoolCode||null,
    p_guardian_token:access?.token||null
  });
  if(!d?.base64||!d?.name)throw new Error("تعذر تحميل ملف الإشعار الأصلي.");
  const binary=atob(d.base64.replace(/\s/g,""));
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([bytes],{
    type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }));
  try{
    const a=document.createElement("a");
    a.href=url;a.download=safeName(d.name);
    document.body.appendChild(a);a.click();a.remove();
  }finally{window.setTimeout(()=>URL.revokeObjectURL(url),120000)}
}

function OriginalNoticeCard({notice,access}:{notice:PeriodNotice;access?:PeriodNoticeAccess}){
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  async function download(){
    if(busy)return;
    setBusy(true);setError("");
    try{await downloadOriginalNotice(notice.id,access)}
    catch(e){setError(niceError(e))}
    finally{setBusy(false)}
  }
  return <article className="period-original-card" dir="rtl">
    <div className="period-original-top">
      <div className="period-original-icon" aria-hidden="true">▤</div>
      <div className="period-original-heading">
        <span>الإشعار الدراسي الرسمي</span>
        <h4>{notice.period_title||notice.title||"إشعار نتائج الطالب"}</h4>
        <p>{notice.academic_year} · {notice.semester} · {notice.grade}</p>
      </div>
      <span className="period-original-published">منشور</span>
    </div>
    <div className="period-original-preview">
      <img src={`${import.meta.env.BASE_URL}school-logo.png`} alt="شعار المدرسة"/>
      <div><b>إشعار النتائج الأصلي</b>
      <p>نسخة الطالب الأصلية من ملف المدرسة، بنفس تصميم Excel والتنسيق والبيانات والشعار دون تحويلها إلى جدول جديد.</p>
      </div>
    </div>
    <div className="period-original-actions">
      <button type="button" className="btn primary" disabled={busy} onClick={()=>void download()}>
        {busy?"جارٍ تنزيل الإشعار الأصلي...":"تنزيل الإشعار الأصلي بنفس شكله"}
      </button>
      <small>ملف Excel الأصلي للطالب فقط · يمكن فتحه وطباعته بنفس التنسيق.</small>
    </div>
    {error&&<div className="notice error" role="alert">{error}</div>}
  </article>;
}

/** Show original per-student notices, never a retyped or reformatted grades table. */
export function PeriodNoticesInline({children,emptyMessage=true,access}:{
  children:PeriodNoticeChild[];emptyMessage?:boolean;access?:PeriodNoticeAccess
}){
  const visible=children.filter(x=>(x.period_notices||[]).length);
  if(!visible.length)return emptyMessage?<section className="panel period-inline-empty" dir="rtl">
    <h3>إشعارات نتائج الفترات</h3><p>لا توجد إشعارات منشورة حتى الآن.</p></section>:null;
  return <section className="period-notices period-notice-reader" dir="rtl">
    <h2>إشعارات النتائج الأصلية</h2>
    {visible.map(child=><div className="period-child" key={child.id}>
      <h3>إشعارات الطالب: {child.name}</h3>
      {(child.period_notices||[]).map(n=>
        <OriginalNoticeCard key={n.id} notice={n} access={access}/>
      )}
    </div>)}
  </section>;
}

/** Authenticated student/guardian portal: no student ID can be supplied from UI. */
export default function PeriodNoticeViewer(){
  const[children,setChildren]=useState<PeriodNoticeChild[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  async function load(){
    setLoading(true);
    try{
      const d=await rpc<{role:string;children:PeriodNoticeChild[]}>("api_period_notice_my");
      setChildren(Array.isArray(d?.children)?d.children:[]);setError("");
    }catch(e){setError(niceError(e))}finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[]);
  return <div className="period-notices" dir="rtl">
    {error&&<div className="notice error" role="alert">{error}</div>}
    <button type="button" className="mini-btn" onClick={()=>void load()} disabled={loading}>
      {loading?"جارٍ تحميل إشعارات النتائج...":"تحديث الإشعارات"}
    </button>
    {!loading&&<PeriodNoticesInline children={children}/>}
    {loading&&<p>جارٍ تحميل الإشعارات المنشورة...</p>}
  </div>;
}
