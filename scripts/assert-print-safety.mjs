import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("src/report-print.ts");
const globalStyles=read("src/styles.css");
const teacherStyles=read("src/teacher-student-report.css");
const autoPrint=read("src/PrintableTableTools.tsx");
const notices=read("src/PeriodNoticeAdmin.tsx");
const tests=[
 ["A4 reports never import SPA-wide CSS (a cause of fully blank printouts)",
  !source.includes('querySelectorAll<HTMLLinkElement>(\'link[rel="stylesheet"]\')')&&
  !source.includes('${styles}<style>')&&source.includes("<style>")],
 ["A4 print output includes a real data table and a nonempty table guard",
  source.includes("clean.outerHTML")&&source.includes('if(rows===0)')&&source.includes("w.document.close()")],
 ["Check receipt rules cannot hide unrelated report sections",
  globalStyles.includes(".content:has(.check-print)>section:not(.check-print)")&&
  !globalStyles.includes(".content>section:not(.check-print){display:none!important}")],
 ["Teacher report's visibility reset is scoped to its mounted module",
  teacherStyles.includes("body:has(.tsr-root) *{visibility:hidden!important}")&&
  !/^\s*body \*\s*\{visibility:hidden!important\}/m.test(teacherStyles)],
 ["Generic printing must not hijack existing actions or change their captions",
  !autoPrint.includes("existing.textContent=")&&
  autoPrint.includes('btn.textContent="طباعة هذا الجدول / PDF"')],
 ["Results notices expose an explicit print action tied to visible data",
  notices.includes("printTableReport(previewTableRef.current")&&
  notices.includes("ref={previewTableRef}")&&
  notices.includes("معاينة / طباعة تقرير الإشعارات PDF")],
 ["Notice print action disables itself when there are no rows",
  notices.includes("disabled={!batch||shown.length===0||busy}")]
];
let bad=0;
for(const [label,pass] of tests){process.stdout.write((pass?"PASS":"FAIL")+" : "+label+"\n");if(!pass)bad++}
if(bad){console.error("Print safety check failed: "+bad+" regression(s)");process.exitCode=1}
else console.log("All "+tests.length+" printable-report regression guards passed.");
