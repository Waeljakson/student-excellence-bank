import { useMemo, useState } from "react";
import { niceError, rpc } from "./client";
import "./reward-admin.css";

type UserRow={id:string;name:string;email:string;job_title_ar?:string|null;roles:string[]};

export default function RewardPermissionPanel({users,reload}:{users:UserRow[];reload:()=>Promise<void>}){
  const[q,setQ]=useState("");const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");
  const rows=useMemo(()=>users.filter(u=>`${u.name} ${u.email} ${u.job_title_ar||""}`.toLowerCase().includes(q.trim().toLowerCase())),[users,q]);
  async function toggle(u:UserRow){const enabled=!u.roles?.includes("REWARD_OFFICER");setBusy(u.id);setMsg("");try{await rpc("api_set_reward_officer",{p_app_user_id:u.id,p_enabled:enabled});setMsg(enabled?`تم منح ${u.name} صلاحية إدارة متجر المكافآت.`:`تم سحب صلاحية إدارة متجر المكافآت من ${u.name}.`);await reload()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  return <section className="panel reward-permission-panel">
    <div className="panel-title"><div><h3>صلاحية إدارة متجر المكافآت</h3><p>امنح أي موظف صلاحية إضافة الهدايا وتعديلها وحذفها وإدارة المخزون، دون منحه باقي صلاحيات الإدارة.</p></div><span className="counter">{users.filter(u=>u.roles?.includes("REWARD_OFFICER")).length}</span></div>
    <input className="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث باسم الموظف أو البريد أو الوظيفة..."/>
    <div className="reward-permission-list">{rows.map(u=>{const enabled=u.roles?.includes("REWARD_OFFICER");return <div className={enabled?"reward-permission-row enabled":"reward-permission-row"} key={u.id}><div><b>{u.name}</b><small>{u.job_title_ar||"بدون مسمى وظيفي"} · {u.email}</small></div><span>{enabled?"مسؤول مكافآت":"بدون صلاحية المتجر"}</span><button className={enabled?"mini-btn danger":"mini-btn"} disabled={busy===u.id} onClick={()=>toggle(u)}>{busy===u.id?"جارٍ الحفظ...":enabled?"سحب الصلاحية":"منح الصلاحية"}</button></div>})}</div>
    {msg&&<div className="notice compact-notice">{msg}</div>}
  </section>;
}
