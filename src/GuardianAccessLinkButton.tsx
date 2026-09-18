import {useState} from "react";
import {niceError,rpc} from "./client";
import "./student-class-editor.css";

type StudentLite={id:string;name:string};
type LinkInfo={guardian_exists?:boolean;link_exists?:boolean;active?:boolean;token?:string|null;guardian_name?:string|null;children_count?:number};

function linkUrl(token:string){
  const base=new URL(import.meta.env.BASE_URL,window.location.origin);
  base.searchParams.set("guardian",token);
  return base.toString();
}

export default function GuardianAccessLinkButton({student}:{student:StudentLite}){
  const[open,setOpen]=useState(false);
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState("");
  const[info,setInfo]=useState<LinkInfo|null>(null);

  async function load(){
    setBusy(true);setMsg("");
    try{setInfo(await rpc<LinkInfo>("api_guardian_link_for_student",{p_student_id:student.id}))}
    catch(e){setMsg(niceError(e))}
    finally{setBusy(false)}
  }
  async function show(){setOpen(true);await load()}
  async function generate(){
    setBusy(true);setMsg("");
    try{
      const data=await rpc<LinkInfo>("api_regenerate_guardian_link",{p_student_id:student.id});
      setInfo({...data,guardian_exists:true,link_exists:true,active:true});
      setMsg("تم إنشاء رابط ولي الأمر. أي رابط سابق أصبح غير صالح.");
    }catch(e){setMsg(niceError(e))}finally{setBusy(false)}
  }
  async function disable(){
    setBusy(true);setMsg("");
    try{
      await rpc("api_disable_guardian_link",{p_student_id:student.id});
      setInfo(x=>x?{...x,active:false}:x);
      setMsg("تم إيقاف رابط ولي الأمر.");
    }catch(e){setMsg(niceError(e))}finally{setBusy(false)}
  }
  async function copy(){
    const token=info?.token;
    if(!token)return;
    try{await navigator.clipboard.writeText(linkUrl(token));setMsg("تم نسخ رابط ولي الأمر.")}
    catch{setMsg("تعذر النسخ التلقائي. حدّد الرابط وانسخه يدويًا.")}
  }

  const url=info?.token?linkUrl(info.token):"";
  return <>
    <button type="button" className="btn ghost" onClick={show}>رابط ولي الأمر</button>
    {open&&<div className="student-class-backdrop" onClick={()=>!busy&&setOpen(false)}>
      <div className="student-class-card" onClick={e=>e.stopPropagation()}>
        <button className="student-class-close" type="button" onClick={()=>setOpen(false)} disabled={busy}>×</button>
        <h3>رابط ولي الأمر</h3>
        <p><b>{student.name}</b></p>
        {busy&&!info?<p>جارٍ تحميل بيانات الرابط...</p>:<>
          {info?.guardian_exists&&<div className="notice">
            ولي الأمر: <b>{info.guardian_name||"مسجل"}</b>
            {Number(info.children_count||0)>1&&<> · الرابط يفتح <b>{info.children_count}</b> أبناء</>}
          </div>}
          {info?.link_exists&&info.token?<label>الرابط الخاص
            <textarea rows={4} readOnly value={url} onFocus={e=>e.currentTarget.select()}/>
          </label>:<p className="student-class-hint">لا يوجد رابط خاص حاليًا. عند إنشائه يستطيع ولي الأمر فتح البوابة مباشرة بدون كلمة مرور.</p>}
          {info?.link_exists&&<p className="student-class-hint">الحالة: <b>{info.active?"نشط":"موقوف"}</b>. إنشاء رابط جديد يلغي صلاحية الرابط السابق تلقائيًا.</p>}
        </>}
        {msg&&<div className="notice">{msg}</div>}
        <div className="student-class-actions">
          <button className="btn ghost" type="button" onClick={()=>setOpen(false)} disabled={busy}>إغلاق</button>
          {info?.active&&info.token&&<button className="btn ghost" type="button" onClick={copy} disabled={busy}>نسخ الرابط</button>}
          <button className="btn primary" type="button" onClick={generate} disabled={busy}>{info?.link_exists?"إنشاء رابط جديد":"إنشاء الرابط"}</button>
          {info?.active&&<button className="btn ghost" type="button" onClick={disable} disabled={busy}>إيقاف الرابط</button>}
        </div>
      </div>
    </div>}
  </>;
}
