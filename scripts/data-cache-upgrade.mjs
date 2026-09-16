import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

if (!app.includes('from "./data-cache"')) {
  const importMarker = 'import StudentClassEditor from "./StudentClassEditor";';
  if (!app.includes(importMarker)) throw new Error("data-cache: App import marker missing");
  app = app.replace(importMarker, importMarker + '\nimport { readDataCache, writeDataCache, sameCacheVersion, type CacheVersions } from "./data-cache";');
}

const bankStart = app.indexOf("function BankApp(");
const appExport = app.indexOf("\n\nexport default function App", bankStart);
if (bankStart < 0 || appExport < 0) throw new Error("data-cache: BankApp block missing");

const bankComponent = String.raw`function BankApp({ profile, refreshProfile }: { profile: Profile; refreshProfile:()=>Promise<void> }) {
  // VERSIONED_DATA_CACHE_V3
  const [tab,setTab]=useState<Tab>("dashboard");
  const [dashboard,setDashboard]=useState<Dashboard|null>(null);
  const [students,setStudents]=useState<Student[]>([]);
  const [rules,setRules]=useState<Rule[]>([]);
  const [checks,setChecks]=useState<Check[]>([]);
  const [rankings,setRankings]=useState<Rankings|null>(null);
  const [rewards,setRewards]=useState<Reward[]>([]);
  const [users,setUsers]=useState<ManagedUser[]>([]);
  const [staff,setStaff]=useState<StaffMember[]>([]);
  const [adminClasses,setAdminClasses]=useState<AdminClass[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const pending:PendingUser[]=[];
  const isAdmin=profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL"].includes(r));
  const cacheScope="staff:"+(profile.app_user_id||profile.auth_user_id||profile.email||"unknown");

  function applyCached(data:any){
    if(data?.dashboard!==undefined)setDashboard(data.dashboard||null);
    if(Array.isArray(data?.students))setStudents(data.students);
    if(Array.isArray(data?.rules))setRules(data.rules);
    if(Array.isArray(data?.checks))setChecks(data.checks);
    if(data?.rankings!==undefined)setRankings(data.rankings||null);
    if(Array.isArray(data?.rewards))setRewards(data.rewards);
    if(Array.isArray(data?.users))setUsers(data.users);
    if(Array.isArray(data?.staff))setStaff(data.staff);
    if(Array.isArray(data?.adminClasses))setAdminClasses(data.adminClasses);
  }

  async function syncData(keys:Array<"dashboard"|"students"|"rules"|"checks"|"rankings"|"rewards"|"admin">,force=false){
    setError("");
    const cached=readDataCache<any>(cacheScope);
    const base:any={...(cached?.data||{})};
    const oldVersions:CacheVersions={...(cached?.versions||{})};
    const nextVersions:CacheVersions={...oldVersions};
    let serverVersions:CacheVersions|null=null;

    async function pull(key:string){
      if(key==="dashboard"){base.dashboard=await rpc<Dashboard>("api_dashboard");setDashboard(base.dashboard)}
      else if(key==="students"){base.students=await rpc<Student[]>("api_students");setStudents(base.students)}
      else if(key==="rules"){base.rules=await rpc<Rule[]>("api_point_rules");setRules(base.rules)}
      else if(key==="checks"){base.checks=await rpc<Check[]>("api_recent_checks");setChecks(base.checks)}
      else if(key==="rankings"){base.rankings=await rpc<Rankings>("api_rankings");setRankings(base.rankings)}
      else if(key==="rewards"){base.rewards=await rpc<Reward[]>("api_rewards");setRewards(base.rewards)}
      else if(key==="admin"&&isAdmin){
        const [u,st,cl]=await Promise.all([rpc<ManagedUser[]>("api_managed_users"),rpc<StaffMember[]>("api_staff_directory"),rpc<AdminClass[]>("api_admin_classes")]);
        base.users=u;base.staff=st;base.adminClasses=cl;setUsers(u);setStaff(st);setAdminClasses(cl);
      }
      if(serverVersions)nextVersions[key]=serverVersions[key];
    }

    try{
      serverVersions=await rpc<CacheVersions>("api_cache_versions");
      const needs=(key:string)=>{
        const hasData=key==="admin"?Array.isArray(base.users)&&Array.isArray(base.staff)&&Array.isArray(base.adminClasses):base[key]!==undefined;
        return force||!hasData||!sameCacheVersion(oldVersions,serverVersions||{},key);
      };
      await Promise.all(keys.filter(k=>k!=="admin"||isAdmin).filter(needs).map(k=>pull(k)));
      const latest=readDataCache<any>(cacheScope);
      writeDataCache(cacheScope,{...(latest?.versions||{}),...nextVersions},{...(latest?.data||{}),...base});
    }catch(e){
      if(!cached){
        try{
          serverVersions=null;
          await Promise.all(keys.filter(k=>k!=="admin"||isAdmin).map(k=>pull(k)));
          const latest=readDataCache<any>(cacheScope);
          writeDataCache(cacheScope,{...(latest?.versions||{})},{...(latest?.data||{}),...base});
        }catch(inner){setError(niceError(inner))}
      }
    }finally{setLoading(false)}
  }

  useEffect(()=>{
    const cached=readDataCache<any>(cacheScope);
    if(cached){applyCached(cached.data);if(cached.data?.dashboard)setLoading(false)}
    void syncData(["dashboard","checks"]);
  },[cacheScope]);

  useEffect(()=>{
    if(tab==="checks")void syncData(["students","rules","checks"]);
    else if(tab==="students"||tab==="referrals"||tab==="student-evaluations"||tab==="behavioral")void syncData(["students"]);
    else if(tab==="rankings")void syncData(["rankings"]);
    else if(tab==="rewards")void syncData(["rewards"]);
    else if(tab==="admin"&&isAdmin)void syncData(["admin"]);
  },[tab]);

  async function refreshStudents(){await syncData(["students","rankings"],true)}
  async function refreshRewards(){await syncData(["rewards"],true)}
  async function refreshAdmin(){await syncData(["admin","students","rules"],true)}
  async function afterIssued(){await Promise.all([syncData(["dashboard","checks","students","rankings"],true),refreshProfile()])}

  return <AppShell profile={profile} tab={tab} setTab={setTab}>{loading&&!dashboard?<Loading/>:<>{error&&<div className="notice error global-error">{error}</div>}{tab==="dashboard"&&<DashboardView data={dashboard} checks={checks}/>} {tab==="checks"&&<><ChecksView students={students} rules={rules} onIssued={afterIssued}/>{profile.roles?.includes("TEACHER")&&<main className="content teacher-check-manager-wrap"><TeacherCheckManager onChanged={afterIssued}/></main>}</>} {tab==="students"&&<StudentsView students={students} roles={profile.roles||[]} reload={refreshStudents}/>} {tab==="rankings"&&<RankingsView data={rankings}/>} {tab==="rewards"&&<><RewardsView rewards={rewards}/>{profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","REWARD_OFFICER"].includes(r))&&<main className="content reward-admin-wrap"><RewardManagementPanel onChanged={refreshRewards}/></main>}</>} {tab==="referrals"&&<ReferralCenter roles={profile.roles} students={students} profileName={profile.name||""}/>} {tab==="redemption"&&profile.roles?.includes("GUIDANCE_COUNSELOR")&&<GuidanceRedemptionCenter/>} {tab==="student-evaluations"&&<StudentEvaluationReports roles={profile.roles} students={students}/>} {tab==="behavioral"&&<BehavioralExcellence students={students}/>} {tab==="khameesna"&&<KhameesnaCompetition isSuperAdmin={profile.roles?.includes("SUPER_ADMIN")===true}/>} {tab==="account"&&<UserAccount profile={profile} onProfileChanged={refreshProfile}/>} {tab==="system"&&profile.roles?.includes("SUPER_ADMIN")&&<SystemControlPanel/>} {tab==="admin"&&isAdmin&&<AdminView pending={pending} users={users} staff={staff} classes={adminClasses} reload={refreshAdmin} isSuperAdmin={profile.roles?.includes("SUPER_ADMIN")===true}/>}</>}</AppShell>;
}`;

app = app.slice(0, bankStart) + bankComponent + app.slice(appExport);
if (app.includes('<StudentPortal/>')) app = app.replace('<StudentPortal/>','<StudentPortal cacheUserId={profile.app_user_id||profile.auth_user_id||profile.email||""}/>');
writeFileSync(appPath, app);

const portalPath = "src/StudentPortal.tsx";
let portal = readFileSync(portalPath, "utf8");
if (!portal.includes('from "./data-cache"')) {
  portal = portal.replace('import { neon, niceError, rpc } from "./client";', 'import { neon, niceError, rpc } from "./client";\nimport { readDataCache, writeDataCache, sameCacheVersion, type CacheVersions } from "./data-cache";');
}
portal = portal.replace('export default function StudentPortal(){','export default function StudentPortal({cacheUserId=""}:{cacheUserId?:string}){');
const oldLoad='  async function load(){setError("");try{setData(await rpc<PortalData>("api_student_portal"))}catch(e){setError(niceError(e))}}\n  useEffect(()=>{load()},[]);';
const newLoad=`  async function load(force=false){\n    const scope=cacheUserId?"student:"+cacheUserId:"";\n    const cached=scope?readDataCache<any>(scope):null;\n    if(!force&&cached?.data?.portal&&!data)setData(cached.data.portal as PortalData);\n    setError("");\n    try{\n      const versions=await rpc<CacheVersions>("api_cache_versions");\n      if(!force&&cached?.data?.portal&&sameCacheVersion(cached.versions,versions,"student_portal")){setData(cached.data.portal as PortalData);return}\n      const fresh=await rpc<PortalData>("api_student_portal");\n      setData(fresh);\n      if(scope)writeDataCache(scope,{...(cached?.versions||{}),student_portal:versions.student_portal},{...(cached?.data||{}),portal:fresh});\n    }catch(e){if(cached?.data?.portal)setData(cached.data.portal as PortalData);else setError(niceError(e))}\n  }\n  useEffect(()=>{void load()},[cacheUserId]);`;
if (portal.includes(oldLoad)) portal = portal.replace(oldLoad,newLoad);
else if ((!portal.includes('api_cache_versions')&&!portal.includes('api_student_cache_version')) || !portal.includes('student_portal')) throw new Error("data-cache: StudentPortal load marker missing");
portal = portal.replace('authError(result);await load();setPhotoMsg("تم تحديث صورتك الشخصية.");','authError(result);await load(true);setPhotoMsg("تم تحديث صورتك الشخصية.");');
writeFileSync(portalPath, portal);
