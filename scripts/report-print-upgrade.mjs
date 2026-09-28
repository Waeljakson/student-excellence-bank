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
// Keep this report on its dedicated self-contained print path.
// Replacing it with the generic DOM table printer can yield a blank print preview.
behavioral=behavioral.replace('\nimport { printTableReport } from "./report-print";','');
behavioral=behavioral.replace('className="panel behavioral-participation-report"','className="panel behavioral-participation-report" data-report-title="تقرير متابعة ترشيحات المعلمين — التميز السلوكي"');
writeFileSync(behavioralPath,behavioral);

const swPath="public/sw.js";
let sw=readFileSync(swPath,"utf8");
sw=sw.replace(/mishkat-bank-shell-v\d+/,"mishkat-bank-shell-v13");
writeFileSync(swPath,sw);
