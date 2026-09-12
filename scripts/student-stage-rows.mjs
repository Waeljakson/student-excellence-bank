import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let src = readFileSync(path, "utf8");

if (src.includes('className="student-stage-rows"')) process.exit(0);

const start = src.indexOf("function StudentsView(");
const end = src.indexOf("function RankingsView(", start);
if (start < 0 || end < 0) throw new Error("student-stage-rows: StudentsView block not found");

const component = `function StudentsView({students}:{students:Student[]}){
  const[q,setQ]=useState("");
  const[activeClass,setActiveClass]=useState("ALL");
  const groups=useMemo(()=>{
    const map=new Map<string,{key:string;grade_name:string;class_name:string;students:Student[]}>();
    students.forEach(s=>{
      const key=s.grade_name+"|||"+s.class_name;
      if(!map.has(key))map.set(key,{key,grade_name:s.grade_name,class_name:s.class_name,students:[]});
      map.get(key)!.students.push(s);
    });
    const gradeRank=(name:string)=>/الأول|الاول/.test(name)?1:/الثاني|ثانى|ثاني/.test(name)?2:/الثالث|ثالث/.test(name)?3:99;
    return Array.from(map.values()).sort((a,b)=>{
      const stageA=/متوسط/.test(a.grade_name)?1:/ثان/.test(a.grade_name)?2:3;
      const stageB=/متوسط/.test(b.grade_name)?1:/ثان/.test(b.grade_name)?2:3;
      if(stageA!==stageB)return stageA-stageB;
      const gradeDiff=gradeRank(a.grade_name)-gradeRank(b.grade_name);
      if(gradeDiff!==0)return gradeDiff;
      return a.class_name.localeCompare(b.class_name,"ar",{numeric:true});
    });
  },[students]);
  const middleGroups=groups.filter(g=>/متوسط/.test(g.grade_name));
  const secondaryGroups=groups.filter(g=>/ثان/.test(g.grade_name));
  const otherGroups=groups.filter(g=>!/متوسط|ثان/.test(g.grade_name));
  useEffect(()=>{if(activeClass!=="ALL"&&!groups.some(g=>g.key===activeClass))setActiveClass("ALL")},[activeClass,groups]);
  const selected=activeClass==="ALL"?null:groups.find(g=>g.key===activeClass)||null;
  const scoped=selected?selected.students:students;
  const list=scoped.filter(s=>\`${"${s.name} ${s.student_no} ${s.grade_name} ${s.class_name}"}\`.includes(q));
  const total=students.reduce((a,s)=>a+Number(s.points),0);
  const renderTabs=(items:typeof groups)=>items.map(g=><button type="button" key={g.key} className={activeClass===g.key?"active":""} onClick={()=>setActiveClass(g.key)}><b>{g.grade_name}</b><small>فصل {g.class_name}</small><span>{g.students.length}</span></button>);
  return <><Header title="الطلاب والمحافظ" subtitle="كل طالب يظهر داخل قائمة فصله — والأرصدة ناتجة من دفتر الحركات"/><main className="content">
    <section className="stats-grid"><Stat label="إجمالي الطلاب" value={students.length}/><Stat label="طلاب لديهم نقاط" value={students.filter(s=>Number(s.points)>0).length}/><Stat label="إجمالي النقاط" value={total}/><Stat label="عدد الفصول" value={groups.length}/></section>
    <section className="panel student-wallet-panel">
      <div className="panel-title"><div><h3>محافظ الطلاب</h3><p>{selected?selected.grade_name+" — فصل "+selected.class_name:"جميع الطلاب"} · {scoped.length} طالب</p></div><input className="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث داخل القائمة..."/></div>
      <div className="student-tabs-all"><button type="button" className={activeClass==="ALL"?"active":""} onClick={()=>setActiveClass("ALL")}><b>كل الطلاب</b><span>{students.length}</span></button></div>
      <div className="student-stage-rows">
        {middleGroups.length>0&&<div className="student-stage-row middle-stage"><div className="stage-row-title"><b>المرحلة المتوسطة</b><span>{middleGroups.reduce((n,g)=>n+g.students.length,0)} طالب</span></div><div className="student-class-tabs">{renderTabs(middleGroups)}</div></div>}
        {secondaryGroups.length>0&&<div className="student-stage-row secondary-stage"><div className="stage-row-title"><b>المرحلة الثانوية</b><span>{secondaryGroups.reduce((n,g)=>n+g.students.length,0)} طالب</span></div><div className="student-class-tabs">{renderTabs(secondaryGroups)}</div></div>}
        {otherGroups.length>0&&<div className="student-stage-row"><div className="stage-row-title"><b>فصول أخرى</b><span>{otherGroups.reduce((n,g)=>n+g.students.length,0)} طالب</span></div><div className="student-class-tabs">{renderTabs(otherGroups)}</div></div>}
      </div>
      {list.length?<div className="table-wrap"><table><thead><tr><th>الطالب</th><th>الرقم</th><th>الصف</th><th>الفصل</th><th>المستوى</th><th>الرصيد</th><th>القيمة</th></tr></thead><tbody>{list.map(s=><tr key={s.id}><td><b>{s.name}</b></td><td>{s.student_no}</td><td>{s.grade_name}</td><td>{s.class_name}</td><td><span className="pill">{s.level}</span></td><td><b>{s.points} نقطة</b></td><td>{Number(s.value_sar).toLocaleString("ar-SA")} ر.س</td></tr>)}</tbody></table></div>:<Empty text={q?"لا يوجد طالب مطابق للبحث داخل هذا الفصل.":"لا يوجد طلاب في هذه القائمة."}/>} 
    </section>
  </main></>;
}

`;

src = src.slice(0,start) + component + src.slice(end);
writeFileSync(path,src);
