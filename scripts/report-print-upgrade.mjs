import { readFileSync, writeFileSync } from "node:fs";

const mainPath="src/main.tsx";
let main=readFileSync(mainPath,"utf8");
if(!main.includes('import PrintableTableTools from "./PrintableTableTools";')) main=main.replace('import InstallAppButton from "./InstallAppButton";','import InstallAppButton from "./InstallAppButton";\nimport PrintableTableTools from "./PrintableTableTools";');
if(!main.includes('<PrintableTableTools />')) main=main.replace('    <InstallAppButton />','    <InstallAppButton />\n    <PrintableTableTools />');
writeFileSync(mainPath,main);

const competitionPath="src/CompetitionManagementPanel.tsx";
let competition=readFileSync(competitionPath,"utf8");
competition=competition.replace('open===c.id&&<div className="competition-participants">','open===c.id&&<div className="competition-participants" data-report-title={`قائمة المنضمين — ${c.title_ar}`} data-report-subtitle={`${fmt(c.starts_at)} — ${fmt(c.ends_at)} · ${c.target_classes?.map(x=>`${x.grade_name} / ${x.class_name}`).join("، ")||"جميع الفصول المستهدفة"}`}>');
writeFileSync(competitionPath,competition);

const behavioralPath="src/BehavioralExcellence.tsx";
let behavioral=readFileSync(behavioralPath,"utf8");
if(!behavioral.includes('from "./report-print"')) behavioral=behavioral.replace('import { niceError, rpc } from "./client";','import { niceError, rpc } from "./client";\nimport { printTableReport } from "./report-print";');
behavioral=behavioral.replace('onClick={printParticipation}>طباعة التقرير</button>','onClick={()=>{const table=document.querySelector(".behavioral-report-table table") as HTMLTableElement|null;if(table)printTableReport(table,{title:"تقرير متابعة ترشيحات المعلمين — التميز السلوكي",subtitle:c?`${c.title_ar} · ${fmt(c.starts_at)} — ${fmt(c.ends_at)}`:"",orientation:"landscape"})}}>طباعة / حفظ PDF</button>');
behavioral=behavioral.replace('className="panel behavioral-participation-report"','className="panel behavioral-participation-report" data-report-title="تقرير متابعة ترشيحات المعلمين — التميز السلوكي"');
writeFileSync(behavioralPath,behavioral);

const swPath="public/sw.js";
let sw=readFileSync(swPath,"utf8");
sw=sw.replace(/mishkat-bank-shell-v\d+/,"mishkat-bank-shell-v13");
writeFileSync(swPath,sw);
