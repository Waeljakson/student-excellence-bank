import type {Medal} from "./MedalsPanel";
import "./guardian-family-insights.css";

export type FamilyChild={
 id:string;name:string;points:number;
 notes?:Array<{id:string;note_date:string;note_kind?:string;note_text?:string;subject_ar?:string;category_ar?:string}>;
 periodic_evaluations?:Array<{cycle_id?:string;cycle_title?:string;published_at?:string;subject_ar?:string}>;
 individual_evaluations?:Array<{report_id?:string;report_no?:string;published_to_guardian_at?:string}>;
 period_notices?:Array<{id:string;period_title?:string;published_at?:string}>;
 competitions?:Array<{id?:string;name_ar?:string;starts_on?:string}>;
};
const fmt=(n:number)=>n.toLocaleString("ar-SA");
const dateKey=(v?:string)=>String(v||"").slice(0,10);
function todayRiyadh(){
 return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function weekStart(){
 const k=todayRiyadh();const day=new Date(k+"T12:00:00+03:00");
 day.setUTCDate(day.getUTCDate()-6);return day.toISOString().slice(0,10);
}
function labelDate(value?:string){
 if(!value)return "";
 const d=new Date(value.length===10?value+"T12:00:00+03:00":value);
 return Number.isNaN(d.getTime())?"":d.toLocaleDateString("ar-SA",{timeZone:"Asia/Riyadh",day:"numeric",month:"short",year:"numeric"});
}
type GoTab="overview"|"followup"|"medals"|"period-notices"|"periodic"|"updates";
export function GuardianWeeklyPulse({child,medals,allowsPeriodNotices,onGo}:{child:FamilyChild;medals:Medal[];allowsPeriodNotices:boolean;onGo:(tab:GoTab)=>void}){
 const from=weekStart(),to=todayRiyadh();
 const weekly=(child.notes||[]).filter(x=>dateKey(x.note_date)>=from&&dateKey(x.note_date)<=to);
 const by=(k:string)=>weekly.filter(x=>String(x.note_kind||"").toUpperCase()===k).length;
 const positive=by("POSITIVE"),needFollowup=by("NEGATIVE"),homework=by("HOMEWORK");
 const newlyMedaled=medals.filter(x=>dateKey(x.awarded_at)>=from&&dateKey(x.awarded_at)<=to);
 const currentNotice=allowsPeriodNotices?(child.period_notices||[]).length:0;
 const latest=weekly[0];
 return <section className="guardian-week-pulse" aria-label="ملخص متابعة الأسبوع">
  <div className="guardian-week-title"><div><span>جديد بوابة ولي الأمر</span><h3>ملخص أسبوع ابنكم</h3><p>بيانات مسجلة خلال آخر 7 أيام (بتوقيت السعودية)، وليست تقييمًا نهائيًا للطالب.</p></div>
   <button type="button" onClick={()=>onGo("updates")}>جميع المستجدات ←</button></div>
  <div className="guardian-week-grid">
   <article><small>ملاحظات إيجابية</small><strong>{fmt(positive)}</strong><button onClick={()=>onGo("followup")}>عرض الملاحظات</button></article>
   <article><small>ملاحظات تحتاج متابعة</small><strong>{fmt(needFollowup)}</strong><button onClick={()=>onGo("followup")}>متابعة التفاصيل</button></article>
   <article><small>ملاحظات الواجبات</small><strong>{fmt(homework)}</strong><button onClick={()=>onGo("followup")}>دفتر المتابعة</button></article>
   <article><small>ميداليات أُضيفت هذا الأسبوع</small><strong>{fmt(newlyMedaled.length)}</strong><button onClick={()=>onGo("medals")}>عرض الميداليات</button></article>
  </div>
  <div className="guardian-week-footer">
   <p>{latest?<><b>آخر ملاحظة هذا الأسبوع:</b> {latest.subject_ar||"متابعة"} — {latest.note_text||"راجع دفتر المتابعة"}.</>:"لم تسجل ملاحظات خلال الأيام السبعة الماضية. هذا لا يعني عدم وجود متابعة خارج المنصة."}</p>
   {allowsPeriodNotices&&currentNotice>0&&<button type="button" onClick={()=>onGo("period-notices")}>إشعارات النتائج المنشورة ({fmt(currentNotice)})</button>}
  </div>
 </section>;
}
type Update={id:string;kind:string;title:string;body:string;date?:string;tab:GoTab;order:number};
export function GuardianUpdatesHub({child,medals,allowsPeriodNotices,onGo}:{child:FamilyChild;medals:Medal[];allowsPeriodNotices:boolean;onGo:(tab:GoTab)=>void}){
 const items:Update[]=[];
 const add=(id:string,kind:string,title:string,body:string,date:string|undefined,tab:GoTab)=>{
  const timestamp=date?new Date(date.length===10?date+"T12:00:00+03:00":date).getTime():0;
  items.push({id,kind,title,body,date,tab,order:Number.isFinite(timestamp)?timestamp:0});
 };
 (child.notes||[]).slice(0,35).forEach(x=>add("n:"+x.id,"دفتر المتابعة",
  x.subject_ar||x.category_ar||"ملاحظة من المعلم",x.note_text||"يمكنك مراجعة التفاصيل في دفتر المتابعة.",x.note_date,"followup"));
 (medals||[]).forEach(x=>add("m:"+x.id,"تكريم",x.name_ar,"أُضيفت ميدالية إلى سجل إنجازات ابنكم.",x.awarded_at,"medals"));
 if(allowsPeriodNotices)(child.period_notices||[]).forEach(x=>add("r:"+x.id,"نتائج دراسية",
  x.period_title||"إشعار نتيجة منشور","يمكن الاطلاع على صورة الإشعار وطباعتها من إشعارات النتائج.",x.published_at,"period-notices"));
 (child.periodic_evaluations||[]).forEach((x,i)=>add("p:"+(x.cycle_id||i)+":"+i,"تقييم دوري",
  x.cycle_title||"تقييم دوري منشور",x.subject_ar||"تقييم من المدرسة",x.published_at,"periodic"));
 items.sort((a,b)=>b.order-a.order);
 return <section className="guardian-updates portal-panel">
  <header><h3>مستجدات ابني</h3><p>آخر المعلومات المتاحة في بوابة ولي الأمر، مرتبة من الأحدث قدر الإمكان.</p></header>
  {items.length? <div className="guardian-updates-list">{items.slice(0,35).map(x=><article key={x.id}>
   <div><span>{x.kind}</span>{x.date&&<time>{labelDate(x.date)}</time>}</div><h4>{x.title}</h4><p>{x.body}</p><button type="button" onClick={()=>onGo(x.tab)}>عرض التفاصيل ←</button>
  </article>)}</div>:<div className="empty">لا توجد مستجدات مسجلة حتى الآن. يمكنك مراجعة الأقسام الأخرى في البوابة.</div>}
 </section>;
}
