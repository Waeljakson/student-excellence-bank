import AppShell from "@/components/AppShell";
import Header from "@/components/Header";

export default function KhameesnaPage() {
  return <AppShell><Header title="مسابقة خميسنا غير" subtitle="الفصل المتميز — رحلة ترفيهية يوم الخميس"/><main className="content">
    <section className="khameesna-hero"><div><span className="badge orange">جاهزة للتهيئة</span><h2>من سيحجز رحلة الخميس؟</h2><p>المسابقة مبنية داخل قاعدة البيانات. بعد تحديد تاريخ الدورة وإضافة الفصول سيُحسب ترتيب الفصول وفق متوسط النقاط ومعايير الانضباط والحضور.</p></div><div className="countdown"><span>حالة الدورة</span><strong>لم تبدأ</strong><small>يحددها مدير النظام</small></div></section>
    <section className="grid-3"><article className="stat-card"><span>الجائزة</span><strong>رحلة ترفيهية</strong><small>يوم الخميس للفصل الفائز</small></article><article className="stat-card"><span>طريقة المقارنة</span><strong>متوسط النقاط</strong><small>حتى لا يستفيد الفصل الأكبر عددًا</small></article><article className="stat-card"><span>اعتماد النتيجة</span><strong>إداري</strong><small>تُجمّد النتيجة بعد الاعتماد</small></article></section>
    <section className="grid-2"><article className="panel"><h3>أوزان التقييم الافتراضية</h3><div className="weights"><div><span>نقاط التميز</span><b>50%</b></div><div><span>الحضور</span><b>15%</b></div><div><span>عدم التأخر</span><b>10%</b></div><div><span>السلوك والانضباط</span><b>10%</b></div><div><span>النظافة والمحافظة</span><b>5%</b></div><div><span>الأنشطة</span><b>5%</b></div><div><span>المبادرات الجماعية</span><b>5%</b></div></div></article><article className="panel"><h3>شروط استحقاق الرحلة</h3><ul className="conditions"><li>الحضور لا يقل عن 95%.</li><li>عدم تجاوز الحد المعتمد للمخالفات الجسيمة.</li><li>احتساب متوسط نقاط الفصل وليس المجموع الخام فقط.</li><li>اعتماد النتيجة من المدير قبل الإعلان.</li><li>تجميد النتائج بعد الاعتماد للحفاظ على النزاهة.</li></ul></article></section>
    <section className="panel"><div className="empty-state"><b>لا توجد دورة نشطة حتى الآن</b><span>الخطوة التالية: إنشاء الدورة الأولى وربطها بالفصول بعد استيراد الهيكل الطلابي.</span></div></section>
  </main></AppShell>;
}
