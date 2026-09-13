import { readFileSync, writeFileSync } from "node:fs";

const clientPath = "src/client.ts";
let client = readFileSync(clientPath, "utf8");

const start = client.indexOf("export async function rpc<T = any>");
const end = client.indexOf("\n\nexport function niceError", start);

if (start === -1 || end === -1) {
  throw new Error("Could not locate rpc() in src/client.ts");
}

const rpcImpl = `export async function rpc<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  let lastMessage = "تعذر تنفيذ الطلب";
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await neon.rpc(name, args);
    if (!error) return data as T;

    lastMessage = error?.message || error?.details || error?.hint || JSON.stringify(error);
    const retryable = /schema cache|Could not find the function|PGRST202|AUTH_REQUIRED|APPROVAL_REQUIRED|APP_USER_REQUIRED|JWT expired|jwt expired|token.*expired/i.test(lastMessage);
    if (!retryable || attempt === 5) throw new Error(lastMessage);

    await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
  }
  throw new Error(lastMessage);
}`;

client = client.slice(0, start) + rpcImpl + client.slice(end);
writeFileSync(clientPath, client);
