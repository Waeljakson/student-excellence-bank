import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let src = readFileSync(path, "utf8");

if (src.includes('className="student-class-tabs"')) process.exit(0);

const start = src.indexOf("function StudentsView(");
const end = src.indexOf("function RankingsView(", start);
if (start < 0 || end < 0) throw new Error("student-class-tabs: StudentsView block not found");

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
    return Array.from(map.values());
  },[students]);
  useEffect(()=>{if(activeClass!=="ALL"&&!groups.some(g=>g.key===activeClass))setActiveClass("ALL")},[activeClass,groups]);
  const selected=activeClass==="ALL"?null:groups.find(g=>g.key===activeClass)||null;
  const scoped=selected?selected.students:students;
  const list=scoped.filter(s=>\`${"${s.name} ${s.student_no} ${s.grade_name} ${s.class_name}"}\`.includes(q));
  const total=students.reduce((a,s)=>a+Number(s.points),0);
  return <><Header title="الطلاب والمحافظ" subtitle="كل طالب يظهر داخل قائمة فصله — والأرصدة ناتجة من دفتر الحركات"/><main className="content">
    <section className="stats-grid"><Stat label="إجمالي الطلاب" value={students.length}/><Stat label="طلاب لديهم نقاط" value={students.filter(s=>Number(s.points)>0).length}/><Stat label="إجمالي النقاط" value={total}/><Stat label="عدد الفصول" value={groups.length}/></section>
    <section className="panel student-wallet-panel">
      <div className="panel-title"><div><h3>محافظ الطلاب</h3><p>{selected?selected.grade_name+" — فصل "+selected.class_name:"جميع الطلاب"} · {scoped.length} طالب</p></div><input className="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث داخل القائمة..."/></div>
      <div className="student-class-tabs" role="tablist" aria-label="فصول الطلاب">
        <button type="button" className={activeClass==="ALL"?"active":""} onClick={()=>setActiveClass("ALL")}><b>الكل</b><span>{students.length}</span></button>
        {groups.map(g=><button type="button" key={g.key} className={activeClass===g.key?"active":""} onClick={()=>setActiveClass(g.key)}><b>{g.grade_name}</b><small>فصل {g.class_name}</small><span>{g.students.length}</span></button>)}
      </div>
      {list.length?<div className="table-wrap"><table><thead><tr><th>الطالب</th><th>الرقم</th><th>الصف</th><th>الفصل</th><th>المستوى</th><th>الرصيد</th><th>القيمة</th></tr></thead><tbody>{list.map(s=><tr key={s.id}><td><b>{s.name}</b></td><td>{s.student_no}</td><td>{s.grade_name}</td><td>{s.class_name}</td><td><span className="pill">{s.level}</span></td><td><b>{s.points} نقطة</b></td><td>{Number(s.value_sar).toLocaleString("ar-SA")} ر.س</td></tr>)}</tbody></table></div>:<Empty text={q?"لا يوجد طالب مطابق للبحث داخل هذا الفصل.":"لا يوجد طلاب في هذه القائمة."}/>} 
    </section>
  </main></>;
}

`;

src = src.slice(0,start) + component + src.slice(end);
writeFileSync(path,src);
