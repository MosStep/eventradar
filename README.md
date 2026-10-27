# EventRadar

ปฏิทินรวมงานอีเวนต์ออฟไลน์ในไทย ญี่ปุ่น และจีน: อนิเมะ เกม แฟนมีต คอนเสิร์ต AI เปิดตัวรถ และอื่นๆ
ระบบอัปเดตเองวันละ 4 รอบ (00:00 / 06:00 / 12:00 / 18:00 เวลาไทย)

## ทำงานยังไง
1. `pipeline/run.mjs` ดึงหัวข่าวจาก Bing News และ Google News RSS ตามคำค้นใน `pipeline/sources.mjs`
2. ตัดหัวข่าวที่ไม่ใช่งานอีเวนต์ทิ้ง แล้วส่งให้ AI (claude-haiku-5-5 ผ่าน Tenixe) ทีละ 20 ข่าว เพื่อดึงข้อมูลงาน
3. รวมงานซ้ำเป็นรายการเดียว ดึงโปสเตอร์และลิงก์เว็บไซต์งานจากบทความข่าว แล้วบันทึกลง `data/events.json`
4. GitHub Actions (`.github/workflows/daily.yml`) รันตามเวลาที่ตั้งไว้ และเผยแพร่แอปขึ้น GitHub Pages

## หมวดหมู่
แก้ไขได้ที่ `web/taxonomy.json` (หมวด → แท็กย่อย) ถ้าเพิ่มแท็กใหม่ ต้องเพิ่มคำค้นของแท็กนั้นใน `pipeline/sources.mjs` ด้วย

## รันในเครื่อง
```bash
TENIXE_KEYS=txc_... node pipeline/run.mjs --window=1d
node serve.mjs   # เปิด http://localhost:5173
```
คีย์ใส่ผ่านตัวแปรสภาพแวดล้อม (environment variable) หรือ GitHub Secret ชื่อ `TENIXE_KEYS` เท่านั้น ห้ามใส่ไว้ในไฟล์
