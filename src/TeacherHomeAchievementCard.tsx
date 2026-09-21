import { useEffect, useState } from "react";
import { niceError, rpc } from "./client";
import "./teacher-achievement-stats.css";

type Mine = {
  rank:number;
  score:number;
  active_days:number;
  total_activities:number;
  gap_to_next:number;
};

type AchievementEnvelope = {
  achievement?:{
    total_teachers:number;
    mine?:Mine|null;
  }
};

function fmt(v:number|string|undefined|null){
  return Number(v||0).toLocaleString("ar-SA");
}

export default function TeacherHomeAchievementCard({onOpen}:{onOpen:()=>void}){
  const[data,setData]=useState<AchievementEnvelope["achievement"]|null>(null);
  const[error,setError]=useState("");

  async function load(){
    setError("");
    try{
      const envelope=await rpc<AchievementEnvelope>("api_teacher_followup_data");
      setData(envelope?.achievement||null);
    }catch(e){
      setError(niceError(e));
    }
  }

  useEffect(()=>{void load()},[]);

  if(error)return <section className="teacher-home-rank-card compact-error"><div><small>إنجازي هذا الشهر</small><b>تعذر تحميل ترتيبك الآن</b></div><button className="mini-btn" onClick={load}>إعادة المحاولة</button></section>;
  if(!data)return <section className="teacher-home-rank-card loading"><span>جارٍ تحديث ترتيبك...</span></section>;
  if(!data.mine)return null;

  const mine=data.mine;
  const progress=Math.min(100,Math.max(0,Number(mine.score||0)));
  const message=mine.rank===1
    ?"أنت في المركز الأول حاليًا."
    : mine.gap_to_next>0
      ?"يفصلك "+fmt(mine.gap_to_next)+" نقطة عن المركز السابق."
      :"أنت قريب جدًا من المركز السابق.";

  return <section className="teacher-home-rank-card">
    <div className="teacher-home-rank-main">
      <span className="teacher-home-rank-kicker">إنجازي هذا الشهر</span>
      <div className="teacher-home-rank-title">
        <span className={"teacher-home-rank-medal rank-"+Math.min(mine.rank,4)}>{mine.rank===1?"🥇":mine.rank===2?"🥈":mine.rank===3?"🥉":"#"+fmt(mine.rank)}</span>
        <div><small>مركزك الآن</small><h2>المركز {fmt(mine.rank)} <em>من {fmt(data.total_teachers)}</em></h2><p>{message}</p></div>
      </div>
    </div>
    <div className="teacher-home-rank-metrics">
      <div><small>مؤشر الإنجاز</small><strong>{fmt(mine.score)}<em>/100</em></strong><span className="teacher-home-mini-track"><i style={{width:progress+"%"}}/></span></div>
      <div><small>أيام النشاط</small><strong>{fmt(mine.active_days)}</strong></div>
      <div><small>إجمالي النشاط</small><strong>{fmt(mine.total_activities)}</strong></div>
    </div>
    <button className="teacher-home-rank-action" onClick={onOpen}>عرض تفاصيل إنجازي</button>
  </section>;
}
