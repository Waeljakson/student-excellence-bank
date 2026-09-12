import { useEffect, useState } from "react";
import { niceError, rpc } from "./client";
import "./engagement.css";
import "./reward-store.css";

type RewardItem={id:string;name_ar:string;description_ar?:string|null;cost_points:number;stock?:number|null;image_url?:string|null};
type RequestRow={id:string;reward_id:string;reward_name:string;points_cost:number;status:"PENDING"|"APPROVED"|"FULFILLED"|"REJECTED"|"CANCELLED";requested_at:string;fulfilled_at?:string|null;notes?:string|null;processed_by?:string|null};
type Data={is_open:boolean;opened_at?:string|null;min_points:number;balance:number;can_request:boolean;has_pending:boolean;rewards:RewardItem[];requests:RequestRow[]};

const statusLabel=(s:string)=>({PENDING:"قيد انتظار الموجه",APPROVED:"معتمد",FULFILLED:"تم التسليم",REJECTED:"مرفوض",CANCELLED:"ملغي"} as Record<string,string>)[s]||s;
const fmt=(v?:string|null)=>v?new Date(v).toLocaleString("ar-SA",{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"—";
function giftIcon(name:string){if(name.includes("قلم"))return "✒️";if(name.includes("دفتر")||name.includes("كتاب"))return "📘";if(name.includes("مقلمة")||name.includes("أدوات"))return "✏️";if(name.includes("قارورة"))return "🥤";if(name.includes("كرة"))return "⚽";if(name.includes("حقيبة"))return "🎒";if(name.includes("صندوق"))return "🎁";return "🎁"}

export default function StudentRedemptionPanel(){
  const[data,setData]=useState<Data|null>(null);const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");
  async function load(){try{setData(await rpc<Data>("api_student_redemption_portal"))}catch(e){setMsg(niceError(e))}}
  useEffect(()=>{load()},[]);
  async function requestGift(reward:RewardItem){
    if(!data||busy)return;
    if(!window.confirm(`طلب هدية «${reward.name_ar}» مقابل ${reward.cost_points} نقطة؟ لن تُخصم النقاط إلا عند تسليم الهدية لك.`))return;
    setBusy(reward.id);setMsg("");
    try{await rpc("api_student_request_reward",{p_reward_id:reward.id});setMsg(`تم إرسال طلب «${reward.name_ar}» للموجه الطلابي. سيتم خصم ${reward.cost_points} نقطة فقط عند تسليم الهدية.`);await load()}
    catch(err){setMsg(niceError(err))}finally{setBusy("")}
  }
  if(!data)return <section className="portal-panel reward-store-panel"><div className="empty">جارٍ تحميل متجر الهدايا...</div></section>;
  const pending=data.requests.find(x=>x.status==="PENDING"||x.status==="APPROVED");
  const available=data.rewards.filter(r=>r.stock==null||r.stock>0).length;
  const progress=Math.min(100,Math.max(0,(data.balance/Math.max(1,data.min_points))*100));
  return <section className={`portal-panel reward-store-panel ${data.is_open?"open":"closed"}`}>
    <div className="portal-panel-title"><div><h3>متجر هدايا التميز</h3><p>استبدل نقاطك بهدايا مدرسية فعلية. لا توجد قسائم مالية، والخصم يتم فقط عند تسليم الهدية.</p></div><span className={data.is_open?"redemption-window open":"redemption-window closed"}>{data.is_open?"الاستبدال مفتوح":"الاستبدال مغلق"}</span></div>

    <div className="reward-store-summary">
      <div><small>رصيدك الحالي</small><strong>{data.balance}</strong><span>نقطة</span></div>
      <div><small>أقل هدية</small><strong>{data.min_points}</strong><span>نقطة</span></div>
      <div><small>الهدايا المتاحة</small><strong>{available}</strong><span>هدية</span></div>
    </div>

    {data.balance<data.min_points&&<div className="redemption-progress"><div><span>باقي لك {data.min_points-data.balance} نقطة للوصول لأول هدية</span><b>{data.balance}/{data.min_points}</b></div><i><em style={{width:`${progress}%`}}/></i></div>}

    {pending?<div className="reward-request-card"><div><span>طلب هدية قائم</span><b>{pending.reward_name}</b><small>{pending.points_cost} نقطة · {fmt(pending.requested_at)}</small></div><strong>{statusLabel(pending.status)}</strong></div>:<div className="reward-store-intro"><div><b>{data.is_open?"اختر هديتك من المتجر":"المتجر ظاهر لك ويمكنك التخطيط لهديتك"}</b><span>{data.is_open?"اضغط على الهدية المناسبة لرصيدك لإرسال الطلب للموجه الطلابي.":"عند فتح الاستبدال من الموجه الطلابي ستتمكن من طلب أي هدية يكفي لها رصيدك."}</span></div><em>الاستبدال بهدايا فقط</em></div>}

    <div className="reward-gift-grid">
      {data.rewards.map(reward=>{
        const out=reward.stock!=null&&reward.stock<=0;const enough=data.balance>=reward.cost_points;const disabled=!!pending||!data.is_open||!enough||out||!!busy;
        let buttonText="اطلب هذه الهدية";
        if(pending)buttonText="لديك طلب قائم";else if(!data.is_open)buttonText="الاستبدال مغلق";else if(out)buttonText="نفدت الكمية";else if(!enough)buttonText=`ينقصك ${reward.cost_points-data.balance} نقطة`;else if(busy===reward.id)buttonText="جارٍ إرسال الطلب...";
        const stockClass=out?"out":reward.stock!=null&&reward.stock<=5?"low":"";
        return <article className={`reward-gift-card ${!enough?"locked":""} ${out?"out":""}`} key={reward.id}>
          <div className="reward-gift-top"><span className="reward-gift-icon">{giftIcon(reward.name_ar)}</span><span className={`reward-stock ${stockClass}`}>{reward.stock==null?"متوفر":out?"نفد":`${reward.stock} متاح`}</span></div>
          <h4>{reward.name_ar}</h4>
          <p>{reward.description_ar||"هدية من متجر التميز الطلابي"}</p>
          <div className="reward-gift-cost"><strong>{reward.cost_points}</strong><span>نقطة</span></div>
          {!enough&&!out&&<div className="reward-shortfall">تحتاج {reward.cost_points-data.balance} نقطة إضافية</div>}
          <button className="btn primary" disabled={disabled} onClick={()=>requestGift(reward)}>{buttonText}</button>
        </article>
      })}
    </div>

    {data.requests.length>0&&<div className="reward-history"><h4>سجل هداياي</h4>{data.requests.slice(0,6).map(r=><div key={r.id}><span className={`redemption-status ${r.status.toLowerCase()}`}>{statusLabel(r.status)}</span><b>{r.reward_name} · {r.points_cost} نقطة</b><small>{fmt(r.requested_at)}{r.fulfilled_at?` · تم التسليم ${fmt(r.fulfilled_at)}`:""}</small></div>)}</div>}
    {msg&&<div className="notice compact-notice">{msg}</div>}
  </section>;
}
