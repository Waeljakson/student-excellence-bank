import { readFileSync, writeFileSync } from "node:fs";

// Keep auth/profile startup stable after all previous upgrade scripts have run.
const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

const oldRefresh = `async function refreshProfile(){setProfileLoading(true);setProfileError("");try{setProfile(await rpc<Profile>("api_profile"))}catch(e){setProfileError(niceError(e))}finally{setProfileLoading(false)}}`;
const newRefresh = `async function refreshProfile(){setProfileLoading(true);setProfileError("");try{let next:Profile|null=null;for(let attempt=0;attempt<4;attempt++){next=await rpc<Profile>("api_profile");if(next?.status!=="PENDING")break;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)))}setProfile(next)}catch(e){setProfileError(niceError(e))}finally{setProfileLoading(false)}}`;
if (app.includes(oldRefresh)) app = app.replace(oldRefresh, newRefresh);

// Do NOT initialize busy=true here. repair() itself guards on busy; starting true would deadlock auto-link forever.
const oldPendingHead = `  const [busy,setBusy]=useState(false);const[message,setMessage]=useState("");\n  const email=String(profile.email||"").trim().toLowerCase();\n  const staffSuffix="@staff.mishkat.sa";const studentSuffix="@students.mishkat.sa";\n  const portalKey=email.endsWith(staffSuffix)?"T:"+email.slice(0,-staffSuffix.length):email.endsWith(studentSuffix)?email.slice(0,-studentSuffix.length):"";`;
const stablePendingHead = `  const [busy,setBusy]=useState(false);const[message,setMessage]=useState("");\n  const email=String(profile.email||"").trim().toLowerCase();\n  const staffSuffix="@staff.mishkat.sa";const studentSuffix="@students.mishkat.sa";\n  const portalKey=email.endsWith(staffSuffix)?"T:"+email.slice(0,-staffSuffix.length):email.endsWith(studentSuffix)?email.slice(0,-studentSuffix.length):"";`;
if (app.includes(oldPendingHead)) app = app.replace(oldPendingHead, stablePendingHead);

// If a previous build introduced the deadlocking Boolean(portalKey) initializer, always neutralize it.
app = app.replace(
  `const [busy,setBusy]=useState(Boolean(portalKey));const[message,setMessage]=useState("");`,
  `const [busy,setBusy]=useState(false);const[message,setMessage]=useState("");`
);

// Show a linking state immediately for portal accounts without blocking repair().
const oldReturn = `  return <div className="full-center"><div className="pending-card"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span className="pending-icon">{busy?"⏳":"!"}</span><h1>{busy?"جارٍ ربط الحساب بالنظام":"الحساب غير مرتبط بالنظام"}</h1><p>{busy?"يتم الآن إكمال ربط حسابك تلقائيًا ببيانات المدرسة.":profile.name||profile.email}</p>{message&&<div className="notice error">{message}</div>}{portalKey&&<button className="btn primary" disabled={busy} onClick={repair}>{busy?"جارٍ الربط...":"إعادة محاولة ربط الحساب"}</button>}<button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></div></div>;`;
const newReturn = `  const linking=Boolean(portalKey)&&!message;\n  return <div className="full-center"><div className="pending-card"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span className="pending-icon">{linking?"⏳":"!"}</span><h1>{linking?"جارٍ ربط الحساب بالنظام":"تعذر إكمال ربط الحساب"}</h1><p>{linking?"يتم الآن التحقق من بيانات حسابك وربطه تلقائيًا بالمدرسة.":profile.name||profile.email}</p>{message&&<div className="notice error">{message}</div>}{portalKey&&message&&<button className="btn primary" disabled={busy} onClick={repair}>{busy?"جارٍ الربط...":"إعادة محاولة ربط الحساب"}</button>}<button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></div></div>;`;
if (app.includes(oldReturn)) app = app.replace(oldReturn, newReturn);

writeFileSync(appPath, app);

const clientPath = "src/client.ts";
let client = readFileSync(clientPath, "utf8");
const oldRpc = `export async function rpc<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {\n  const { data, error } = await neon.rpc(name, args);\n  if (error) {\n    const message = error?.message || error?.details || error?.hint || JSON.stringify(error);\n    throw new Error(message);\n  }\n  return data as T;\n}`;
const newRpc = `export async function rpc<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {\n  let lastMessage = \"تعذر تنفيذ الطلب\";\n  for (let attempt = 0; attempt < 4; attempt++) {\n    const { data, error } = await neon.rpc(name, args);\n    if (!error) return data as T;\n    lastMessage = error?.message || error?.details || error?.hint || JSON.stringify(error);\n    const transientAuth = /AUTH_REQUIRED|APPROVAL_REQUIRED|APP_USER_REQUIRED|JWT expired|jwt expired|token.*expired/i.test(lastMessage);\n    if (!transientAuth || attempt === 3) throw new Error(lastMessage);\n    await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));\n  }\n  throw new Error(lastMessage);\n}`;
if (client.includes(oldRpc)) client = client.replace(oldRpc, newRpc);
writeFileSync(clientPath, client);
