import {readFileSync,writeFileSync} from "node:fs";
const path="src/App.tsx";
let s=readFileSync(path,"utf8");

s=s.replace(
`    }catch(e){
      if(!cached){
        try{
          serverVersions=null;
          await Promise.all(keys.filter(k=>k!=="admin"||isAdmin).map(k=>pull(k)));
          const latest=readDataCache<any>(cacheScope);
          writeDataCache(cacheScope,{...(latest?.versions||{})},{...(latest?.data||{}),...base});
        }catch(inner){setError(niceError(inner))}
      }
    }finally{setLoading(false)}`,
`    }catch(e){
      if(force||!cached){
        try{
          serverVersions=null;
          await Promise.all(keys.filter(k=>k!=="admin"||isAdmin).map(k=>pull(k)));
          const latest=readDataCache<any>(cacheScope);
          writeDataCache(cacheScope,{...(latest?.versions||{})},{...(latest?.data||{}),...base});
        }catch(inner){setError(niceError(inner))}
      }
    }finally{setLoading(false)}`
);

const oldRefresh=`  async function refreshStudents(){await syncData(["students","rankings"],true)}
  async function refreshRewards(){await syncData(["rewards"],true)}`;
const newRefresh="  async function refreshStudents(){await syncData([\"students\",\"rankings\",\"dashboard\"],true)}\n  function removeStudentLocally(studentId:string){\n    setStudents(prev=>prev.filter(s=>s.id!==studentId));\n    setRankings(prev=>prev?{...prev,students:(prev.students||[]).filter(s=>s.id!==studentId)}:prev);\n    const cached=readDataCache<any>(cacheScope);\n    if(cached){\n      const data:any={...(cached.data||{})};\n      if(Array.isArray(data.students))data.students=data.students.filter((s:Student)=>s.id!==studentId);\n      if(data.rankings?.students)data.rankings={...data.rankings,students:data.rankings.students.filter((s:any)=>s.id!==studentId)};\n      writeDataCache(cacheScope,cached.versions,data);\n    }\n  }\n  async function refreshRewards(){await syncData([\"rewards\"],true)}";
if(s.includes(oldRefresh))s=s.replace(oldRefresh,newRefresh);

s=s.replace(
  'function StudentsView({students,roles,reload}:{students:Student[];roles:string[];reload:()=>Promise<void>}){',
  'function StudentsView({students,roles,reload,onDeleted}:{students:Student[];roles:string[];reload:()=>Promise<void>;onDeleted:(studentId:string)=>void}){'
);

if(!s.includes("onDeleted(student.id)")){
  s=s.replace(
    '      setStudentMsg(`تم حذف الطالب ${student.name} نهائيًا من قاعدة البيانات.`);\n      await reload();',
    '      onDeleted(student.id);\n      setStudentMsg(`تم حذف الطالب ${student.name} نهائيًا من قاعدة البيانات.`);\n      await reload();'
  );
}

s=s.replace(
  '{tab==="students"&&<StudentsView students={students} roles={profile.roles||[]} reload={refreshStudents}/>} ',
  '{tab==="students"&&<StudentsView students={students} roles={profile.roles||[]} reload={refreshStudents} onDeleted={removeStudentLocally}/>} '
);
s=s.replace(
  '{tab==="students"&&<StudentsView students={students} roles={profile.roles||[]} reload={refreshStudents}/>} ',
  '{tab==="students"&&<StudentsView students={students} roles={profile.roles||[]} reload={refreshStudents} onDeleted={removeStudentLocally}/>} '
);

if(!s.includes("force||!cached")||!s.includes("removeStudentLocally")||!s.includes("onDeleted(student.id)")){
  throw new Error("student-delete-cache-fix: required cache removal behavior missing");
}
writeFileSync(path,s);
console.log("student-delete-cache-fix: immediate local removal and forced fallback refresh verified");
