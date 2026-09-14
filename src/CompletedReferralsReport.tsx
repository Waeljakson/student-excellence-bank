type Referral={
  id:string;
  referral_no:string;
  student_no:string;
  student_name:string;
  grade_name:string;
  class_name:string;
  teacher_name:string;
  target_label:string;
  violation_category_label:string;
  occurrence_label:string;
  deducted_points:number;
  completion_note?:string|null;
  completed_by_name?:string|null;
  completed_at?:string|null;
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

  return <section className="panel referral-archive">
    <div className="panel-title"><div><h3>تقرير التحويلات المنتهية</h3><p>أرشيف رقمي للإجراءات التي تم إنهاؤها.</p></div><button className="btn ghost no-print" onClick={printReport}>طباعة التقرير</button></div>
    {completed.length?<div className="table-wrap"><table><thead><tr><th>رقم التحويل</th><th>الطالب</th><th>الفصل</th><th>المعلم</th><th>الجهة</th><th>المخالفة</th><th>الخصم</th><th>الإجراء النهائي</th><th>تاريخ الإنهاء</th></tr></thead><tbody>{completed.map(r=><tr key={r.id}><td><b>{r.referral_no}</b></td><td>{r.student_name}<small className="table-sub">{r.student_no}</small></td><td>{r.grade_name} / {r.class_name}</td><td>{r.teacher_name}</td><td>{r.target_label}</td><td>{r.violation_category_label} — {r.occurrence_label}</td><td>{r.deducted_points?`${r.deducted_points} نقطة`:"بدون خصم"}</td><td>{r.completion_note||"تم اللازم"}<small className="table-sub">{r.completed_by_name||"—"}</small></td><td>{fmt(r.completed_at)}</td></tr>)}</tbody></table></div>:<div className="empty">لا توجد تحويلات منتهية حتى الآن.</div>}
  </section>;
}
