import "./medals.css";

export type Medal={
  id:string;
  badge_id:string;
  name_ar:string;
  description_ar?:string|null;
  icon_key?:string|null;
  medal_kind?:string|null;
  source_type?:string|null;
  source_id?:string|null;
  awarded_at:string;
};

function medalIcon(m:Medal){
  if(m.icon_key)return m.icon_key;
  const kind=String(m.medal_kind||"").toUpperCase();
  return kind==="ACADEMIC"?"🎓":kind==="BEHAVIORAL"?"★":kind==="COMPETITION"?"🏆":"🏅";
}

function medalKind(m:Medal){
  const kind=String(m.medal_kind||"").toUpperCase();
  return kind==="ACADEMIC"?"تفوق دراسي":kind==="BEHAVIORAL"?"تميز سلوكي":kind==="COMPETITION"?"فوز في مسابقة":"تكريم";
}

export function recentMedals(medals:Medal[],days=3){
  const now=Date.now();
  const max=days*24*60*60*1000;
  return (medals||[]).filter(m=>{
    const t=new Date(m.awarded_at).getTime();
    return Number.isFinite(t)&&t<=now&&now-t<=max;
  });
}

export function MedalCelebrations({medals,studentName}:{medals:Medal[];studentName:string}){
  const recent=recentMedals(medals,3);
  if(!recent.length)return null;
  return <div className="medal-celebrations">
    {recent.map(m=><section className="medal-celebration" key={"celebrate-"+m.id}>
      <div className="medal-celebration-icon">{medalIcon(m)}</div>
      <div>
        <span>تهنئة وتكريم</span>
        <h3>نبارك لكم تميز {studentName}</h3>
        <p>حصل الطالب على ميدالية <b>«{m.name_ar}»</b>{m.description_ar?" — "+m.description_ar:""}.</p>
        <small>يستمر إعلان التهنئة لمدة 3 أيام، وتبقى الميدالية محفوظة دائمًا في صفحة الميداليات.</small>
      </div>
    </section>)}
  </div>;
}

export default function MedalsPanel({medals,title="ميداليات"}:{medals:Medal[];title?:string}){
  const rows=medals||[];
  return <section className="portal-panel medals-panel">
    <div className="medals-head">
      <div><span>سجل الإنجازات</span><h3>{title}</h3><p>ميداليات دائمة توثق الفوز والتفوق والتكريمات المعتمدة.</p></div>
      <b>{rows.length.toLocaleString("ar-SA")}</b>
    </div>
    {rows.length?<div className="medals-grid">
      {rows.map(m=><article className="medal-card" key={m.id}>
        <div className="medal-symbol"><span>{medalIcon(m)}</span><i/></div>
        <div className="medal-copy">
          <small>{medalKind(m)}</small>
          <h4>{m.name_ar}</h4>
          {m.description_ar&&<p>{m.description_ar}</p>}
          <time>{new Date(m.awarded_at).toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"})}</time>
        </div>
      </article>)}
    </div>:<div className="empty medals-empty">لا توجد ميداليات مسجلة حتى الآن. ستظهر هنا الميداليات عند اعتماد أي فوز أو تكريم.</div>}
  </section>;
}
