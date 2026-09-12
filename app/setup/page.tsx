"use client";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import Header from "@/components/Header";

export default function SetupPage(){
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);
  async function claim(){setLoading(true);setMessage("");const r=await fetch('/api/setup/claim-admin',{method:'POST'});const j=await r.json();setMessage(j.ok?'تم تفعيل حسابك كمدير النظام بنجاح.':j.error || 'تعذر التنفيذ');setLoading(false)}
  return <AppShell><Header title="تهيئة بنك التميز" subtitle="الخطوات الأولى قبل استيراد الطلاب وبدء إصدار الشيكات"/><main className="content">
    <section className="grid-3"><article className="stat-card"><span>قاعدة البيانات</span><strong>Neon PostgreSQL</strong><small>متصلة ومهيأة</small></article><article className="stat-card"><span>تسجيل الدخول</span><strong>Neon Auth</strong><small>مفعّل</small></article><article className="stat-card"><span>قيمة النقطة</span><strong>2 ريال</strong><small>قابلة للتعديل</small></article></section>
    <section className="panel"><div className="panel-head"><div><h3>1. تفعيل أول مدير للنظام</h3><p>يعمل الزر مرة واحدة فقط، ولأول حساب مسجل دخولًا.</p></div></div><button className="btn primary" disabled={loading} onClick={claim}>{loading?'جارٍ التفعيل...':'تفعيل حسابي كمدير النظام'}</button>{message&&<p className="form-note">{message}</p>}</section>
    <section className="panel"><h3>2. البيانات المطلوبة للبدء</h3><ul className="conditions"><li>الصفوف والفصول للمرحلتين المتوسطة والثانوية.</li><li>قائمة الطلاب: الرقم، الاسم، الصف، الفصل.</li><li>قائمة المعلمين وصلاحيات الإصدار.</li><li>يمكن لاحقًا استيراد كل ذلك من Excel دفعة واحدة.</li></ul></section>
  </main></AppShell>
}
