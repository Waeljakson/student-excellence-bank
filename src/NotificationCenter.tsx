import { useEffect, useMemo, useState } from "react";
import { niceError, rpc } from "./client";
import "./notifications.css";

type AppNotification={
  id:string;
  title_ar:string;
  body_ar:string;
  type:string;
  read_at?:string|null;
  created_at:string;
};

const fmt=(v:string)=>new Date(v).toLocaleString("ar-SA",{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});

export default function NotificationCenter(){
  const[items,setItems]=useState<AppNotification[]>([]);
  const[open,setOpen]=useState(false);
  const[error,setError]=useState("");
  const[busy,setBusy]=useState("");

  async function load(){
    try{
      const rows=await rpc<AppNotification[]>("api_my_notifications",{p_unread_only:false,p_limit:20});
      setItems(Array.isArray(rows)?rows:[]);
      setError("");
    }catch(e){setError(niceError(e))}
  }

  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),45000);
    const onFocus=()=>void load();
    const onVisible=()=>{if(document.visibilityState==="visible")void load()};
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onVisible)};
  },[]);

  const unread=useMemo(()=>items.filter(x=>!x.read_at),[items]);

  async function markRead(id:string){
    setBusy(id);
    try{
      await rpc("api_mark_notification_read",{p_notification_id:id});
      setItems(v=>v.map(x=>x.id===id?{...x,read_at:new Date().toISOString()}:x));
    }catch(e){setError(niceError(e))}finally{setBusy("")}
  }

  return <div className="notification-center no-print">
    <button type="button" className={`notification-bell ${unread.length?"has-unread":""}`} onClick={()=>setOpen(v=>!v)} aria-label="الإشعارات">
      <span>🔔</span>{unread.length>0&&<b>{unread.length>99?"99+":unread.length}</b>}
    </button>
    {open&&<div className="notification-panel">
      <div className="notification-head"><div><h3>الإشعارات</h3><small>{unread.length?`${unread.length} غير مقروء`:"لا توجد إشعارات جديدة"}</small></div><button type="button" onClick={()=>setOpen(false)}>×</button></div>
      {error&&<div className="notification-error">{error}</div>}
      <div className="notification-list">
        {items.length?items.map(n=><article key={n.id} className={n.read_at?"read":"unread"}>
          <div className="notification-dot"/>
          <div className="notification-copy"><b>{n.title_ar}</b><p>{n.body_ar}</p><small>{fmt(n.created_at)}</small></div>
          {!n.read_at&&<button type="button" disabled={busy===n.id} onClick={()=>markRead(n.id)}>{busy===n.id?"...":"تم الاطلاع"}</button>}
        </article>):<div className="notification-empty">لا توجد إشعارات حتى الآن.</div>}
      </div>
    </div>}
  </div>;
}
