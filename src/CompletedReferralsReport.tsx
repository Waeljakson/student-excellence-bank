type Referral={
  id:string;
  referral_no:string;
  student_no:string;
  student_name:string;
  grade_name:string;
  class_name:string;
  teacher_name:string;
  target_label:string;
  subject_ar?:string|null;
  incident_date?:string|null;
  violation_text?:string|null;
  violation_category_label:string;
  occurrence_label:string;
  violation_explanation?:string|null;
  teacher_action_1?:string|null;
  teacher_action_date_1?:string|null;
  teacher_action_2?:string|null;
  teacher_action_date_2?:string|null;
  teacher_action_3?:string|null;
  teacher_action_date_3?:string|null;
  deducted_points:number;
  deduction_note?:string|null;
  deducted_by_name?:string|null;
  deducted_at?:string|null;
  completion_note?:string|null;
  completed_by_name?:string|null;
  completed_at?:string|null;
  created_at?:string|null;
};

const fmt=(v?:string|null)=>v?new Date(v).toLocaleDateString("ar-SA",{year:"numeric",month:"short",day:"numeric"}):"—";
const esc=(v:unknown)=>String(v??"—").replace(/[&<>"']/g,(ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]||ch));

export default function CompletedReferralsReport({completed}:{completed:Referral[]}){
  function printReport(){
    const win=window.open("","_blank","width=1250,height=850");
    if(!win){window.alert("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.");return}
    const rows=completed.map(r=>`<tr>
      <td><b>${esc(r.referral_no)}</b></td>
      <td>${esc(r.student_name)}<small>${esc(r.student_no)}</small></td>
      <td>${esc(r.grade_name)} / ${esc(r.class_name)}</td>
      <td>${esc(r.teacher_name)}</td>
      <td>${esc(r.target_label)}</td>
      <td>${esc(r.violation_category_label)} — ${esc(r.occurrence_label)}</td>
      <td>${r.deducted_points?`${esc(r.deducted_points)} نقطة`:"بدون خصم"}</td>
      <td>${esc(r.completion_note||"تم اللازم")}<small>${esc(r.completed_by_name||"—")}</small></td>
      <td>${esc(fmt(r.completed_at))}</td>
    </tr>`).join("");
    win.document.open();
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير التحويلات المنتهية</title><style>
      @page{size:A4 landscape;margin:10mm}
      *{box-sizing:border-box}
      body{font-family:Cairo,Tahoma,Arial,sans-serif;color:#111;margin:0;background:#fff;direction:rtl}
      h1{font-size:22px;margin:0 0 5px;text-align:center;color:#0b3a65}
      .school{text-align:center;font-size:13px;font-weight:700;margin-bottom:4px}
      .meta{text-align:center;font-size:11px;color:#555;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9.5px}
      th,td{border:1px solid #777;padding:6px;vertical-align:top;text-align:right;word-break:break-word}
      th{background:#eef3f7;font-weight:800;color:#0b3a65;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      td small{display:block;margin-top:3px;color:#555;font-size:8.5px}
      tr{break-inside:avoid;page-break-inside:avoid}
      th:nth-child(1){width:9%} th:nth-child(2){width:13%} th:nth-child(3){width:10%} th:nth-child(4){width:12%} th:nth-child(5){width:10%} th:nth-child(6){width:12%} th:nth-child(7){width:8%} th:nth-child(8){width:17%} th:nth-child(9){width:9%}
      .footer{margin-top:10px;font-size:9px;color:#666;text-align:left}
    </style></head><body>
      <h1>تقرير التحويلات المنتهية</h1>
      <div class="school">متوسطة وثانوية مشكاة الشعلة</div>
      <div class="meta">عدد التحويلات المنتهية: ${completed.length}</div>
      <table><thead><tr><th>رقم التحويل</th><th>الطالب</th><th>الفصل</th><th>المعلم</th><th>الجهة</th><th>المخالفة</th><th>الخصم</th><th>الإجراء النهائي</th><th>تاريخ الإنهاء</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">تمت الطباعة من نظام بنك التميز الطلابي</div>
      <script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print();},250));<\/script>
    </body></html>`);
    win.document.close();
  }

  function printReferral(r:Referral){
    const win=window.open("","_blank","width=1000,height=900");
    if(!win){window.alert("تعذر فتح التحويل. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.");return}
    const actions=[
      [r.teacher_action_1,r.teacher_action_date_1],
      [r.teacher_action_2,r.teacher_action_date_2],
      [r.teacher_action_3,r.teacher_action_date_3],
    ].filter(([a])=>String(a||"").trim()).map(([a,d],i)=>`<tr><td>${i+1}</td><td>${esc(a)}</td><td>${esc(fmt(d))}</td></tr>`).join("");
    const deduction=r.deducted_points?`${esc(r.deducted_points)} نقطة`:"بدون خصم";
    win.document.open();
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تحويل الطالب ${esc(r.referral_no)}</title><style>
      @page{size:A4 portrait;margin:12mm}
      *{box-sizing:border-box}
      body{font-family:Cairo,Tahoma,Arial,sans-serif;color:#111;margin:0;background:#fff;direction:rtl;font-size:12px;line-height:1.7}
      .head{text-align:center;border-bottom:2px solid #0b3a65;padding-bottom:10px;margin-bottom:14px}
      .head h1{font-size:21px;color:#0b3a65;margin:0 0 2px}.head h2{font-size:14px;margin:0}.ref{margin-top:5px;font-weight:800}
      .section{margin:12px 0;break-inside:avoid}.section h3{background:#eef3f7;color:#0b3a65;margin:0;padding:7px 9px;border:1px solid #aab8c5;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .grid{display:grid;grid-template-columns:1fr 1fr;border-right:1px solid #aaa;border-top:1px solid #aaa}.cell{padding:7px 9px;border-left:1px solid #aaa;border-bottom:1px solid #aaa;min-height:48px}.cell.full{grid-column:1/-1}.label{display:block;color:#666;font-size:10px;margin-bottom:2px}.value{font-weight:700;white-space:pre-wrap}
      table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #aaa;padding:6px;text-align:right;vertical-align:top}th{background:#f4f6f8;color:#0b3a65;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .status{display:flex;gap:8px;justify-content:center;margin-top:10px}.badge{border:1px solid #0b3a65;border-radius:18px;padding:3px 10px;font-weight:700;color:#0b3a65}
      .footer{margin-top:18px;padding-top:8px;border-top:1px solid #bbb;font-size:9px;color:#666;text-align:center}
      @media print{.screen-only{display:none!important}}
      .screen-only{text-align:center;margin:12px 0 0}.screen-only button{font-family:inherit;background:#0b3a65;color:white;border:0;border-radius:8px;padding:9px 18px;cursor:pointer}
    </style></head><body>
      <div class="head"><h1>تحويل طالب</h1><h2>متوسطة وثانوية مشكاة الشعلة</h2><div class="ref">رقم التحويل: ${esc(r.referral_no)}</div></div>
      <div class="section"><h3>بيانات التحويل الأصلي</h3><div class="grid">
        <div class="cell"><span class="label">اسم الطالب</span><span class="value">${esc(r.student_name)}</span></div>
        <div class="cell"><span class="label">رقم الطالب</span><span class="value">${esc(r.student_no)}</span></div>
        <div class="cell"><span class="label">الصف / الفصل</span><span class="value">${esc(r.grade_name)} / ${esc(r.class_name)}</span></div>
        <div class="cell"><span class="label">المعلم المحوِّل</span><span class="value">${esc(r.teacher_name)}</span></div>
        <div class="cell"><span class="label">المادة</span><span class="value">${esc(r.subject_ar)}</span></div>
        <div class="cell"><span class="label">تاريخ الواقعة</span><span class="value">${esc(fmt(r.incident_date))}</span></div>
        <div class="cell"><span class="label">جهة التحويل</span><span class="value">${esc(r.target_label)}</span></div>
        <div class="cell"><span class="label">التصنيف / التكرار</span><span class="value">${esc(r.violation_category_label)} — ${esc(r.occurrence_label)}</span></div>
        <div class="cell full"><span class="label">نوع المخالفة التي كتبها المعلم</span><span class="value">${esc(r.violation_text)}</span></div>
        <div class="cell full"><span class="label">تفسير المخالفة</span><span class="value">${esc(r.violation_explanation)}</span></div>
      </div></div>
      <div class="section"><h3>الإجراءات التي اتخذها المعلم قبل التحويل</h3>${actions?`<table><thead><tr><th style="width:8%">#</th><th>الإجراء</th><th style="width:24%">التاريخ</th></tr></thead><tbody>${actions}</tbody></table>`:`<div class="grid"><div class="cell full"><span class="value">لا توجد إجراءات مسجلة.</span></div></div>`}</div>
      <div class="section"><h3>الإجراء بعد التحويل</h3><div class="grid">
        <div class="cell"><span class="label">الخصم</span><span class="value">${deduction}</span></div>
        <div class="cell"><span class="label">تم الخصم بواسطة</span><span class="value">${esc(r.deducted_by_name||"—")}</span></div>
        <div class="cell full"><span class="label">ملاحظة الخصم</span><span class="value">${esc(r.deduction_note||"—")}</span></div>
        <div class="cell full"><span class="label">الإجراء النهائي / ملاحظة الإنهاء</span><span class="value">${esc(r.completion_note||"تم اللازم")}</span></div>
        <div class="cell"><span class="label">أنهى التحويل</span><span class="value">${esc(r.completed_by_name||"—")}</span></div>
        <div class="cell"><span class="label">تاريخ الإنهاء</span><span class="value">${esc(fmt(r.completed_at))}</span></div>
      </div></div>
      <div class="status"><span class="badge">تحويل منتهٍ</span></div>
      <div class="screen-only"><button onclick="window.print()">طباعة التحويل</button></div>
      <div class="footer">نسخة إلكترونية محفوظة في نظام بنك التميز الطلابي — بيانات التحويل الأصلية والإجراء النهائي</div>
    </body></html>`);
    win.document.close();
  }

  return <section className="panel referral-archive">
    <div className="panel-title"><div><h3>تقرير التحويلات المنتهية</h3><p>أرشيف رقمي للإجراءات التي تم إنهاؤها. يمكنك فتح وطباعة كل تحويل كاملًا كما كتبه المعلم.</p></div><button className="btn ghost no-print" onClick={printReport}>طباعة التقرير</button></div>
    {completed.length?<div className="table-wrap"><table><thead><tr><th>رقم التحويل</th><th>الطالب</th><th>الفصل</th><th>المعلم</th><th>الجهة</th><th>المخالفة</th><th>الخصم</th><th>الإجراء النهائي</th><th>تاريخ الإنهاء</th><th>التحويل</th></tr></thead><tbody>{completed.map(r=><tr key={r.id}><td><b>{r.referral_no}</b></td><td>{r.student_name}<small className="table-sub">{r.student_no}</small></td><td>{r.grade_name} / {r.class_name}</td><td>{r.teacher_name}</td><td>{r.target_label}</td><td>{r.violation_category_label} — {r.occurrence_label}</td><td>{r.deducted_points?`${r.deducted_points} نقطة`:"بدون خصم"}</td><td>{r.completion_note||"تم اللازم"}<small className="table-sub">{r.completed_by_name||"—"}</small></td><td>{fmt(r.completed_at)}</td><td><button type="button" className="btn ghost no-print" onClick={()=>printReferral(r)}>عرض / طباعة</button></td></tr>)}</tbody></table></div>:<div className="empty">لا توجد تحويلات منتهية حتى الآن.</div>}
  </section>;
}
