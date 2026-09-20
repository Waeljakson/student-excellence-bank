import {readFileSync,writeFileSync} from "node:fs";
const path="src/GuardianPortal.tsx";
let s=readFileSync(path,"utf8");
const oldBlock="  }else{\n    title=\"متابعة اليوم\";\n    body=`وردت اليوم ${general.length} ملاحظة متابعة عامة من المعلمين. راجعها مع ابنكم بهدوء واستفيدوا منها كفرصة للتوجيه والتحسين.`;\n    advice=[\"استمع له أولًا.\",\"حددوا معًا ما الذي يمكن تحسينه غدًا.\",\"اختم الحديث بكلمة تشجيع واضحة.\"];\n  }";
const newBlock="  }else{\n    tone=\"general\";\n    title=\"تنبيه أو معلومة عامة\";\n    body=general.length===1\n      ?\"وردت اليوم ملاحظة عامة من أحد المعلمين. يمكنكم الاطلاع على تفاصيلها في دفتر المتابعة.\"\n      :`وردت اليوم ${general.length} ملاحظات عامة من المعلمين. يمكنكم الاطلاع على تفاصيلها في دفتر المتابعة.`;\n    advice=[];\n  }";
if(s.includes(oldBlock))s=s.replace(oldBlock,newBlock);
if(!s.includes('title="تنبيه أو معلومة عامة"')||!s.includes('advice=[];')){
  throw new Error("guardian-general-no-advice: general note behavior missing");
}
writeFileSync(path,s);
console.log("guardian-general-no-advice: general notes render without advice");
