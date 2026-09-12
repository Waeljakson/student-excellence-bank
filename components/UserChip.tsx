"use client";
import { authClient } from "@/lib/auth/client";

export default function UserChip() {
  const session: any = authClient.useSession();
  const user = session?.data?.user;
  const label = user?.name || user?.email || "المستخدم";
  const initials = String(label).trim().split(/\s+/).slice(0,2).map((x:string)=>x[0]).join("") || "م";
  return <div className="user-chip"><span>{initials}</span><div><b>{label}</b><small>{user ? "مستخدم مسجل" : "غير مسجل"}</small></div></div>;
}
