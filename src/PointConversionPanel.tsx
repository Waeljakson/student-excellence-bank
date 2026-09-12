import { FormEvent, useEffect, useState } from "react";
import { niceError, rpc } from "./client";
import "./engagement.css";

type Conversion={points_per_sar:number;point_value_sar:number};

export default function PointConversionPanel(){
  const[data,setData]=useState<Conversion|null>(null);const[value,setValue]=useState("5");const[busy,setBusy]=useState(false);const[msg,setMsg]=useState("");
  async function load(){try{const d=await rpc<Conversion>("api_admin_point_conversion");setData(d);setValue(String(Number(d.points_per_sar)||5))}catch(e){setMsg(niceError(e))}}
  useEffect(()=>{load()},[]);
  async function save(e:FormEvent){e.preventDefault();const n=Number(value);if(!Number.isFinite(n)||n<1||n>100){setMsg("حدد عدد نقاط من 1 إلى 100 مقابل الريال الواحد.");return}setBusy(true);setMsg("");try{await rpc("api_admin_set_point_conversion",{p_points_per_sar:n});setMsg(`تم اعتماد ${n} نقاط = 1 ريال.`);await load()}catch(e){setMsg(niceError(e))}finally{setBusy(false)}}
  return <section className="panel point-conversion-panel"><div className="panel-title"><div><h3>قيمة النقاط بالريال</h3><p>حدد عدد نقاط التميز التي تساوي ريالًا واحدًا. يتغير التقييم النقدي للمحافظ دون تغيير أرصدة النقاط.</p></div><span className="counter">ر.س</span></div><form onSubmit={save} className="point-conversion-form"><div className="conversion-equation"><label><span>عدد النقاط</span><input type="number" min="1" max="100" step="1" required value={value} onChange={e=>setValue(e.target.value)}/></label><b>=</b><div><strong>1</strong><span>ريال سعودي</span></div></div><div className="conversion-preview"><small>القيمة الحالية</small><b>{data?`${Number(data.points_per_sar).toLocaleString("ar-SA")} نقاط = 1 ريال`:"جارٍ التحميل..."}</b><span>قيمة النقطة الواحدة: {data?Number(data.point_value_sar).toLocaleString("ar-SA",{maximumFractionDigits:4}):"—"} ر.س</span></div><button className="btn primary" disabled={busy}>{busy?"جارٍ الحفظ...":"حفظ قيمة التحويل"}</button></form>{msg&&<div className="notice compact-notice">{msg}</div>}</section>;
}
