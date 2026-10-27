// Turns a failed or unhealthy scheduled run into a GitHub issue (GitHub e-mails it to the repo owner),
// and closes that issue once a later run is healthy again. Needs GH_TOKEN with issues: write.
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const REPO = process.env.GITHUB_REPOSITORY || "MosStep/eventradar";
const LABEL = "pipeline-alert";
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" }).trim();

let status = null;
try { status = JSON.parse(fs.readFileSync("data/status.json", "utf8")); } catch {}
const problems = [...(status?.problems || [])];
if (process.env.PIPELINE && process.env.PIPELINE !== "success") problems.push(`ขั้นดึงงานจบด้วยสถานะ "${process.env.PIPELINE}" (ดู log ของรอบนี้)`);
if (process.env.TESTS && process.env.TESTS !== "success") problems.push("ชุดทดสอบไม่ผ่าน — มีโค้ดส่วนใดส่วนหนึ่งทำงานผิดจากที่ควร");

const run = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID || ""}`;
let open = [];
try { open = JSON.parse(gh("issue", "list", "-R", REPO, "--label", LABEL, "--state", "open", "--json", "number")); } catch {}

if (!problems.length) {
  for (const { number } of open) gh("issue", "close", String(number), "-R", REPO, "--comment", `กลับมาทำงานปกติแล้ว (${run})`);
  console.log("healthy");
  process.exit(0);
}

const keyHelp = problems.some(p => /คีย์|โควตา|AI/.test(p)) ? `
### ถ้าต้องเปลี่ยนคีย์ AI
1. เปิด https://github.com/${REPO}/settings/secrets/actions
2. กดดินสอที่ \`TENIXE_KEYS\` (คีย์ทั่วไป คั่นด้วย ,) หรือ \`TENIXE_NEMOTRON_KEYS\` (คีย์ Nemotron ไม่จำกัด)
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
