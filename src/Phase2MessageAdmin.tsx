import {useEffect,useMemo,useState} from "react";
import {niceError,rpc} from "./client";
import "./phase2-messaging.css";
type Kind="GENERAL"|"CONGRATULATION"|"ALERT";
type Audience="SCHOOL"|"CLASS"|"STUDENT";
type Status="DRAFT"|"PUBLISHED"|"ARCHIVED";
type Item={id:string;title_ar:string;body_ar:string;kind:Kind;audience:Audience;class_id:string|null;student_id:string|null;duration_days:number;status:Status;created_at:string;published_at:string|null;expires_at:string|null};
type Target={id:string;name:string};
type AdminData={school_id:string;school_name:string;messages:Item[];classes:Target[];students:Target[]};
const kindLabel=(k:Kind)=>({GENERAL:"إعلان عام",CONGRATULATION:"تهنئة",ALERT:"تنبيه"}[k]);
const audienceLabel=(a:Audience)=>({SCHOOL:"جميع طلاب المدرسة",CLASS:"فصل محدد",STUDENT:"طالب محدد"}[a]);
const statusLabel=(s:Status)=>({DRAFT:"مسودة",PUBLISHED:"منشور",ARCHIVED:"مؤرشف"}[s]);
const time=(v:string|null)=>v?new Date(v).toLocaleString("ar-SA",{dateStyle:"medium",timeStyle:"short"}):"—";
const fresh=()=>({id:null as string|null,title_ar:"",body_ar:"",kind:"GENERAL" as Kind,audience:"SCHOOL" as Audience,target_id:"",duration_days:3});
export default function Phase2MessageAdmin(){
 const[data,setData]=useState<AdminData|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const[form,setForm]=useState(fresh),[busy,setBusy]=useState(false),[preview,setPreview]=useState(false),[tick,setTick]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError("");
 rpc<AdminData>("api_phase2_admin_data").then(x=>{if(active)setData(x)})
 .catch(e=>{if(active)setError(niceError(e))}).finally(()=>{if(active)setLoading(false)});
 return()=>{active=false}},[tick]);
 const targets=useMemo(()=>form.audience==="CLASS"?data?.classes||[]:form.audience==="STUDENT"?data?.students||[]:[],[form.audience,data]);
 function edit(item:Item){setForm({id:item.id,title_ar:item.title_ar,body_ar:item.body_ar,kind:item.kind,audience:item.audience,target_id:item.student_id||item.class_id||"",duration_days:item.duration_days});setPreview(false);window.scrollTo({top:0,behavior:"smooth"})}
 function change<K extends keyof ReturnType<typeof fresh>>(key:K,value:ReturnType<typeof fresh>[K]){setForm(x=>({...x,[key]:value}));setPreview(false)}
 async function save(){setBusy(true);setError("");setNotice("");try{
 const saved=await rpc<{id:string}>("api_phase2_save_draft",{p_id:form.id,p_title:form.title_ar,p_body:form.body_ar,p_kind:form.kind,p_audience:form.audience,p_target_id:form.audience==="SCHOOL"?null:form.target_id||null,p_duration_days:form.duration_days});
 setNotice("حُفظت المسودة بنجاح. راجع المعاينة ثم اضغط نشر من قائمة المسودات.");setForm({...form,id:saved.id});setTick(x=>x+1);
 }catch(e){setError(niceError(e))}finally{setBusy(false)}}
 async function action(id:string,mode:"PUBLISH"|"ARCHIVE"){
 const item=data?.messages.find(m=>m.id===id);if(!item)return;
 if(mode==="PUBLISH"&&!window.confirm("تأكيد نشر «"+item.title_ar+"» إلى "+audienceLabel(item.audience)+" لمدة "+item.duration_days+" أيام؟"))return;
 if(mode==="ARCHIVE"&&!window.confirm("إيقاف عرض هذا الإشعار نهائيًا؟"))return;
 setBusy(true);setError("");setNotice("");
 try{await rpc("api_phase2_set_message_status",{p_id:id,p_action:mode});setNotice(mode==="PUBLISH"?"تم نشر الإشعار بنجاح. سيظهر فور تحديث بوابة الطالب وولي الأمر.":"تم إيقاف الإشعار.");if(form.id===id)setForm(fresh());setPreview(false);setTick(x=>x+1)}
 catch(e){setError(niceError(e))}finally{setBusy(false)}}
 return <main className="phase2-admin content" dir="rtl"><header className="p2-head"><div><small>بنك التميز الطلابي • الإدارة</small><h1>مركز الإشعارات والتهاني</h1><p>أنشئ مسودة، راجعها، ثم انشرها للفئة المحددة من مدرستك فقط.</p></div><button type="button" className="p2-btn secondary" onClick={()=>setTick(x=>x+1)}>تحديث القائمة</button></header>
 {loading&&<p>جارٍ تحميل مركز الإشعارات...</p>}{error&&<p className="p2-error" role="alert">{error}</p>}{notice&&<p className="p2-success" role="status">{notice}</p>}
 <section className="p2-card"><div className="p2-title"><h2>{form.id?"تعديل مسودة":"إنشاء إشعار جديد"}</h2><button type="button" className="p2-btn secondary" onClick={()=>{setForm(fresh());setPreview(false)}}>مسودة جديدة</button></div>
 <div className="p2-form-grid">
 <label>نوع الإشعار<select value={form.kind} onChange={e=>change("kind",e.target.value as Kind)}><option value="GENERAL">إعلان عام</option><option value="CONGRATULATION">تهنئة واحتفال</option><option value="ALERT">تنبيه مهم</option></select></label>
 <label>الفئة المستهدفة<select value={form.audience} onChange={e=>setForm(x=>({...x,audience:e.target.value as Audience,target_id:""}))}><option value="SCHOOL">المدرسة بالكامل</option><option value="CLASS">فصل محدد</option><option value="STUDENT">طالب محدد</option></select></label>
 {form.audience!=="SCHOOL"&&<label>{form.audience==="CLASS"?"اختر الفصل":"اختر الطالب"}<select value={form.target_id} onChange={e=>change("target_id",e.target.value)}><option value="">اختر...</option>{targets.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
 <label>مدة عرض الإشعار (أيام)<input type="number" min={1} max={30} value={form.duration_days} onChange={e=>change("duration_days",Number(e.target.value))}/></label></div>
 <label className="p2-wide">العنوان<input maxLength={120} value={form.title_ar} onChange={e=>change("title_ar",e.target.value)} placeholder="مثال: نبارك لكم الفوز في مسابقة رفق"/></label>
 <label className="p2-wide">نص الإشعار<textarea maxLength={1500} rows={5} value={form.body_ar} onChange={e=>change("body_ar",e.target.value)} placeholder="اكتب الرسالة التي ستصل للطالب وولي الأمر..."/></label>
 <div className="p2-actions"><button type="button" className="p2-btn secondary" onClick={()=>setPreview(x=>!x)}>معاينة قبل النشر</button><button type="button" className="p2-btn" disabled={busy||!form.title_ar.trim()||!form.body_ar.trim()||(form.audience!=="SCHOOL"&&!form.target_id)} onClick={()=>void save()}>{busy?"جارٍ الحفظ...":"حفظ المسودة"}</button></div>
 {preview&&<article className={"p2-preview "+form.kind.toLowerCase()}><small>{kindLabel(form.kind)} · {audienceLabel(form.audience)} · {form.duration_days} أيام</small><h3>{form.title_ar||"عنوان الإشعار"}</h3><p>{form.body_ar||"نص الإشعار"}</p><span>المعاينة فقط: لم يتم النشر بعد.</span></article>}
 </section>
 <section className="p2-card"><h2>إدارة الإشعارات</h2><p className="p2-muted">الإشعارات المنشورة تتوقف تلقائيًا عند انتهاء مدتها. يمكن إيقاف أي إشعار مبكرًا.</p><div className="p2-list">
 {(data?.messages||[]).map(m=><article key={m.id} className="p2-message"><div className="p2-message-top"><span className={"p2-status "+m.status.toLowerCase()}>{statusLabel(m.status)}</span><small>{kindLabel(m.kind)} · {audienceLabel(m.audience)} · {time(m.created_at)}</small></div><h3>{m.title_ar}</h3><p>{m.body_ar}</p><small>{m.status==="PUBLISHED"?"تاريخ النشر: "+time(m.published_at)+" · ينتهي: "+time(m.expires_at):"مدة العرض عند النشر: "+m.duration_days+" أيام"}</small>
 <div className="p2-actions">{m.status==="DRAFT"&&<><button type="button" className="p2-btn secondary" disabled={busy} onClick={()=>edit(m)}>تعديل</button><button type="button" className="p2-btn" disabled={busy} onClick={()=>void action(m.id,"PUBLISH")}>اعتماد ونشر</button></>}{m.status!=="ARCHIVED"&&<button type="button" className="p2-btn danger" disabled={busy} onClick={()=>void action(m.id,"ARCHIVE")}>إيقاف / أرشفة</button>}</div></article>)}
 {!data?.messages?.length&&<p className="p2-muted">لا توجد إشعارات مسجلة حتى الآن. أنشئ أول مسودة من النموذج أعلاه.</p>}</div></section>
 </main>;
}
