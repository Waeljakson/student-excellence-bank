import { FormEvent, useEffect, useState } from "react";
import { niceError, rpc } from "./client";
import "./engagement.css";

type RequestRow={id:string;points_cost:number;status:"PENDING"|"APPROVED"|"FULFILLED"|"REJECTED"|"CANCELLED";requested_at:string;fulfilled_at?:string|null;notes?:string|null;estimated_sar:number;processed_by?:string|null};
type Data={is_open:boolean;opened_at?:string|null;min_points:number;balance:number;point_value_sar:number;estimated_balance_sar:number;can_request:boolean;has_pending:boolean;requests:RequestRow[]};
const statusLabel=(s:string)=>({PENDING:"قيد انتظار الموجه",APPROVED:"معتمد",FULFILLED:"تم الاستبدال",REJECTED:"مرفوض",CANCELLED:"ملغي"} as Record<string,string>)[s]||s;
const fmt=(v?:string|null)=>v?new Date(v).toLocaleString("ar-SA",{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"—";

export default function StudentRedemptionPanel(){
  const[data,setData]=useState<Data|null>(null);const[points,setPoints]=useState("50");const[busy,setBusy]=useState(false);const[msg,setMsg]=useState("");
  async function load(){try{const d=await rpc<Data>("api_student_redemption_portal");setData(d);if(Number(points)<50||Number(points)>d.balance)setPoints(String(Math.min(Math.max(50,d.min_points),Math.max(50,d.balance))))}catch(e){setMsg(niceError(e))}}
  useEffect(()=>{load()},[]);
  async function submit(e:FormEvent){e.preventDefault();if(!data)return;const n=Math.floor(Number(points));if(!Number.isFinite(n)||n<50){setMsg("الحد الأدنى لطلب الاستبدال 50 نقطة.");return}if(n>data.balance){setMsg("عدد النقاط المطلوب أكبر من رصيدك الحالي.");return}setBusy(true);setMsg("");try{await rpc("api_student_request_redemption",{p_points:n});setMsg("تم إرسال طلب الاستبدال للموجه الطلابي. لن تخصم النقاط إلا بعد تنفيذ الاستبدال فعليًا.");await load()}catch(err){setMsg(niceError(err))}finally{setBusy(false)}}
  if(!data)return <section className="portal-panel redemption-student-panel"><div className="empty">جارٍ تحميل حالة الاستبدال...</div></section>;
  const progress=Math.min(100,Math.max(0,(data.balance/50)*100));
  const pending=data.requests.find(x=>x.status==="PENDING"||x.status==="APPROVED");
  return <section className={`portal-panel redemption-student-panel ${data.is_open?"open":"closed"}`}>
    <div className="portal-panel-title"><div><h3>استبدال نقاط التميز</h3><p>يبدأ الاستحقاق من 50 نقطة، ولا يتم الخصم إلا بعد تنفيذ الموجه للاستبدال.</p></div><span className={data.is_open?"redemption-window open":"redemption-window closed"}>{data.is_open?"الاستبدال مفتوح":"الاستبدال مغلق"}</span></div>
    <div className="redemption-student-summary"><div><small>رصيدك</small><strong>{data.balance}</strong><span>نقطة</span></div><div><small>القيمة التقديرية</small><strong>{Number(data.estimated_balance_sar).toLocaleString("ar-SA",{maximumFractionDigits:2})}</strong><span>ر.س</span></div><div><small>حد الطلب</small><strong>50</strong><span>نقطة</span></div></div>
    {data.balance<50&&<div className="redemption-progress"><div><span>باقي لك {50-data.balance} نقطة للوصول لحد الاستبدال</span><b>{data.balance}/50</b></div><i><em style={{width:`${progress}%`}}/></i></div>}
    {pending&&<div className="redemption-pending-card"><div><span>طلب قائم</span><b>{pending.points_cost} نقطة</b><small>≈ {Number(pending.estimated_sar).toLocaleString("ar-SA",{maximumFractionDigits:2})} ر.س · {fmt(pending.requested_at)}</small></div><strong>{statusLabel(pending.status)}</strong></div>}
    {!pending&&data.balance>=50&&!data.is_open&&<div className="redemption-locked-note"><b>أنت مؤهل للاستبدال</b><span>انتظر فتح نافذة الاستبدال من الموجه الطلابي، وبعدها سيظهر لك زر إرسال الطلب.</span></div>}
    {data.can_request&&<form className="redemption-request-form" onSubmit={submit}><div><label>عدد النقاط المراد استبدالها<input type="number" min="50" max={data.balance} step="1" value={points} onChange={e=>setPoints(e.target.value)}/></label><div className="redemption-quick-picks">{[50,100,data.balance].filter((x,i,a)=>x<=data.balance&&a.indexOf(x)===i).map(x=><button type="button" key={x} onClick={()=>setPoints(String(x))}>{x===data.balance?"كل الرصيد":`${x} نقطة`}</button>)}</div></div><div className="redemption-estimate"><small>القيمة التقديرية</small><b>{(Math.max(0,Number(points)||0)*data.point_value_sar).toLocaleString("ar-SA",{maximumFractionDigits:2})} ر.س</b><span>الخصم يتم فقط عند اعتماد «تم الاستبدال» من الموجه.</span></div><button className="btn primary" disabled={busy}>{busy?"جارٍ إرسال الطلب...":"طلب استبدال النقاط"}</button></form>}
    {data.requests.length>0&&<div className="student-redemption-history"><h4>سجل طلبات الاستبدال</h4>{data.requests.slice(0,5).map(r=><div key={r.id}><span className={`redemption-status ${r.status.toLowerCase()}`}>{statusLabel(r.status)}</span><b>{r.points_cost} نقطة</b><small>{fmt(r.requested_at)}{r.fulfilled_at?` · تم التنفيذ ${fmt(r.fulfilled_at)}`:""}</small></div>)}</div>}
    {msg&&<div className="notice compact-notice">{msg}</div>}
  </section>;
}
