import AppShell from "@/components/AppShell";
import Header from "@/components/Header";
import Link from "next/link";
import { getDashboardData } from "@/lib/data";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const data = await getDashboardData();
  const pointValue = Number(data.school.point_value_sar ?? 2);
  const statCards = [
    { label: "نقاط اليوم", value: data.stats.todayPoints.toLocaleString('ar-SA'), hint: "نقاط صادرة اليوم" },
    { label: "شيكات التميز", value: data.stats.monthChecks.toLocaleString('ar-SA'), hint: "هذا الشهر" },
    { label: "طلاب حصلوا على تعزيز", value: `${data.stats.reinforcedStudents} / ${data.stats.activeStudents}`, hint: "خلال الشهر الحالي" },
    { label: "قيمة النقاط المستبدلة", value: `${(data.stats.redeemedPoints * pointValue).toLocaleString('ar-SA')} ر.س`, hint: `${data.stats.redeemedPoints} نقطة` },
  ];
  return (
    <AppShell>
      <Header title="لوحة بنك التميز الطلابي" subtitle="بيانات حية من قاعدة بنك التميز" />
      <main className="content">
        <section className="hero">
          <div><span className="eyebrow">مدارس المشكاة الأهلية</span><h2>التميز يُرى، يُقاس، ويُكافأ.</h2><p>نظام موحد لإصدار شيكات التميز، إدارة محافظ الطلاب، المكافآت، التحديات ومسابقات الفصول.</p><div className="hero-actions"><Link className="btn primary" href="/checks">+ إصدار شيك تميز</Link><Link className="btn ghost" href="/competitions/khameesna">متابعة خميسنا غير</Link></div></div>
          <div className="hero-balance"><small>قيمة نقطة التميز</small><strong>{pointValue} ر.س</strong><span>الإعداد الحالي</span></div>
        </section>
        <section className="stats-grid">{statCards.map((s) => <article className="stat-card" key={s.label}><span>{s.label}</span><strong>{s.value}</strong><small>{s.hint}</small></article>)}</section>
        <section className="grid-2">
          <article className="panel"><div className="panel-head"><div><h3>آخر شيكات التميز</h3><p>أحدث عمليات التعزيز المسجلة</p></div><Link href="/checks">إصدار جديد</Link></div>{data.recentChecks.length ? <div className="activity-list">{data.recentChecks.map((c:any) => <div className="activity" key={c.id}><span className={`points ${Number(c.points) >= 40 ? "mega" : ""}`}>+{c.points}</span><div><b>{c.student_name}</b><span>{c.reason_ar} — {c.issuer_name}</span></div><small>{new Date(c.issued_at).toLocaleDateString('ar-SA')}</small></div>)}</div> : <div className="empty-state"><b>لا توجد شيكات بعد</b><span>بعد استيراد الطلاب يمكنك إصدار أول شيك تميز.</span></div>}</article>
          <article className="panel"><div className="panel-head"><div><h3>متصدرو التميز</h3><p>أعلى أرصدة الطلاب حاليًا</p></div><Link href="/students">الطلاب</Link></div>{data.topStudents.length ? <div className="rank-list">{data.topStudents.map((s:any, i:number) => <div className="rank-row" key={s.name}><span className="rank-num">{i + 1}</span><div><b>{s.name}</b><small>{s.class_name}</small></div><strong>{s.points} نقطة</strong></div>)}</div> : <div className="empty-state"><b>لم تُستورد بيانات الطلاب بعد</b><span>ابدأ من صفحة تهيئة النظام.</span><Link className="btn ghost" href="/setup">فتح التهيئة</Link></div>}</article>
        </section>
        <section className="panel khameesna-banner"><div><span className="badge">مسابقة الفصل المتميز</span><h3>خميسنا غير</h3><p>الفصل الأعلى تقييمًا وفق النقاط والحضور والانضباط يستحق رحلة ترفيهية يوم الخميس.</p></div><div className="winner-mini"><small>الجائزة</small><strong>رحلة ترفيهية</strong><span>يوم الخميس</span></div><Link className="btn light" href="/competitions/khameesna">فتح لوحة المسابقة</Link></section>
      </main>
    </AppShell>
  );
}
