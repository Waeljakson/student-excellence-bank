import {useEffect,useState} from "react";
import {rpc,niceError} from "./client";
import "./smart-analytics.css";
export default function OperationalHealth(){
const [data,setData]=useState<any>(null),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
useEffect(()=>{let active=true;rpc<any>("api_app_health").then(x=>{if(active)setData(x)}).catch(e=>{if(active)setError(niceError(e))});return()=>{active=false}},[refresh]);
const items=[["الطلاب النشطون",data?.active_students],["طلاب بدون فصل صحيح",data?.unassigned_students],["شيكات مرتبطة بمدرسة أخرى",data?.cross_school_checks],["إشعارات تحتاج مطابقة",data?.unresolved_notice_imports]];
return <main className="sa-root content" dir="rtl"><header className="sa-header"><div><h1>صحة النظام</h1><p>فحص بيانات المدرسة وآخر نشاط مباشر.</p></div><button className="sa-btn" onClick={()=>setRefresh(x=>x+1)}>فحص الآن</button></header>
{error&&<p role="alert">{error}</p>}<div className="sa-metrics">{data&&items.map(([label,value])=><article className="sa-metric" key={String(label)}><span>{label}</span><strong>{Number(value||0).toLocaleString("ar-SA")}</strong></article>)}</div>
{data&&<section className="sa-panel"><h2>آخر تحديثات</h2><p>آخر شيك: {data.last_check_at||"لا يوجد"}</p><p>آخر زيارة ولي أمر: {data.last_guardian_visit||"لا يوجد"}</p><p>آخر نشر نتائج: {data.last_result_publication||"لا يوجد"}</p></section>}</main>;
}