import { useEffect } from "react";
import { printTableReport } from "./report-print";
import "./report-print.css";

function findTitle(table:HTMLTableElement){
  const explicit=table.closest<HTMLElement>("[data-report-title]");
  if(explicit?.dataset.reportTitle)return explicit.dataset.reportTitle;
  const container=table.closest<HTMLElement>("section,article,.panel,main");
  const heading=container?.querySelector<HTMLElement>("h3,h2,h4,h1");
  return heading?.textContent?.trim()||"تقرير بنك التميز الطلابي";
}
function findSubtitle(table:HTMLTableElement){
  const explicit=table.closest<HTMLElement>("[data-report-subtitle]");
  if(explicit?.dataset.reportSubtitle)return explicit.dataset.reportSubtitle;
  const container=table.closest<HTMLElement>("section,article,.panel,main");
  const p=container?.querySelector<HTMLElement>(".panel-title p,.section-intro p,p");
  return p?.textContent?.trim()||"";
}

export default function PrintableTableTools(){
  useEffect(()=>{
    let timer=0;
    const scan=()=>{
      document.querySelectorAll<HTMLTableElement>("table").forEach(table=>{
        if(table.dataset.reportPrintReady==="1")return;
        if(table.closest(".excel-preview,.no-auto-report-print")){table.dataset.reportPrintReady="1";return}
        table.dataset.reportPrintReady="1";
        const container=table.closest<HTMLElement>("[data-report-title],section,article,.panel,main")||table.parentElement;
        const existing=container?Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(b=>/طباعة|PDF/i.test(b.textContent||"")):null;
        if(existing){existing.classList.add("report-print-btn");return}
        const host=table.parentElement;if(!host||host.querySelector(":scope > .auto-report-print-toolbar"))return;
        const toolbar=document.createElement("div");toolbar.className="auto-report-print-toolbar no-print";
        const btn=document.createElement("button");btn.type="button";btn.className="report-print-btn";btn.textContent="طباعة / حفظ PDF";
        btn.addEventListener("click",()=>printTableReport(table,{title:findTitle(table),subtitle:findSubtitle(table),orientation:"landscape"}));
        toolbar.appendChild(btn);host.insertBefore(toolbar,table);
      });
    };
    const schedule=()=>{window.clearTimeout(timer);timer=window.setTimeout(scan,80)};
    scan();
    const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
    return()=>{observer.disconnect();window.clearTimeout(timer)};
  },[]);
  return null;
}
