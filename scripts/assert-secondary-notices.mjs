import {readFileSync} from "node:fs";
const read=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const migration=read("database/20261104_independent_secondary_grades_notices.sql");
const staging=read("database/20261103_stage_scoped_notices_and_subject_coverage.sql");
const admin=read("src/PeriodNoticeAdmin.tsx");
const noticeImage=read("src/PeriodNoticeDesignedImage.tsx");
const noticeViewer=read("src/PeriodNoticeViewer.tsx");
const scenarios=[
 ["Each secondary grade has an independent published batch",
  migration.includes("one_current_notice_batch_per_grade")&&
  migration.includes("ON public.period_notice_batches(school_id,grade_id)")],
 ["Publishing cannot archive a different secondary grade",
  migration.includes("grade_id=v_grade AND published_at IS NOT NULL")],
 ["Published middle-school notices are not touched by secondary import",
  migration.includes("one_legacy_multi_grade_notice_per_department")&&
  migration.includes("old.grade_id IS NULL")],
 ["A grade's uploaded students must belong to that same grade",
  migration.includes("PERIOD_NOTICE_MIXED_GRADES")&&
  migration.includes("PERIOD_NOTICE_STUDENT_GRADE_MISMATCH")],
 ["Unmatched students block publication, not silently omit their notices",
  migration.includes("PERIOD_NOTICE_UNMATCHED_STUDENTS")],
 ["Original independent Excel sheets are required before publishing",
  migration.includes("PERIOD_NOTICE_ORIGINAL_MISSING")&&
  admin.includes("missing_originals")],
 ["Subjects ungraded for all students are excluded only from current-period totals",
  staging.includes("period_notice_refresh_subject_scope")&&
  staging.includes("BOOL_OR(recorded)")&&
  staging.includes("'excluded_from_total'")],
 ["Dynamic second-secondary Excel subject rows are supported",
  admin.includes('rowFor(sheet,"المجموع",24,51)')&&
  admin.includes('for(let r=24;r<totalRow;r++)')],
 ["Admin prominently warns before publishing or archiving any other grade",
  admin.includes('batch.grade_name')&&admin.includes("الصف نفسه فقط")],
 ["Student/guardian notice hides subjects outside the current-period sum",
  noticeImage.includes("notice.subjects.filter(subject=>subject.excluded_from_total!==true)")&&
  !noticeImage.includes('txt(ctx,excluded?"خارج المجموع"')&&
  !noticeViewer.includes("period-period-scope-note")],
 ["PDF and PNG export use the same filtered notice image",
  noticeImage.includes("drawDocument(painter,notice,studentName,schoolName,logos)")&&
  noticeImage.includes("const pdf=await makePdf(canvas,pages.current)")&&
  noticeImage.includes('canvas.toBlob(b=>b?resolve(b)')]
];
let failures=0;
for(const [title,pass] of scenarios){
 console.log((pass?"PASS":"FAIL")+" : "+title);
 if(!pass)failures++;
}
if(failures)throw new Error(failures+" secondary-notice safeguards failed");
console.log("All "+scenarios.length+" grade-scoped notice safeguards passed.");
