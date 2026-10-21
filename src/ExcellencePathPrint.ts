// Isolated HTML print preview for Excellence Path.
// Printing the application's DOM is unreliable because global report and
// receipt styles hide other page sections with !important rules.
type PrintablePathRecord = {
  id:string; student_id:string; student_name:string; student_no:string;
  grade_name:string; class_name:string; subject:string; test_type:string;
  semester:number; period:number; max_score:number; before_score:number;
  after_score:number; difference:number; percentage_points:number;
  change_percent:number|null; status:string; note:string;
  teacher_name:string; updated_at:string;
};

type PrintOptions = {
  schoolName:string; academicYear:string; records:PrintablePathRecord[];
  subject:string; grade:string; status:string; query:string;
};

const kinds:Record<string,string>={
  PERIOD_TEST:"اختبار الفترة",SHORT_TEST:"اختبار قصير",
  DIAGNOSTIC:"اختبار تشخيصي",FINAL:"اختبار نهائي",OTHER:"اختبار آخر"
};
const states:Record<string,string>={
  POSITIVE:"تحسّن إيجابي",NEGATIVE:"تغيّر سلبي",STABLE:"ثابت"
};
const escapeHtml=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]||c));
const num=(n:number|null|undefined)=>n==null?"—":Number(n).toLocaleString("ar-SA",{maximumFractionDigits:2});
const signed=(n:number)=>((n>0)?"+":"")+num(n);
const cell=(content:string)=>"<td>"+content+"</td>";
const textCell=(value:unknown)=>cell(escapeHtml(value));
const date=(s:string)=>s?new Date(s).toLocaleDateString("ar-SA",{
  timeZone:"Asia/Riyadh",day:"numeric",month:"short",year:"numeric"
}):"—";

export function openExcellencePathPrintPreview(options:PrintOptions):boolean{
  // Open synchronously from a user click, before doing any expensive work,
  // to avoid popup blockers silently producing a blank print page.
  const popup=window.open("","_blank");
  if(!popup)return false;

  try{
    const rows=options.records.map((r,index)=>{
      const scorePair=escapeHtml(num(r.before_score))+" ← "+escapeHtml(num(r.after_score))+
        "<small>من "+escapeHtml(num(r.max_score))+"</small>";
      const difference=escapeHtml(signed(Number(r.difference)))+" درجة"+
        "<small>"+escapeHtml(signed(Number(r.percentage_points)))+" نقطة مئوية</small>"+
        "<small>"+(r.change_percent==null?"النسبي: غير محدد":
          "النسبي: "+escapeHtml(signed(Number(r.change_percent)))+"%")+"</small>";
      const student=escapeHtml(r.student_name)+
        "<small>"+escapeHtml(r.grade_name)+" / فصل "+escapeHtml(r.class_name)+"</small>"+
        "<small>الرقم: "+escapeHtml(r.student_no)+"</small>";
      const material=escapeHtml(r.subject)+"<small>"+escapeHtml(kinds[r.test_type]||"اختبار آخر")+"</small>";
      const duration="الفصل "+(r.semester===1?"الأول":"الثاني")+
        "<small>الفترة "+(r.period===1?"الأولى":"الثانية")+"</small>";
      const who=escapeHtml(r.teacher_name)+"<small>"+escapeHtml(date(r.updated_at))+"</small>";
      return "<tr>"+[
        textCell(index+1),cell(student),cell(material),cell(duration),
        cell(scorePair),cell(difference),textCell(states[r.status]||r.status),
        cell("<div class='intervention'>"+escapeHtml(r.note?.trim()||"لم يُسجل إجراء")+"</div>"),
        cell(who)
      ].join("")+"</tr>";
    }).join("");
    const studentCount=new Set(options.records.map(r=>r.student_id)).size;
    const positive=options.records.filter(r=>r.status==="POSITIVE").length;
    const negative=options.records.filter(r=>r.status==="NEGATIVE").length;
    const stable=options.records.filter(r=>r.status==="STABLE").length;
    const logo=(file:string)=>new URL(import.meta.env.BASE_URL+file,window.location.origin).href;
    const now=new Date().toLocaleString("ar-SA",{timeZone:"Asia/Riyadh",dateStyle:"medium",timeStyle:"short"});
    const info=(label:string,value:unknown)=>
      "<div class='meta'><small>"+escapeHtml(label)+"</small><b>"+escapeHtml(value)+"</b></div>";
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>تقرير طريق التفوق — ${escapeHtml(options.schoolName)}</title>
<style>
@page{size:A4 landscape;margin:10mm}
*{box-sizing:border-box}
html,body{padding:0;margin:0;color:#19384f;background:#fff;direction:rtl}
body{font:11px/1.7 Cairo,Tahoma,Arial,sans-serif}
.toolbar{position:sticky;top:0;z-index:9;background:#eaf3f9;border-bottom:1px solid #bed2e3;
  padding:12px 22px;display:flex;align-items:center;gap:10px}
.toolbar button{border:0;border-radius:8px;background:#185a83;color:#fff;cursor:pointer;
  padding:8px 19px;font:700 12px Cairo,Tahoma,Arial,sans-serif}
.toolbar button.secondary{background:#697d8a}
.toolbar span{margin-inline-start:auto;color:#587184;font-size:11px}
.document{max-width:1400px;padding:20px;margin:auto}
.heading{display:flex;gap:13px;align-items:center;border-bottom:2px solid #1e5881;padding-bottom:10px}
.heading img{height:55px;width:55px;object-fit:contain}
.heading>div{flex:1;text-align:center}
.heading h1{color:#134a70;font-size:20px;margin:2px}
.heading h2{color:#385d77;font-size:13px;margin:0}
.heading small{color:#6c8393}
.metadata{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;
  border:1px solid #d9e6ef;background:#f5f9fc;padding:9px;margin:12px 0}
.meta{min-width:0}.meta small{display:block;color:#627d8f;font-size:10px}
.meta b{display:block;overflow-wrap:anywhere;font-size:11px}
.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:10px 0}
.metrics>div{border:1px solid #dae6ee;border-radius:6px;padding:8px;background:#f8fbfd}
.metrics small{display:block;color:#56748a}
.metrics strong{font-size:17px;color:#165173}
h3{margin:13px 0 6px;color:#174866;font-size:14px}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th,td{border:1px solid #ccdae5;padding:6px 7px;text-align:right;vertical-align:top;
  white-space:normal;overflow-wrap:anywhere;line-height:1.65;font-size:10px}
th{background:#e6f0f7;color:#174867;font-weight:800}
td small{display:block;color:#587789;font-size:9px}
tbody tr:nth-child(even){background:#f8fbfe}
.intervention{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8}
thead{display:table-header-group}
tr{break-inside:avoid;page-break-inside:avoid}
.explanation{color:#678090;font-size:10px;margin:12px 0 0}
@media print{
  .toolbar{display:none!important}
  .document{max-width:none;padding:0;margin:0}
  body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
  th,td{font-size:9px;padding:5px}
  td small{font-size:8px}
  .metadata,.metrics{break-inside:avoid}
}
</style></head><body>
<div class="toolbar"><button type="button" onclick="window.print()">طباعة / حفظ PDF</button>
<button class="secondary" type="button" onclick="window.close()">إغلاق المعاينة</button>
<span>المعاينة مستقلة عن تنسيق التطبيق؛ استخدم الطباعة أو الحفظ PDF.</span></div>
<main class="document">
<header class="heading">
<img src="${escapeHtml(logo("school-logo.png"))}" alt="شعار المدرسة">
<div><h2>${escapeHtml(options.schoolName)}</h2><h1>تقرير طريق التفوق</h1>
<small>العام الدراسي ${escapeHtml(options.academicYear)} — بنك التميز الطلابي</small></div>
<img src="${escapeHtml(logo("guidance-logo.png"))}" alt="شعار التوجيه الطلابي">
</header>
<div class="metadata">
${info("المادة",options.subject)}
${info("الصف الدراسي",options.grade)}
${info("حالة التحسن",options.status)}
${info("البحث",options.query||"بدون")}
${info("تاريخ الإصدار",now)}
${info("عدد الطلاب",num(studentCount))}
${info("عدد القياسات",num(options.records.length))}
</div>
<div class="metrics">
<div><small>القياسات</small><strong>${escapeHtml(num(options.records.length))}</strong></div>
<div><small>الطلاب</small><strong>${escapeHtml(num(studentCount))}</strong></div>
<div><small>تحسّن إيجابي</small><strong>${escapeHtml(num(positive))}</strong></div>
<div><small>تغيّر سلبي</small><strong>${escapeHtml(num(negative))}</strong></div>
<div><small>ثابت</small><strong>${escapeHtml(num(stable))}</strong></div>
</div>
<h3>نتائج الطلاب والإجراءات المنفذة</h3>
<table><colgroup>
<col style="width:3%"><col style="width:16%"><col style="width:12%">
<col style="width:9%"><col style="width:10%"><col style="width:10%">
<col style="width:9%"><col style="width:22%"><col style="width:9%">
</colgroup>
<thead><tr><th>م</th><th>الطالب / الصف</th><th>المادة / الاختبار</th>
<th>الفصل / الفترة</th><th>قبل ← بعد</th><th>مقدار التغير</th><th>اتجاه الأداء</th>
<th>ما تم عمله مع الطالب</th><th>المعلم / التاريخ</th></tr></thead>
<tbody>${rows||"<tr><td colspan='9'>لا توجد قياسات مطابقة للتصفية المحددة.</td></tr>"}</tbody>
</table>
<p class="explanation">معدل التغير النسبي = (درجة بعد التحسين − درجة قبل التحسين) ÷ درجة قبل التحسين × 100؛
إذا كانت درجة البداية صفرًا تُعرض النقاط المئوية دون نسبة تغير نسبية.</p>
</main></body></html>`;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    return true;
  }catch(error){
    popup.close();
    throw error;
  }
}
