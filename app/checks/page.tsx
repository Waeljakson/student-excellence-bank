import AppShell from "@/components/AppShell";
import Header from "@/components/Header";
import CheckIssuer from "@/components/CheckIssuer";
import { getPointRules, getSchool, getStudentsForIssuing } from "@/lib/data";
export const dynamic='force-dynamic';
export default async function ChecksPage(){const [rules,students,school]=await Promise.all([getPointRules(),getStudentsForIssuing(),getSchool()]);return <AppShell><Header title="شيكات التميز" subtitle="إصدار شيكات بنقاط موثقة وQR فريد"/><main className="content"><CheckIssuer rules={rules} students={students as any} pointValue={Number(school?.point_value_sar??2)}/></main></AppShell>}
