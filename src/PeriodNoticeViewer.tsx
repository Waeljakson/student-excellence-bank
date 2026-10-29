import {useEffect,useRef,useState} from "react";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import {niceError,rpc} from "./client";
import "./period-notices.css";

export type SchoolLeader={name:string;rank:number;score_percent:number|null};
export type PeriodNotice={
  id:string;title:string;academic_year:string;semester:string;period_title:string;
  grade:string;class_name:string;published_at:string;
  school_rank?:number;class_rank?:number;school_count?:number;class_count?:number;
  score_percent?:number|null;is_top_five?:boolean;school_top_five?:SchoolLeader[];
};
export type PeriodNoticeChild={id:string;name:string;period_notices?:PeriodNotice[]};
export type PeriodNoticeAccess={studentNo?:string;schoolCode?:string;token?:string};
type PdfResponse={name:string;mime:string;base64:string};
const asArabic=(value:number|null|undefined)=>value==null?"—":Number(value).toLocaleString("ar-SA");

function pdfFileFromBase64(d:PdfResponse):Blob{
  if(!d?.base64||!d?.name)throw new Error("ملف الإشعار PDF غير متاح حاليًا.");
  const decoded=atob(d.base64.replace(/\s/g,""));
  const bytes=new Uint8Array(decoded.length);
  for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
  if(String.fromCharCode(...bytes.slice(0,5))!=="%PDF-")throw new Error("تعذر قراءة ملف الإشعار PDF.");
  return new Blob([bytes],{type:"application/pdf"});
}
function NoticeImage({notice,access}:{notice:PeriodNotice;access?:PeriodNoticeAccess}){
  const canvas=useRef<HTMLCanvasElement>(null);
  const blobRef=useRef<Blob|null>(null);
  const [busy,setBusy]=useState(true);
  const [downloadBusy,setDownloadBusy]=useState(false);
  const [error,setError]=useState("");
  const [renderError,setRenderError]=useState("");

  async function getPdf():Promise<Blob>{
    if(blobRef.current)return blobRef.current;
    const d=await rpc<PdfResponse>("api_period_notice_pdf",{
      p_notice_id:notice.id,
      p_student_no:access?.studentNo||null,
      p_school_code:access?.schoolCode||null,
      p_guardian_token:access?.token||null
    });
    const file=pdfFileFromBase64(d);
    blobRef.current=file;
    return file;
  }
  useEffect(()=>{
    let cancelled=false;
    let activePdf:any=null;
    setBusy(true);setError("");setRenderError("");blobRef.current=null;
    const render=async()=>{
      try{
        const file=await getPdf();
        if(cancelled)return;
        const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc=workerSrc;
        const bytes=new Uint8Array(await file.arrayBuffer());
        if(cancelled)return;
        const task=pdfjs.getDocument({data:bytes});
        activePdf=await task.promise;
        if(cancelled)return;
        const page=await activePdf.getPage(1);
        const scale=Math.min(2.2,Math.max(1.7,window.devicePixelRatio||1));
        const viewport=page.getViewport({scale});
        const target=canvas.current;
        const context=target?.getContext("2d",{alpha:false});
        if(!target||!context)return;
        target.width=Math.ceil(viewport.width);
        target.height=Math.ceil(viewport.height);
        target.style.aspectRatio=`${viewport.width} / ${viewport.height}`;
        await page.render({canvas:target,canvasContext:context,viewport}).promise;
      }catch(e){
        if(!cancelled){
          if(blobRef.current)setRenderError("تعذرت معاينة الصورة على جهازك، لكن يمكن تنزيل الإشعار بصيغة PDF.");
          else setError(niceError(e));
        }
      }finally{if(!cancelled)setBusy(false)}
    };
    void render();
    return()=>{cancelled=true;void activePdf?.destroy?.()};
  },[notice.id,access?.studentNo,access?.schoolCode,access?.token]);
  async function download(){
    if(downloadBusy)return;
    setDownloadBusy(true);setError("");
    try{
      const file=await getPdf();
      const url=URL.createObjectURL(file);
      const anchor=document.createElement("a");
      anchor.href=url;anchor.download="إشعار نتائج الطالب.pdf";
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){setError(niceError(e))}
    finally{setDownloadBusy(false)}
  }

  return <div className="period-picture-area">
    <div className="period-picture-frame" aria-label="صورة إشعار نتائج الطالب الأصلي">
      <canvas ref={canvas} className={busy||renderError?"period-picture-canvas waiting":"period-picture-canvas"}
        role="img" aria-label="صورة كاملة من إشعار الطالب المدرسي الأصلي بنفس تصميمه"/>
      {busy&&<div className="period-picture-loading" role="status">جارٍ عرض صورة الإشعار الأصلي...</div>}
      {renderError&&<div className="period-picture-fallback">{renderError}</div>}
    </div>
    <div className="period-picture-actions">
      <button type="button" className="btn primary" disabled={downloadBusy} onClick={()=>void download()}>
        {downloadBusy?"جارٍ تجهيز PDF...":"تنزيل الإشعار PDF للطباعة"}
      </button>
      <small>الإشعار الأصلي بنفس التصميم والتفاصيل، صفحة واحدة جاهزة للطباعة.</small>
    </div>
    {error&&<div className="notice error" role="alert">{error}</div>}
  </div>;
}
function RankingDetails({notice}:{notice:PeriodNotice}){
  if(!notice.school_rank||!notice.class_rank)return null;
  return <section className="period-student-ranks" aria-label="ترتيب الطالب">
    <h4>ترتيبك في إشعارات نتائج الفترة</h4>
    <div className="period-rank-cards">
      <article><span>الترتيب على المدرسة</span><strong>{asArabic(notice.school_rank)}</strong><small>من {asArabic(notice.school_count)} طالبًا</small></article>
      <article><span>الترتيب على الفصل</span><strong>{asArabic(notice.class_rank)}</strong><small>من {asArabic(notice.class_count)} طالبًا</small></article>
      <article><span>نسبة التحصيل</span><strong>{notice.score_percent==null?"—":Number(notice.score_percent).toLocaleString("ar-SA",{maximumFractionDigits:2})+"٪"}</strong><small>اعتمادًا على المجموع والنهاية العظمى</small></article>
    </div>
    {!!notice.school_top_five?.length&&<div className="period-school-leaders">
      <h5>الخمسة الأوائل على مستوى المدرسة</h5>
      <ol>{notice.school_top_five.map(leader=>
        <li key={leader.rank}><span className="period-leader-rank">{asArabic(leader.rank)}</span>
          <b>{leader.name}</b><small>{leader.score_percent==null?"—":Number(leader.score_percent).toLocaleString("ar-SA",{maximumFractionDigits:2})+"٪"}</small>
        </li>)}</ol>
    </div>}
    <p className="period-ranking-note">الترتيب محسوب على أساس النسبة المئوية للدرجات المنشورة في الفترة نفسها، لأن النهاية العظمى تختلف بين بعض الصفوف.</p>
  </section>;
}

function OriginalNoticeCard({notice,access}:{notice:PeriodNotice;access?:PeriodNoticeAccess}){
  return <article className="period-original-card" dir="rtl">
    <div className="period-original-top">
      <div className="period-original-icon" aria-hidden="true">▤</div>
      <div className="period-original-heading">
        <span>إشعار رسمي منشور</span>
        <h4>{notice.period_title||notice.title||"إشعار نتائج الطالب"}</h4>
        <p>{notice.academic_year} · {notice.semester} · {notice.grade}</p>
      </div>
      <span className="period-original-published">منشور</span>
    </div>
    <NoticeImage notice={notice} access={access}/>
    <RankingDetails notice={notice}/>
  </article>;
}
export function PeriodNoticesInline({children,emptyMessage=true,access}:{
  children:PeriodNoticeChild[];emptyMessage?:boolean;access?:PeriodNoticeAccess
}){
  const visible=children.filter(x=>(x.period_notices||[]).length);
  if(!visible.length)return emptyMessage?<section className="panel period-inline-empty" dir="rtl">
    <h3>إشعارات نتائج الفترات</h3><p>لا توجد إشعارات منشورة حتى الآن.</p></section>:null;
  return <section className="period-notices period-notice-reader" dir="rtl">
    <h2>إشعار الطالب الأصلي</h2>
    {visible.map(child=><div className="period-child" key={child.id}>
      <h3>الطالب: {child.name}</h3>
      {(child.period_notices||[]).map(n=><OriginalNoticeCard key={n.id} notice={n} access={access}/>)}
    </div>)}
  </section>;
}
/** Authenticated student/guardian portal: the server scopes all data to the session. */
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
