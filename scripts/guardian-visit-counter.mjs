import {readFileSync,writeFileSync} from "node:fs";
const path="src/App.tsx";
let s=readFileSync(path,"utf8");
s=s.replace(
  'type Dashboard = { students: number; today_points: number; month_checks: number; reinforced_students: number; point_value_sar: number };',
  'type Dashboard = { students: number; today_points: number; month_checks: number; reinforced_students: number; point_value_sar: number; guardian_unique_visitors?:number; guardian_visits_today?:number; guardian_total_visits?:number; guardian_coverage_pct?:number };'
);
const current=s.match(/function DashboardView\([\s\S]*?\n\}/);
if(!current)throw new Error("guardian-visit-counter: DashboardView missing");
if(!current[0].includes("guardian_unique_visitors")){
  const replacement="function DashboardView({ data, checks, isSuperAdmin, onRefresh }: { data: Dashboard|null; checks: Check[]; isSuperAdmin:boolean; onRefresh:()=>void }) {\n  if(!data) return <Loading/>;\n  const guardianUnique=Number(data.guardian_unique_visitors||0);\n  const guardianToday=Number(data.guardian_visits_today||0);\n  const guardianTotal=Number(data.guardian_total_visits||0);\n  const guardianCoverage=Number(data.guardian_coverage_pct||0);\n  return <><Header title=\"لوحة بنك التميز الطلابي\" subtitle=\"بيانات مباشرة وآمنة من Neon\"/><main className=\"content\">\n    <section className=\"hero\"><div><span className=\"eyebrow\">مدارس المشكاة الأهلية</span><h2>التميز يُرى، يُقاس، ويُكافأ.</h2><p>شيكات تميز رقمية، محافظ طلابية، ترتيب فوري، ومتابعة عادلة للفصول.</p></div><div className=\"point-value\"><small>قيمة نقطة التميز</small><strong>{Number(data.point_value_sar).toLocaleString(\"ar-SA\")} ر.س</strong></div></section>\n    <section className=\"stats-grid\"><Stat label=\"الطلاب\" value={data.students}/><Stat label=\"نقاط اليوم\" value={data.today_points}/><Stat label=\"شيكات هذا الشهر\" value={data.month_checks}/><Stat label=\"طلاب حصلوا على تعزيز\" value={data.reinforced_students}/></section>\n    {isSuperAdmin&&<section className=\"panel guardian-visit-panel\">\n      <div className=\"panel-title\"><div><h3>متابعة أولياء الأمور</h3><p>قياس استخدام بوابة ولي الأمر منذ تفعيل العداد. العدد الأساسي يمثل أرقام الطلاب التي فُتحت بوابتهم بنجاح.</p></div><button className=\"mini-btn\" type=\"button\" onClick={onRefresh}>تحديث الآن</button></div>\n      <div className=\"guardian-visit-stats\">\n        <article><small>طلاب تم فتح بوابتهم</small><strong>{guardianUnique.toLocaleString(\"ar-SA\")}</strong><span>من أصل {Number(data.students).toLocaleString(\"ar-SA\")} طالب</span></article>\n        <article><small>نسبة الوصول</small><strong>{guardianCoverage.toLocaleString(\"ar-SA\")}%</strong><span>من إجمالي الطلاب</span></article>\n        <article><small>زيارات اليوم</small><strong>{guardianToday.toLocaleString(\"ar-SA\")}</strong><span>دخول ناجح اليوم</span></article>\n        <article><small>إجمالي الزيارات</small><strong>{guardianTotal.toLocaleString(\"ar-SA\")}</strong><span>مرات فتح البوابة</span></article>\n      </div>\n      <div className=\"guardian-coverage-track\"><span style={{width:`${Math.min(100,Math.max(0,guardianCoverage))}%`}}/></div>\n    </section>}\n    <section className=\"panel\"><div className=\"panel-title\"><div><h3>آخر شيكات التميز</h3><p>آخر العمليات المسجلة في البنك.</p></div></div>{checks.length?<div className=\"activity-list\">{checks.slice(0,8).map(c=><div className=\"activity\" key={c.id}><span className=\"points\">+{c.points}</span><div><b>{c.student_name}</b><small>{c.reason_ar || c.reason} — {c.issuer_name}</small></div><time>{new Date(c.issued_at).toLocaleDateString(\"ar-SA\")}</time></div>)}</div>:<Empty text=\"لم يتم إصدار شيكات حتى الآن.\"/>}</section>\n  </main></>;\n}";
  s=s.replace(current[0],replacement);
}
if(!s.includes('if(tab==="dashboard")void syncData(["dashboard","checks"],true);')){
  s=s.replace(
    'if(tab==="checks")void syncData(["students","rules","checks"]);',
    'if(tab==="dashboard")void syncData(["dashboard","checks"],true);\n    else if(tab==="checks")void syncData(["students","rules","checks"]);'
  );
}
s=s.replace(
  '{tab==="dashboard"&&<DashboardView data={dashboard} checks={checks}/>} ',
  '{tab==="dashboard"&&<DashboardView data={dashboard} checks={checks} isSuperAdmin={profile.roles?.includes("SUPER_ADMIN")===true} onRefresh={()=>void syncData(["dashboard"],true)}/>} '
);
if(!s.includes("guardian_unique_visitors")||!s.includes("متابعة أولياء الأمور")){
  throw new Error("guardian-visit-counter: dashboard counter missing after patch");
}
writeFileSync(path,s);
console.log("guardian-visit-counter: admin dashboard visit counter verified");
