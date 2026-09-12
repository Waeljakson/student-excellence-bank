import { AuthView } from '@neondatabase/auth-ui';
import { authViewPaths } from '@neondatabase/auth-ui/server';
import Image from 'next/image';

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  return (
    <main className="auth-screen">
      <section className="auth-brand-panel">
        <div className="auth-logos">
          <Image src="/school-logo.png" alt="مدارس المشكاة الأهلية" width={110} height={110} />
          <Image src="/guidance-logo.png" alt="التوجيه الطلابي" width={135} height={110} />
        </div>
        <span className="eyebrow">مدارس المشكاة الأهلية</span>
        <h1>بنك التميز الطلابي</h1>
        <p>منصة موحدة لشيكات التميز، محافظ النقاط، المكافآت ومسابقات الفصول.</p>
        <div className="auth-credit">برمجة وتنفيذ: محمد صلاح الدين محمد الجمل</div>
      </section>
      <section className="auth-form-panel"><AuthView path={path} /></section>
    </main>
  );
}
