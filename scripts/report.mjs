// Turns real breakage in a scheduled run into a GitHub issue (GitHub e-mails it to the repo owner), and closes that
// issue once a later run is healthy again. Needs GH_TOKEN with issues: write.
// An issue is opened only for:
//  (a) the run saved or published nothing (pipeline step or Save data failed), or the tests failed;
//  (b) AI rate limits / failed calls / a Tenixe billing error that happened in 2 runs in a row (streak in status.json).
// A single transient AI problem stays in data/status.json (the app's status box) and does not send an e-mail.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { confirmedKinds } from "../pipeline/lib.mjs";

const REPO = process.env.GITHUB_REPOSITORY || "MosStep/eventradar";
const LABEL = "pipeline-alert";
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" }).trim();

let status = null;
try { status = JSON.parse(fs.readFileSync("data/status.json", "utf8")); } catch {}
const pipeline = process.env.PIPELINE || "";
const save = process.env.SAVE || "";
const tests = process.env.TESTS || "";

// (a) hard failures: this run did not produce a published update, or the code is broken.
const hard = [];
if (pipeline && pipeline !== "success") hard.push(`ขั้นดึงงานจบด้วยสถานะ "${pipeline}" — รอบนี้ไม่ได้อัปเดตข้อมูล (ดู log ของรอบนี้)`);
if (save && save !== "success") hard.push(`ขั้นบันทึกข้อมูลจบด้วยสถานะ "${save}" — ข้อมูลรอบนี้ยังไม่ได้ขึ้นเว็บ`);
if (tests && tests !== "success") hard.push("ชุดทดสอบไม่ผ่าน — มีโค้ดส่วนใดส่วนหนึ่งทำงานผิดจากที่ควร");

// (b)/(c) AI problems: only when the pipeline ran (otherwise status.json is the previous run's) and the streak is confirmed.
const AI_TEXT = {
  rate: n => `AI ผู้ให้บริการไม่ว่าง (rate limit) ติดต่อกัน ${n} รอบ — ข้ามขั้น AI ไปบางส่วน`,
  failed: n => `เรียก AI ล้มเหลวเกินครึ่งหรือโควตาทุกคีย์หมด ติดต่อกัน ${n} รอบ`,
  billing: n => `คีย์ Tenixe ติดปัญหาค่าใช้จ่าย/ยอดค้างชำระ ติดต่อกัน ${n} รอบ — ต้องชำระที่ Tenixe หรือเปลี่ยนคีย์`,
};
const aiKinds = pipeline === "success" ? confirmedKinds(status?.streak) : [];
const soft = aiKinds.map(k => AI_TEXT[k](status.streak[k]));
const problems = [...hard, ...soft];

const run = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID || ""}`;
let open = [];
try { open = JSON.parse(gh("issue", "list", "-R", REPO, "--label", LABEL, "--state", "open", "--json", "number")); } catch {}

if (!problems.length) {
  for (const { number } of open) gh("issue", "close", String(number), "-R", REPO, "--comment", `กลับมาทำงานปกติแล้ว (${run})`);
  console.log("healthy");
  process.exit(0);
}

const keyHelp = soft.length ? `
### ถ้าต้องเปลี่ยนคีย์ AI
1. เปิด https://github.com/${REPO}/settings/secrets/actions
2. กดดินสอที่ \`TENIXE_KEYS\` (คีย์ทั่วไป คั่นด้วย ,) หรือ \`TENIXE_NEMOTRON_KEYS\` (คีย์ Nemotron ไม่จำกัด) หรือ \`AIU_KEYS\` (AIUnlimit)
3. วางคีย์ใหม่แล้วกด Update — รอบถัดไปจะใช้คีย์ใหม่เอง
` : "";
const body = `รอบอัตโนมัติพบปัญหา (${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC)

${problems.map(p => `- ${p}`).join("\n")}

ดูรายละเอียด: ${run}
${keyHelp}
เว็บยังเปิดได้ตามปกติ แค่ข้อมูลรอบนี้อาจไม่อัปเดต — issue นี้จะปิดเองเมื่อรอบถัดไปกลับมาปกติ`;

try { gh("label", "create", LABEL, "-R", REPO, "--color", "e5484d", "--description", "Automatic pipeline problem"); } catch {}
if (open.length) gh("issue", "comment", String(open[0].number), "-R", REPO, "--body", body);
else gh("issue", "create", "-R", REPO, "--title", "⚠️ EventRadar: รอบอัปเดตอัตโนมัติมีปัญหา", "--label", LABEL, "--body", body);
console.log("reported:", problems.join(" | "));
