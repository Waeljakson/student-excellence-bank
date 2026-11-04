import {useEffect,useState} from "react";
import {niceError,rpc} from "./client";
import {createReferralPdf} from "./referral-pdf";
import type {ReferralPdfData} from "./referral-pdf";
import "./referral-whatsapp.css";

type ReferralForShare=ReferralPdfData & {id:string};
type Contact={id:string;name:string;mobile:string;relationship:string;is_primary:boolean};
type ContactReply={school_name:string;student_name:string;guardians:Contact[]};
type Template="BRIEF"|"DETAILS";

function whatsappNumber(raw:string):string|null{
  const digits=String(raw||"").replace(/\D/g,"");
  // The platform's registered Saudi guardian numbers are 05xxxxxxxx.
  if(/^05\d{8}$/.test(digits))return "966"+digits.slice(1);
  if(/^5\d{8}$/.test(digits))return "966"+digits;
  if(/^9665\d{8}$/.test(digits))return digits;
  if(/^009665\d{8}$/.test(digits))return digits.slice(2);
  // Also support a verified guardian who registered an overseas mobile.
  if(/^00[1-9]\d{7,14}$/.test(digits))return digits.slice(2);
  if(/^[1-9]\d{9,14}$/.test(digits))return digits;
  return null;
}
function dateLabel(value:string){
  if(!value)return "—";
  const date=new Date(value+"T12:00:00");
  return Number.isNaN(date.getTime())?"—":date.toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"});
}
function referralMessage(r:ReferralForShare,schoolName:string,template:Template){
  const lines=[
    "ولي الأمر الكريم،",
    "السلام عليكم ورحمة الله وبركاته،",
    "",
    "لأننا نؤمن بقدرات ابنكم "+r.student_name+"، ونحرص على أن نراه دائمًا في أفضل مستوياته العلمية والسلوكية، نود إشعاركم بتحويل تربوي يخصه.",
    "",
    "نؤكد لكم أن الهدف من التحويل ليس العقاب أو اللوم، وإنما مدّ جسور التعاون بين البيت والمدرسة، والتعرف على احتياجات ابننا ومساندته بخطوات عملية تعزز ثقته بنفسه وتساعده على التقدم والنجاح.",
    "",
    "نؤمن أن تواصلنا معكم وتكامل دور الأسرة والمعلمين هو مفتاح التغيير الإيجابي، وأن كل طالب يستطيع التحسن والتميز عندما يجد من يقف بجانبه ويشجعه.",
    "",
    "بيانات المتابعة:",
    "اسم الطالب: "+r.student_name,
    "الصف: "+r.grade_name+" — الفصل: "+r.class_name,
    "رقم التحويل: "+r.referral_no,
    "جهة المتابعة: "+r.target_label,
    "حالة التحويل: "+(r.status==="COMPLETED"?"تم اتخاذ الإجراء":"قيد المتابعة")
  ];
  if(template==="DETAILS"){
    lines.push(
      "المادة: "+(r.subject_ar||"—"),
      "موضوع التحويل: "+(r.violation_text||"—")
    );
    const teacherActions=[r.teacher_action_1,r.teacher_action_2,r.teacher_action_3]
      .map(x=>String(x||"").trim()).filter(Boolean);
    if(teacherActions.length)lines.push("الإجراءات التربوية السابقة: "+teacherActions.join("، "));
    if(r.status==="COMPLETED"&&r.completion_note?.trim())
      lines.push("الإجراء النهائي: "+r.completion_note.trim());
  }
  lines.push(
    "",
    "نرجو منكم الاطلاع على نموذج التحويل المرفق بصيغة PDF، والتواصل مع المدرسة للتعاون على خطة متابعة تدعم ابنكم وتساعده على تجاوز أي صعوبات.",
    "",
    "يدًا بيد، نصنع لابننا فرصة جديدة للتقدم والتفوق بإذن الله.",
    "مع خالص تقديرنا لتعاونكم واهتمامكم.",
    "",
    schoolName
  );
  return lines.join("\n");
}

export default function ReferralWhatsAppShare({
  referral,onClose
}:{referral:ReferralForShare;onClose:()=>void}){
  const[reply,setReply]=useState<ContactReply|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[selected,setSelected]=useState("");
  const[template,setTemplate]=useState<Template>("BRIEF");
  const[message,setMessage]=useState("");
  const[status,setStatus]=useState("");
  const[pdf,setPdf]=useState<File|null>(null);
  const[pdfBusy,setPdfBusy]=useState(true);
  const[pdfError,setPdfError]=useState("");

  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");setReply(null);setSelected("");setStatus("");
    rpc<ContactReply>("api_referral_whatsapp_contacts",{p_referral_id:referral.id})
      .then(x=>{
        if(!active)return;
        setReply(x);
        const available=(x.guardians||[]).filter(g=>whatsappNumber(g.mobile));
        setSelected(available[0]?.id||"");
      })
      .catch(e=>{if(active)setError(niceError(e))})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[referral.id]);

  useEffect(()=>{
    if(reply)setMessage(referralMessage(referral,reply.school_name||"المدرسة",template));
  },[referral,reply,template]);

  // Pre-generate the actual PDF while the dialog is open. The native share
  // sheet must be called immediately from a user gesture, not after PDF work.
  useEffect(()=>{
    if(!reply)return;
    let active=true;setPdfBusy(true);setPdf(null);setPdfError("");
    void createReferralPdf(referral,reply.school_name||"المدرسة")
      .then(file=>{if(active)setPdf(file)})
      .catch(e=>{if(active)setPdfError(e instanceof Error?e.message:"تعذر تجهيز ملف PDF")})
      .finally(()=>{if(active)setPdfBusy(false)});
    return()=>{active=false};
  },[referral.id,reply?.school_name]);

  useEffect(()=>{
    const keyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};
    document.addEventListener("keydown",keyDown);
    return()=>document.removeEventListener("keydown",keyDown);
  },[onClose]);

  const contacts=(reply?.guardians||[]).map(c=>({...c,waNumber:whatsappNumber(c.mobile)}));
  const target=contacts.find(c=>c.id===selected&&c.waNumber);
  const whatsappHref=target?.waNumber&&message.trim()
    ?"https://wa.me/"+target.waNumber+"?text="+encodeURIComponent(message.trim()):"";

  function downloadPdf(){
    if(!pdf)return;
    const url=URL.createObjectURL(pdf);
    const link=document.createElement("a");
    link.href=url;link.download=pdf.name;
    document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    setStatus("تم تنزيل ملف التحويل. افتح واتساب وأرفق ملف PDF داخل المحادثة قبل الضغط على إرسال.");
  }
  function supportsFileShare(){
    try{return Boolean(pdf&&typeof navigator.share==="function"&&
      typeof navigator.canShare==="function"&&navigator.canShare({files:[pdf]}))}
    catch{return false}
  }
  function sharePdfAndMessage(){
    if(!pdf||!message.trim()||!supportsFileShare())return;
    // Native sharing lets the user choose WhatsApp and confirm the exact
    // guardian contact. It cannot force a target number or send unattended.
    void navigator.share({files:[pdf],title:"تحويل طالب — "+referral.referral_no,text:message.trim()})
      .then(()=>setStatus("تم تسليم الملف والرسالة لتطبيق المشاركة؛ تأكد من اختيار محادثة ولي الأمر الصحيحة وإتمام الإرسال."))
      .catch(e=>{if(e?.name!=="AbortError")
        setStatus("تعذرت مشاركة الملف من الجهاز؛ نزّل PDF واستخدم خيار فتح واتساب لإرفاقه يدويًا.")});
  }

  async function copyMessage(){
    if(!message.trim())return;
    try{await navigator.clipboard.writeText(message);setStatus("تم نسخ الرسالة. يمكنك لصقها في محادثة ولي الأمر.")}catch{
      setStatus("تعذر النسخ التلقائي؛ حدّد النص وانسخه من مربع الرسالة.");
    }
  }

  return <div className="ref-wa-backdrop no-print"
      onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="ref-wa-dialog" role="dialog" aria-modal="true" aria-labelledby="ref-wa-title" dir="rtl">
      <div className="ref-wa-head">
        <div><span>تحويل رقم {referral.referral_no}</span>
          <h2 id="ref-wa-title">إرسال التحويل لولي الأمر عبر واتساب</h2>
          <p>الطالب: {referral.student_name}</p>
        </div>
        <button type="button" className="btn ghost" onClick={onClose}>إغلاق ×</button>
      </div>
      {loading&&<p className="ref-wa-info" role="status">جارٍ جلب رقم ولي الأمر المسجل...</p>}
      {error&&<p className="ref-wa-error" role="alert">{error}</p>}
      {reply&&!loading&&<>
        {contacts.some(c=>c.waNumber)?<>
          <label className="ref-wa-label">اختر ولي الأمر المسجل
            <select value={selected} onChange={e=>{setSelected(e.target.value);setStatus("")}}>
              {contacts.filter(c=>c.waNumber).map(c=>
                <option key={c.id} value={c.id}>
                  {c.name}{c.is_primary?" — ولي الأمر الأساسي":""} ({c.mobile})
                </option>
              )}
            </select>
          </label>
          {contacts.some(c=>!c.waNumber)&&<p className="ref-wa-info">
            بعض أرقام أولياء الأمور غير صالحة لواتساب. راجع بيانات ولي الأمر في النظام.
          </p>}
          <div className="ref-wa-templates" role="group" aria-label="تفاصيل رسالة واتساب">
            <button type="button" className={template==="BRIEF"?"active":""}
              onClick={()=>setTemplate("BRIEF")}>رسالة مختصرة (موصى بها)</button>
            <button type="button" className={template==="DETAILS"?"active":""}
              onClick={()=>setTemplate("DETAILS")}>رسالة تتضمن تفاصيل التحويل</button>
          </div>
          <label className="ref-wa-label">معاينة الرسالة وتعديلها قبل الإرسال
            <textarea value={message} rows={13} maxLength={3500}
              onChange={e=>setMessage(e.target.value)}/>
          </label>
          {template==="DETAILS"&&<p className="ref-wa-warning">
            تحتوي هذه الصيغة على معلومات سلوكية أو تعليمية تخص الطالب؛ تأكد من صحة رقم ولي الأمر ومناسبة مشاركة التفاصيل.
          </p>}
          <div className="ref-wa-attachment">
            <strong>مرفق تحويل الطالب (PDF)</strong>
            <p>نسخة من نموذج التحويل كاملًا، تشمل بيانات الطالب وتفاصيل الواقعة والإجراءات التربوية، بتنسيق A4 وخط Cairo.</p>
            {pdfBusy&&<span role="status">جارٍ تجهيز ملف PDF...</span>}
            {pdfError&&<span className="ref-wa-error" role="alert">{pdfError}</span>}
            {pdf&&<span className="ref-wa-file-ready">الملف جاهز: {pdf.name} ({Math.max(1,Math.ceil(pdf.size/1024))} كيلوبايت)</span>}
          </div>
          {supportsFileShare()
            ?<div className="ref-wa-info">
              لن تُرسل الرسالة تلقائيًا. على الجوال، اضغط «مشاركة PDF والرسالة»، ثم اختر واتساب وحدد محادثة ولي الأمر المسجل وتأكد من ظهور المرفق والنص قبل الإرسال. قد لا تنقل بعض الأجهزة نص الرسالة مع الملف؛ يمكنك نسخه من الزر أدناه.
            </div>
            :<div className="ref-wa-info">
              لن تُرسل الرسالة تلقائيًا. لإرسال PDF عبر واتساب على هذا الجهاز: (1) نزّل الملف، (2) افتح محادثة ولي الأمر، (3) أرفق ملف PDF الذي نُزّل، ثم أرسل الرسالة والمرفق. روابط واتساب لا تدعم إرفاق ملف PDF تلقائيًا.
            </div>}
          <div className="ref-wa-actions">
            {supportsFileShare()&&<button className="btn primary ref-wa-send" type="button"
              disabled={!message.trim()||!target} onClick={sharePdfAndMessage}>
              مشاركة PDF والرسالة عبر واتساب
            </button>}
            <button className="btn ghost" type="button" onClick={downloadPdf}
              disabled={!pdf||pdfBusy}>تنزيل نموذج التحويل PDF</button>
            <button className="btn ghost" type="button" onClick={()=>void copyMessage()}
              disabled={!message.trim()}>نسخ الرسالة</button>
            {whatsappHref
              ?<a className="btn primary ref-wa-send" href={whatsappHref}
                target="_blank" rel="noopener noreferrer"
                onClick={()=>setStatus("تم فتح واتساب. لا تنسَ إرفاق ملف التحويل PDF قبل الإرسال، وتأكد من رقم ولي الأمر.")}>
                فتح محادثة ولي الأمر في واتساب
              </a>
              :<button className="btn primary" disabled>رقم أو رسالة غير صالحة</button>}
          </div>
          {status&&<p className="ref-wa-success" role="status">{status}</p>}
        </>:<p className="ref-wa-error" role="alert">
          لا يوجد رقم واتساب صالح مرتبط بولي أمر هذا الطالب. أضف الرقم الصحيح إلى بيانات ولي الأمر أولًا.
        </p>}
      </>}
    </section>
  </div>;
}
