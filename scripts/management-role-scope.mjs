import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let src = readFileSync(path, "utf8");
if (src.includes("ROLE_SCOPE_V2")) process.exit(0);

const logoMarker = 'const GUIDANCE_LOGO = `${import.meta.env.BASE_URL}guidance-logo.png`;';
if (!src.includes(logoMarker)) throw new Error("management-role-scope: logo marker not found");
src = src.replace(logoMarker, `${logoMarker}\n\n// ROLE_SCOPE_V2\nconst CLASS_SCOPED_JOBS = ["معلم", "مدير المدرسة", "وكيل المدرسة", "الموجه الطلابي"];\nfunction isClassScopedJob(job?: string | null) { return !!job && CLASS_SCOPED_JOBS.includes(job); }`);

const replacements = [
  ['["admin","صلاحيات المعلمين","⚙"]', '["admin","الهيئة والصلاحيات","⚙"]'],
  ['if(member.job_title_ar==="معلم"&&!cids.length){setMsg("يجب تسكين المعلم في فصل واحد على الأقل قبل الاعتماد.");return}', 'if(isClassScopedJob(member.job_title_ar)&&!cids.length){setMsg("يجب تسكين الموظف في فصل واحد على الأقل قبل الاعتماد.");return}'],
  ['if(member.job_title_ar==="معلم"&&!editClasses.length){setMsg("يجب تسكين المعلم في فصل واحد على الأقل.");return}', 'if(isClassScopedJob(member.job_title_ar)&&!editClasses.length){setMsg("يجب تسكين الموظف في فصل واحد على الأقل.");return}'],
  ['member?.job_title_ar==="معلم"&&<div className="class-picker"><b>تسكين المعلم في الفصول</b>', 'member&&isClassScopedJob(member.job_title_ar)&&<div className="class-picker"><b>تسكين الموظف في الفصول</b>'],
  ['if(m?.job_title_ar!=="معلم")setEditClasses([])', 'if(!isClassScopedJob(m?.job_title_ar))setEditClasses([])'],
  ['selectedStaff(editStaff)?.job_title_ar==="معلم"&&<div className="class-picker"><b>الفصول المسموح بها</b><p>المعلم لن يرى أو يمنح نقاطًا لطلاب أي فصل غير محدد هنا.</p>', 'selectedStaff(editStaff)&&isClassScopedJob(selectedStaff(editStaff)?.job_title_ar)&&<div className="class-picker"><b>الفصول المسموح بها</b><p>المستخدم لن يرى أو يمنح نقاطًا لطلاب أي فصل غير محدد هنا.</p>'],
  ['if(!staffAssignmentClasses.length){setMsg("اختر فصلًا واحدًا على الأقل للمعلم.");return}', 'if(!staffAssignmentClasses.length){setMsg("اختر فصلًا واحدًا على الأقل للموظف.");return}'],
  ['<h3>تسكين المعلم على الفصول</h3>', '<h3>تسكين الموظف على الفصول</h3>'],
  ['بعد الحفظ سيُربط المعلم بهذه الفصول وطلابها عند إنشاء حسابه أو ربطه لاحقًا.', 'بعد الحفظ سيُربط الموظف بهذه الفصول وطلابها عند إنشاء حسابه أو ربطه لاحقًا.'],
  ['"حفظ تسكين المعلم"', '"حفظ التسكين"'],
  ['من هنا يتم تسكين المعلمين على الفصول مباشرة حتى قبل إنشاء حساباتهم.', 'من هنا يتم تسكين المعلمين ومدير المدرسة والوكيل والموجه الطلابي على الفصول.'],
  ['s.job_title_ar==="معلم"&&<div className="staff-assigned-classes">', 'isClassScopedJob(s.job_title_ar)&&<div className="staff-assigned-classes">'],
  ['s.job_title_ar==="معلم"&&<button className="mini-btn" onClick={()=>openStaffAssignment(s)}>تسكين الفصول</button>', 'isClassScopedJob(s.job_title_ar)&&<button className="mini-btn" onClick={()=>openStaffAssignment(s)}>تسكين الفصول</button>'],
  ['<b>صلاحية المعلم مقيدة بالفصول</b><span>يرى طلاب فصوله فقط، ويصدر لهم فقط، ويضيف خميسنا غير لفصوله فقط.</span>', '<b>الصلاحيات مقيدة بالفصول</b><span>المعلم والمدير والوكيل والموجه الطلابي يرون طلاب الفصول المسندة لهم فقط، ويعمل خميسنا غير داخل نفس النطاق.</span>'],
  ['<b>الشيك العملاق</b><span>متاح فقط لمن تم ربطه وظيفيًا كمدير مدرسة أو وكيل مدرسة أو موجه طلابي.</span>', '<b>نوع الشيك حسب الوظيفة</b><span>المعلم: الشيكات العادية فقط. مدير المدرسة والوكيل والموجه الطلابي: شيك التميز العملاق فقط.</span>'],
  ['<b>خميسنا غير: مرة واحدة يوميًا</b><span>لا يستطيع نفس المعلم إضافة نقاط لنفس الفصل أكثر من مرة في اليوم.</span>', '<b>خميسنا غير: مرة واحدة يوميًا</b><span>لا يستطيع نفس المستخدم إضافة نقاط لنفس الفصل أكثر من مرة في اليوم.</span>'],
];
for (const [from, to] of replacements) src = src.split(from).join(to);

writeFileSync(path, src);
