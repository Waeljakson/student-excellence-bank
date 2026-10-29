import {useEffect,useState} from "react";
import {niceError,rpc} from "./client";
import PeriodNoticeDesignedImage from "./PeriodNoticeDesignedImage";
import "./period-notices.css";

export type SchoolLeader={name:string;rank:number;score_percent:number|null};
export type PeriodNotice={
  id:string;title:string;academic_year:string;semester:string;period_title:string;
  grade:string;class_name:string;published_at:string;
  school_rank?:number;class_rank?:number;school_count?:number;class_count?:number;
  score_percent?:number|null;is_top_five?:boolean;school_top_five?:SchoolLeader[];
  subjects?:Array<{subject:string;maximum:number|null;total:number|null;assessments?:Record<string,number|null>;note?:string}>;
  sum_total?:number|null;sum_max?:number|null;
  attendance?:number|null;behavior_excellence?:number|null;behavior_positive?:number|null;
};
export type PeriodNoticeChild={id:string;name:string;period_notices?:PeriodNotice[]};
export type PeriodNoticeAccess={studentNo?:string;schoolCode?:string;token?:string};
function OriginalNoticeCard({notice,studentName,schoolName}:{
  notice:PeriodNotice;studentName:string;schoolName?:string
}){
  return <article className="period-original-card" dir="rtl">
    <div className="period-original-top">
      <div className="period-original-icon" aria-hidden="true">▤</div>
      <div className="period-original-heading">
        <span>إشعار نتائج الطالب المنشور</span>
        <h4>{notice.period_title||notice.title||"إشعار نتائج الطالب"}</h4>
        <p>{notice.academic_year} · {notice.semester} · {notice.grade}</p>
      </div>
      <span className="period-original-published">منشور</span>
    </div>
    <PeriodNoticeDesignedImage notice={notice} studentName={studentName} schoolName={schoolName}/>
  </article>;
}
export function PeriodNoticesInline({children,emptyMessage=true,access,schoolName}:{
  children:PeriodNoticeChild[];emptyMessage?:boolean;access?:PeriodNoticeAccess;schoolName?:string
}){
  void access;
  const visible=children.filter(x=>(x.period_notices||[]).length);
  if(!visible.length)return emptyMessage?<section className="panel period-inline-empty" dir="rtl">
    <h3>إشعارات نتائج الفترات</h3><p>لا توجد إشعارات منشورة حتى الآن.</p></section>:null;
  return <section className="period-notices period-notice-reader" dir="rtl">
    <h2>إشعارات النتائج الدراسية</h2>
    {visible.map(child=><div className="period-child" key={child.id}>
      <h3>الطالب: {child.name}</h3>
      {(child.period_notices||[]).map(n=><OriginalNoticeCard key={n.id} notice={n} studentName={child.name} schoolName={schoolName}/>)}
    </div>)}
  </section>;
}
/** Authenticated student/guardian portal: the server scopes all data to the session. */
export default function PeriodNoticeViewer({schoolName}:{schoolName?:string}){
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
    {!loading&&<PeriodNoticesInline children={children} schoolName={schoolName}/>}
    {loading&&<p>جارٍ تحميل الإشعارات المنشورة...</p>}
  </div>;
}
