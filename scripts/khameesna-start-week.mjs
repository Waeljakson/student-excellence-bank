import { readFileSync, writeFileSync } from "node:fs";

const path = "src/KhameesnaCompetition.tsx";
let src = readFileSync(path, "utf8");

if (!src.includes("configured_start_week?:number")) {
  src = src.replace(
    "type Board={available:boolean;can_manage?:boolean;competition_running?:boolean;",
    "type Board={available:boolean;can_manage?:boolean;competition_running?:boolean;configured_start_week?:number;"
  );
}

if (!src.includes("const[startWeek,setStartWeek]")) {
  src = src.replace(
    'const[classId,setClassId]=useState("");',
    'const[startWeek,setStartWeek]=useState(5);const[classId,setClassId]=useState("");'
  );
}

if (!src.includes("data?.configured_start_week")) {
  src = src.replace(
    "  useEffect(()=>{load()},[]);",
    "  useEffect(()=>{load()},[]);\n  useEffect(()=>{if(data?.configured_start_week)setStartWeek(Number(data.configured_start_week))},[data?.configured_start_week]);"
  );
}

if (!src.includes("async function saveStartWeek()")) {
  const marker = "  if(error)return";
  const fn = `  async function saveStartWeek(){\n    if(controlBusy)return;\n    if(!window.confirm(\`اعتماد الأسبوع \${startWeek} كبداية لمسابقة خميسنا غير؟ سيتم استبعاد الأسابيع السابقة.\`))return;\n    setControlBusy(true);setMsg(\"\");\n    try{await rpc(\"api_set_khameesna_running\",{p_action:\`START_FROM:\${startWeek}\`});setMsg(\`تم اعتماد الأسبوع \${startWeek} كبداية للمسابقة. الأسابيع السابقة أصبحت مستبعدة.\`);await load()}catch(e){setMsg(niceError(e))}finally{setControlBusy(false)}\n  }\n`;
  if (!src.includes(marker)) throw new Error("khameesna-start-week: error marker missing");
  src = src.replace(marker, fn + marker);
}

if (!src.includes("اعتماد أسبوع البداية")) {
  const marker = '    {data.status==="PAUSED"&&<section className="panel">';
  const panel = `    {(isSuperAdmin||data.can_manage===true)&&<section className=\"panel no-print\"><div className=\"panel-title\"><div><h3>بداية مسابقة خميسنا غير</h3><p>اختر الأسبوع الذي تبدأ منه المسابقة. الأسابيع السابقة سيتم استبعادها ولن تقبل تقييمات.</p></div><span className=\"counter\">البداية الحالية: الأسبوع {data.configured_start_week||5}</span></div><div className=\"form-row\"><label>أسبوع البداية<select value={startWeek} onChange={e=>setStartWeek(Number(e.target.value))}>{Array.from({length:13},(_,i)=>i+5).map(w=><option key={w} value={w}>الأسبوع {w}</option>)}</select></label><button type=\"button\" className=\"btn primary\" disabled={controlBusy} onClick={saveStartWeek}>{controlBusy?\"جارٍ الحفظ...\":\"اعتماد أسبوع البداية\"}</button></div></section>}\n\n`;
  if (!src.includes(marker)) throw new Error("khameesna-start-week: panel marker missing");
  src = src.replace(marker, panel + marker);
}

if (!src.includes('w.status==="SKIPPED"?" — مستبعد"')) {
  src = src.replace(
    '<small>{date(w.starts_on)} — {date(w.ends_on)}</small>',
    '<small>{date(w.starts_on)} — {date(w.ends_on)}{w.status==="SKIPPED"?" — مستبعد":""}</small>'
  );
}

if (!src.includes("اعتماد أسبوع البداية")) throw new Error("khameesna-start-week: patch failed");
writeFileSync(path, src);
