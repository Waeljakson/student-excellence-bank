import { readFileSync, writeFileSync } from "node:fs";

const path="src/ReferralCenter.tsx";
let src=readFileSync(path,"utf8");

src=src.replaceAll('ليست من اختصاصي، يرجى تحويلها لوكيل المدرسة.','مشكلة سلوكية يتم تحويلها للوكيل.');
src=src.replaceAll('إرجاع للمعلم — ليست من اختصاصي','إرجاع للمعلم — مشكلة سلوكية للوكيل');

writeFileSync(path,src);
