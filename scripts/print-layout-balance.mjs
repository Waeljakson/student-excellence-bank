import {readFileSync,writeFileSync} from "node:fs";

let periodic=readFileSync("src/PeriodicEvaluationCenter.tsx","utf8");

if(!periodic.includes("function printTeacherProgress()")){
  periodic=periodic.replace(
`  async function saveStudent(student:S){`,
`  function printTeacherProgress(){
    if(!active)return;
    const win=window.open("","_blank","width=1200,height=850");
    if(!win){window.alert("اسمح بالنوافذ المنبثقة ثم أعد المحاولة.");return}
    const esc=(v:unknown)=>String(v??"—").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]||ch));
    const status=(s:string)=>s==="COMPLETED"?"مكتمل":s==="NOT_STARTED"?"لم يبدأ":"تحت التنفيذ";
    const rows=teacherProgress.map((t,i)=>\`<tr><td>\${i+1}</td><td class="teacher"><b>\${esc(t.teacher_name)}</b></td><td>\${esc(t.subject_ar||"—")}</td><td>\${t.class_count}</td><td>\${t.expected_count}</td><td>\${t.completed_count}</td><td class="remaining">\${t.remaining_count}</td><td><b>\${Number(t.progress_percent||0)}%</b></td><td><span class="status \${t.status.toLowerCase().replace("_","-")}">\${status(t.status)}</span></td><td>\${t.last_evaluation_at?new Date(t.last_evaluation_at).toLocaleString("ar-SA"):"—"}</td></tr>\`).join("");
    const now=new Date().toLocaleString("ar-SA");
    win.document.open();
    win.document.write(\`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>إنجاز المعلمين - \${esc(active.title_ar)}</title><style>
@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Cairo,Tahoma,Arial,sans-serif;margin:0;color:#172033;direction:rtl;font-size:10.5px}h1{text-align:center;font-size:22px;margin:0;color:#123d67}.school{text-align:center;font-weight:800;margin:3px 0 4px}.subtitle{text-align:center;color:#5b6574;margin-bottom:10px}.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:10px 0}.summary div{border:1px solid #bac6d2;border-radius:8px;padding:7px;text-align:center;background:#f7f9fb;-webkit-print-color-adjust:exact;print-color-adjust:exact}.summary small{display:block;color:#667085;margin-bottom:2px}.summary b{font-size:16px;color:#10395f}.cycle{display:flex;justify-content:space-between;gap:12px;border:1px solid #c5ced8;padding:7px 10px;border-radius:8px;margin-bottom:9px}.cycle b{color:#10395f}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th,td{border:1px solid #9aa7b4;padding:5px 4px;text-align:center;vertical-align:middle;overflow-wrap:anywhere}th{background:#eaf0f6;color:#123d67;font-weight:800;-webkit-print-color-adjust:exact;print-color-adjust:exact}th:nth-child(1){width:4%}th:nth-child(2){width:18%}th:nth-child(3){width:12%}th:nth-child(4){width:7%}th:nth-child(5),th:nth-child(6),th:nth-child(7){width:8%}th:nth-child(8){width:8%}th:nth-child(9){width:11%}th:nth-child(10){width:16%}.teacher{text-align:right}.remaining{font-weight:800}.status{display:inline-block;padding:2px 7px;border-radius:999px;font-weight:800}.status.completed{background:#e9f7ef;color:#16733d}.status.in-progress{background:#fff5df;color:#9a6200}.status.not-started{background:#fdeaea;color:#a52b2b}.footer{display:flex;justify-content:space-between;margin-top:8px;color:#697386;font-size:9px}.screen{text-align:left;margin:8px 0}.screen button{padding:7px 15px;font-family:inherit}@media print{.screen{display:none}tr{break-inside:avoid}}
</style></head><body><h1>تقرير إنجاز المعلمين في التقييم الدوري</h1><div class="school">متوسطة وثانوية مشكاة الشعلة</div><div class="subtitle">متابعة استكمال تقييم الطلاب حسب تكليفات المعلمين</div><div class="cycle"><span><b>الدورة:</b> \${esc(active.title_ar)}</span><span><b>الموعد النهائي:</b> \${new Date(active.due_at).toLocaleString("ar-SA")}</span></div><div class="summary"><div><small>إجمالي المعلمين</small><b>\${teacherProgress.length}</b></div><div><small>مكتمل</small><b>\${teachersCompleted}</b></div><div><small>تحت التنفيذ</small><b>\${teachersInProgress}</b></div><div><small>لم يبدأ</small><b>\${teachersNotStarted}</b></div><div><small>التقييمات المتبقية</small><b>\${teacherRemainingTotal}</b></div></div><table><thead><tr><th>م</th><th>المعلم</th><th>المادة</th><th>الفصول</th><th>المطلوب</th><th>تم</th><th>المتبقي</th><th>الإنجاز</th><th>الحالة</th><th>آخر تقييم</th></tr></thead><tbody>\${rows||'<tr><td colspan="10">لا توجد بيانات إنجاز لهذه الدورة.</td></tr>'}</tbody></table><div class="footer"><span>طُبع من بنك التميز الطلابي</span><span>\${now}</span></div><div class="screen"><button onclick="window.print()">طباعة</button></div></body></html>\`);
    win.document.close();
  }

  async function saveStudent(student:S){`
  );
}

periodic=periodic.replace(
`<div className="panel-title"><div><h3>متابعة إنجاز المعلمين</h3><p>متابعة مباشرة لعدد الطلاب الذين قيّمهم كل معلم والمتبقي عليه في الدورة الحالية.</p></div><button className="mini-btn" type="button" onClick={()=>load()}>تحديث الآن</button></div>`,
`<div className="panel-title"><div><h3>متابعة إنجاز المعلمين</h3><p>متابعة مباشرة لعدد الطلاب الذين قيّمهم كل معلم والمتبقي عليه في الدورة الحالية.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="mini-btn" type="button" onClick={printTeacherProgress}>طباعة إنجاز المعلمين</button><button className="mini-btn" type="button" onClick={()=>load()}>تحديث الآن</button></div></div>`
);
writeFileSync("src/PeriodicEvaluationCenter.tsx",periodic);

let reports=readFileSync("src/StudentEvaluationReports.tsx","utf8");
if(!reports.includes("PRINT_BALANCE_V2")){
  const replacement=`  // PRINT_BALANCE_V2
  function printReport(report: ReportDetail) {
    const win = window.open("", "_blank", "width=1150,height=850");
    if (!win) {
      window.alert("اسمح بالنوافذ المنبثقة ثم أعد المحاولة.");
      return;
    }

    const noteLengths=report.responses.map(r=>(r.notes||"").trim().length);
    const maxNote=Math.max(0,...noteLengths);
    const totalNote=noteLengths.reduce((a,b)=>a+b,0);
    const density=maxNote>700||totalNote>1800?"dense-3":maxNote>400||totalNote>1100?"dense-2":maxNote>220||totalNote>650?"dense-1":"normal";
    const noteHtml=(text?:string|null)=>esc(text||"—").replace(/\\n/g,"<br>");
    const rows = report.responses
      .map((r,index) => {
        const len=(r.notes||"").length;
        const noteClass=len>600?"note very-long":len>300?"note long":"note";
        return \`<tr>
          <td class="seq">\${index+1}</td>
          <td class="subject">\${esc(subjectLabel(r.subject_ar))}</td>
          <td class="rating">\${esc(ratingLabel(r.academic_rating))}</td>
          <td class="rating">\${esc(ratingLabel(r.behavior_rating))}</td>
          <td class="\${noteClass}"><div>\${noteHtml(r.notes)}</div></td>
          <td class="teacher">\${esc(r.teacher_name)}</td>
        </tr>\`;
      })
      .join("");

    const guidance=(report.guidance_opinion||"—").length;
    const vice=(report.vice_principal_opinion||"—").length;
    const opinionClass=Math.max(guidance,vice)>500?"opinions compact":Math.max(guidance,vice)>260?"opinions medium":"opinions";

    win.document.open();
    win.document.write(\`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>\${esc(report.report_no)}</title>
<style>
@page{size:A4 landscape;margin:10mm}
*{box-sizing:border-box}
body{font-family:Cairo,Tahoma,Arial,sans-serif;margin:0;color:#172033;direction:rtl;font-size:10.7px;line-height:1.45}
h1{text-align:center;font-size:22px;margin:0 0 2px;color:#0b3a65}.school{text-align:center;font-weight:800;margin-bottom:9px}.subtitle{text-align:center;color:#647082;font-size:9.5px;margin-top:-6px;margin-bottom:9px}
.info{display:grid;grid-template-columns:2.2fr 1fr 1fr 1.25fr;border:1px solid #8c99a6;border-radius:7px;overflow:hidden;margin-bottom:9px}.info div{padding:6px 8px;border-left:1px solid #aeb7c0}.info div:last-child{border-left:0}.label{font-size:8.5px;color:#697386;display:block}.value{font-weight:800;margin-top:2px;color:#182c3f}
table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px}thead{display:table-header-group}th,td{border:1px solid #8f9ba7;padding:5px 5px;text-align:right;vertical-align:top;overflow-wrap:anywhere;word-break:normal}th{background:#eaf0f5;color:#0b3a65;font-weight:800;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}.seq{width:4%;text-align:center}.subject{width:13%;font-weight:700}.rating{width:10%;text-align:center}.note{width:42%;white-space:normal}.note div{white-space:normal;line-height:1.5}.note.long{font-size:9.2px}.note.very-long{font-size:8.5px;line-height:1.35}.teacher{width:21%;font-weight:700}
.opinions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.op{border:1px solid #8f9ba7;border-radius:7px;padding:7px 9px;min-height:65px;white-space:normal;overflow-wrap:anywhere}.op b{display:block;color:#0b3a65;margin-bottom:4px}.opinions.medium .op{font-size:9.4px;line-height:1.4}.opinions.compact .op{font-size:8.6px;line-height:1.3;min-height:55px}
.meta{font-size:8.5px;color:#697386;margin-top:7px;display:flex;justify-content:space-between;gap:10px}.screen{margin:8px 0;text-align:left}.screen button{padding:7px 16px;font-family:inherit}
body.dense-1{font-size:10px}body.dense-1 table{font-size:9.5px}body.dense-2{font-size:9.5px}body.dense-2 table{font-size:9px}body.dense-2 th,body.dense-2 td{padding:4px}body.dense-3{font-size:9px}body.dense-3 table{font-size:8.4px}body.dense-3 th,body.dense-3 td{padding:3.5px}.dense-3 .info div{padding:5px 6px}.dense-3 .op{min-height:50px;padding:5px 7px}
@media print{.screen{display:none}thead{display:table-header-group}tr{break-inside:auto}.opinions{break-inside:avoid}.info{break-inside:avoid}}
</style>
</head>
<body class="\${density}">
<h1>تقرير عن المستوى السلوكي والتحصيلي</h1>
<div class="school">متوسطة وثانوية مشكاة الشعلة</div>
<div class="subtitle">تقرير مجمع لتقييم معلمي الطالب</div>
<div class="info">
  <div><span class="label">الطالب</span><div class="value">\${esc(report.student_name)} — \${esc(report.student_no)}</div></div>
  <div><span class="label">الصف</span><div class="value">\${esc(report.grade_name)}</div></div>
  <div><span class="label">الفصل</span><div class="value">\${esc(report.class_name)}</div></div>
  <div><span class="label">رقم التقرير / التاريخ</span><div class="value">\${esc(report.report_no)}<br>\${esc(fmt(report.requested_at))}</div></div>
</div>
<table><colgroup><col style="width:4%"><col style="width:13%"><col style="width:10%"><col style="width:10%"><col style="width:42%"><col style="width:21%"></colgroup><thead><tr><th>م</th><th>المادة</th><th>تحصيليًا</th><th>سلوكيًا</th><th>ملاحظات المعلم</th><th>اسم المعلم</th></tr></thead><tbody>\${rows}</tbody></table>
<div class="\${opinionClass}">
  <div class="op"><b>رأي الموجه الطلابي:</b>\${noteHtml(report.guidance_opinion)}</div>
  <div class="op"><b>رأي وكيل المدرسة:</b>\${noteHtml(report.vice_principal_opinion)}</div>
</div>
<div class="meta"><span>حالة التقرير: \${esc(statusLabel(report.status))}</span><span>تم حفظ التقرير إلكترونيًا في نظام بنك التميز الطلابي</span></div>
<div class="screen"><button onclick="window.print()">طباعة التقرير</button></div>
</body>
</html>\`);
    win.document.close();
  }

  return (`;
  const pattern=/  function printReport\(report: ReportDetail\) \{[\s\S]*?\n  \}\n\n  return \(/;
  if(!pattern.test(reports))throw new Error("Student evaluation print function pattern not found");
  reports=reports.replace(pattern,replacement);
}
writeFileSync("src/StudentEvaluationReports.tsx",reports);
