import { FormEvent, useEffect, useMemo, useState } from "react";
import { niceError, rpc } from "./client";
import "./reward-admin.css";

type RewardRow={id:string;name_ar:string;description_ar?:string|null;cost_points:number;stock?:number|null;image_url?:string|null;is_active:boolean;reserved_stock:number;redemption_count:number};

type Draft={id?:string;name_ar:string;description_ar:string;cost_points:string;stock:string;unlimited:boolean;is_active:boolean};
const emptyDraft:Draft={name_ar:"",description_ar:"",cost_points:"50",stock:"10",unlimited:false,is_active:true};

export default function RewardManagementPanel({onChanged}:{onChanged?:()=>Promise<void>}){
  const[rows,setRows]=useState<RewardRow[]>([]);const[draft,setDraft]=useState<Draft>(emptyDraft);const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");const[q,setQ]=useState("");
  async function load(){try{setRows(await rpc<RewardRow[]>("api_reward_admin_list"))}catch(e){setMsg(niceError(e))}}
  useEffect(()=>{load()},[]);
  const filtered=useMemo(()=>rows.filter(r=>`${r.name_ar} ${r.description_ar||""}`.includes(q.trim())),[rows,q]);
  function edit(r:RewardRow){setDraft({id:r.id,name_ar:r.name_ar,description_ar:r.description_ar||"",cost_points:String(r.cost_points),stock:r.stock==null?"":String(r.stock),unlimited:r.stock==null,is_active:r.is_active});setMsg("");window.setTimeout(()=>document.querySelector<HTMLElement>(".reward-editor")?.scrollIntoView({behavior:"smooth",block:"start"}),0)}
  function reset(){setDraft(emptyDraft);setMsg("")}
  async function save(e:FormEvent){e.preventDefault();const points=Math.floor(Number(draft.cost_points));const stock=draft.unlimited?null:Math.floor(Number(draft.stock));if(!draft.name_ar.trim()){setMsg("اكتب اسم الهدية.");return}if(!Number.isFinite(points)||points<1){setMsg("تكلفة الهدية بالنقاط غير صحيحة.");return}if(!draft.unlimited&&(!Number.isFinite(stock)||Number(stock)<0)){setMsg("المخزون يجب أن يكون صفرًا أو أكثر.");return}setBusy("save");setMsg("");try{await rpc("api_save_reward",{p_reward_id:draft.id||null,p_name_ar:draft.name_ar.trim(),p_description_ar:draft.description_ar.trim()||null,p_cost_points:points,p_stock:draft.unlimited?null:stock,p_is_active:draft.is_active});setMsg(draft.id?"تم تعديل الهدية وتحديث المتجر.":"تمت إضافة الهدية إلى متجر المكافآت.");reset();await load();await onChanged?.()}catch(err){setMsg(niceError(err))}finally{setBusy("")}}
  async function remove(r:RewardRow){if(!window.confirm(`حذف «${r.name_ar}» من متجر المكافآت؟ إذا كانت لها طلبات سابقة سيحتفظ النظام بالسجل ويخفيها من المتجر فقط.`))return;setBusy(r.id);setMsg("");try{const result=await rpc<any>("api_delete_reward",{p_reward_id:r.id});setMsg(result?.mode==="ARCHIVED"?"تم إخفاء الهدية من المتجر مع الاحتفاظ بسجل الاستبدالات السابقة.":"تم حذف الهدية من المتجر.");if(draft.id===r.id)reset();await load();await onChanged?.()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  async function toggleActive(r:RewardRow){setBusy(r.id+"a");setMsg("");try{await rpc("api_save_reward",{p_reward_id:r.id,p_name_ar:r.name_ar,p_description_ar:r.description_ar||null,p_cost_points:r.cost_points,p_stock:r.stock??null,p_is_active:!r.is_active});setMsg(!r.is_active?"تم إظهار الهدية في المتجر.":"تم إيقاف الهدية مؤقتًا.");await load();await onChanged?.()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  return <section className="panel reward-admin-panel">
    <div className="panel-title"><div><h3>إدارة متجر المكافآت</h3><p>إضافة وتعديل وحذف الهدايا وتحديد تكلفة النقاط والمخزون.</p></div><span className="counter">{rows.filter(r=>r.is_active).length} نشطة</span></div>
    <div className="reward-admin-layout">
      <form className="reward-editor form-stack" onSubmit={save}>
        <div className="reward-editor-head"><div><span className="eyebrow">{draft.id?"تعديل هدية":"هدية جديدة"}</span><h4>{draft.id?draft.name_ar||"تعديل الهدية":"إضافة مكافأة جديدة"}</h4></div>{draft.id&&<button type="button" className="mini-btn" onClick={reset}>إلغاء التعديل</button>}</div>
        <label>اسم الهدية<input required value={draft.name_ar} onChange={e=>setDraft(v=>({...v,name_ar:e.target.value}))} placeholder="مثال: سماعة رأس تعليمية"/></label>
        <label>وصف الهدية<textarea rows={3} value={draft.description_ar} onChange={e=>setDraft(v=>({...v,description_ar:e.target.value}))} placeholder="وصف مختصر يظهر للطالب"/></label>
        <div className="form-row"><label>تكلفة الهدية بالنقاط<input type="number" min="1" max="10000" required value={draft.cost_points} onChange={e=>setDraft(v=>({...v,cost_points:e.target.value}))}/></label><label>المخزون<input type="number" min="0" disabled={draft.unlimited} required={!draft.unlimited} value={draft.stock} onChange={e=>setDraft(v=>({...v,stock:e.target.value}))}/></label></div>
        <label className="check-line"><input type="checkbox" checked={draft.unlimited} onChange={e=>setDraft(v=>({...v,unlimited:e.target.checked}))}/><span>مخزون غير محدود</span></label>
        <label className="check-line"><input type="checkbox" checked={draft.is_active} onChange={e=>setDraft(v=>({...v,is_active:e.target.checked}))}/><span>إظهار الهدية للطلاب في المتجر</span></label>
        <button className="btn primary" disabled={busy==="save"}>{busy==="save"?"جارٍ الحفظ...":draft.id?"حفظ التعديلات":"إضافة الهدية"}</button>
      </form>
      <div className="reward-admin-list-wrap"><input className="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث في الهدايا..."/><div className="reward-admin-list">{filtered.map(r=>{const available=r.stock==null?null:Math.max(0,r.stock-r.reserved_stock);return <article className={r.is_active?"reward-admin-item":"reward-admin-item inactive"} key={r.id}><div className="reward-admin-item-main"><div><span>{r.is_active?"نشطة":"موقوفة"}</span><h4>{r.name_ar}</h4><p>{r.description_ar||"بدون وصف"}</p></div><strong>{r.cost_points}<small> نقطة</small></strong></div><div className="reward-admin-meta"><span><small>المخزون</small><b>{r.stock==null?"غير محدود":r.stock}</b></span><span><small>محجوز بطلبات</small><b>{r.reserved_stock||0}</b></span><span><small>المتاح فعليًا</small><b>{available==null?"غير محدود":available}</b></span><span><small>طلبات تاريخية</small><b>{r.redemption_count||0}</b></span></div><div className="reward-admin-actions"><button className="mini-btn" onClick={()=>edit(r)}>تعديل</button><button className="mini-btn" disabled={busy===r.id+"a"} onClick={()=>toggleActive(r)}>{r.is_active?"إيقاف":"إظهار"}</button><button className="mini-btn danger" disabled={busy===r.id} onClick={()=>remove(r)}>{busy===r.id?"جارٍ الحذف...":"حذف"}</button></div></article>})}</div></div>
    </div>
    {msg&&<div className="notice compact-notice">{msg}</div>}
  </section>;
}
