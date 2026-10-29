# EventRadar — สิ่งที่ยังไม่ได้ทำ และสิ่งที่เจ้าของต้องตั้งค่าเอง

## ต้องตั้งค่าเอง (ระบบความปลอดภัยไม่ให้ AI ทำแทน)

### 1. ให้รอบดึงงานบนคอมเปิดเองทุกครั้งที่เปิดคอม (Windows Task Scheduler)
ใส่คีย์ไว้ในตัวแปรของผู้ใช้ Windows ครั้งเดียว (ค่าเก็บในเครื่องนี้ ไม่ได้อยู่ในไฟล์โปรเจกต์) แล้วสร้างงานตั้งเวลา
เปิด PowerShell แล้วรันทีละบรรทัด:
```powershell
setx TENIXE_NEMOTRON_KEYS "txc_คีย์รายเดือน"
setx TENIXE_KEYS "txc_คีย์หลัก,txc_คีย์ฟรี1,txc_คีย์ฟรี2"
$a = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "D:\calender\scripts\loop.ps1"' -WorkingDirectory "D:\calender"
$t = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName "EventRadar loop" -Action $a -Trigger $t -Settings $s
Start-ScheduledTask -TaskName "EventRadar loop"
```
- ดู log ได้ที่ `%LOCALAPPDATA%\EventRadar\loop.log`
- ถ้าจะหยุดถาวร: `Unregister-ScheduledTask -TaskName "EventRadar loop"`
- สคริปต์กันไม่ให้มีรอบดึงงานซ้อนกันสองชุดอยู่แล้ว

### 2. สรุปงานประจำสัปดาห์ทาง LINE (ทุกวันศุกร์ 18:00)
1. สมัคร LINE Official Account ที่ https://manager.line.biz (ฟรี แพ็กเกจฟรีส่งได้ราว 300 ข้อความต่อเดือน นับตามจำนวนคนที่ได้รับ)
2. ใน LINE Official Account Manager → ตั้งค่า → Messaging API → เปิดใช้งาน
3. ไปที่ https://developers.line.biz → เลือก channel → แท็บ Messaging API → กด Issue ที่ "Channel access token (long-lived)"
4. ไปที่ https://github.com/MosStep/eventradar/settings/secrets/actions → New repository secret → ชื่อ `LINE_CHANNEL_TOKEN` → วาง token
5. ให้เพื่อนแอด LINE OA นั้น — ทุกวันศุกร์ระบบจะส่งการ์ดงาน 7 วันข้างหน้า (สูงสุด 10 งาน) ให้ทุกคน
6. ทดสอบได้ทันทีที่ https://github.com/MosStep/eventradar/actions/workflows/weekly-line.yml → Run workflow

### 3. เปลี่ยนคีย์ AI เมื่อระบบแจ้งว่าคีย์มีปัญหา
เมื่อรอบอัตโนมัติพบปัญหา (ดึงข่าวไม่ได้, คีย์หมดโควตา, ค้างชำระ, ชุดทดสอบไม่ผ่าน) ระบบจะเปิด issue ใน GitHub ซึ่ง GitHub
จะส่งอีเมลหาเจ้าของ repo เอง ในอีเมลมีลิงก์ไปที่หน้าใส่คีย์ใหม่:
https://github.com/MosStep/eventradar/settings/secrets/actions
(ไม่ทำช่องกรอกคีย์ในหน้าเว็บ เพราะเว็บเป็นสาธารณะ ใครก็กรอกได้ — หน้า Secrets ของ GitHub คือช่องกรอกที่ปลอดภัย)

### 4. สั่งรอบดึงงานให้ทำงานต่อโดยไม่ต้องเปิด Claude
- เริ่ม: `powershell -NoProfile -ExecutionPolicy Bypass -File D:calenderscriptsstart-loop.ps1` (รันในหน้าต่างซ่อน ปิดเทอร์มินัลหรือ Claude แล้วยังทำงานต่อ ถ้ารันอยู่แล้วจะไม่เปิดซ้ำ)
- หยุด: `powershell -NoProfile -ExecutionPolicy Bypass -File D:calenderscriptsstop-loop.ps1` (หยุดรอบที่กำลังทำงานและตัวลูป)
- ดู log ที่ `%LOCALAPPDATA%EventRadarloop.log`
- ตอนมีคีย์ AIUnlimit ขั้นตอนเสริมข้อมูล (รายละเอียด วันที่ ราคา ตรวจซ้ำ แยกรายการ) ทำมากขึ้น 6 เท่า เรียงตามไทยก่อน แล้วงานที่ใกล้ที่สุด แล้วหมวดที่ชอบ และจะไม่เริ่มเรียก AI ในช่วง 5 นาทีสุดท้ายของเวลาที่ตั้งไว้

## แหล่งข้อมูลที่ยังไม่ได้ทำ

### Eventpop (ไทย) — ได้แค่ 9 งาน
- endpoint สาธารณะ `https://www.eventpop.me/api/v1/events` ส่งมาเฉพาะงานแนะนำ ไม่มีค้นหา/แบ่งหน้า
- ต้องใช้เบราว์เซอร์จำลอง (Playwright) ดึงหน้า `https://www.eventpop.me/explore` — ทำได้บน GitHub Actions แต่ต้องอ่านข้อตกลงการใช้งานของ Eventpop ก่อน

### Ticketmelon, ThaiTicketMajor (ไทย)
- ยังไม่ได้เริ่ม ต้องเปิดหน้ารายการงานใน DevTools ดูแท็บ Network ว่าเรียก API ตัวไหน ถ้าไม่มีต้องใช้ Playwright

### otabase.net
- เว็บรวมงานอีเวนต์ป๊อปคัลเจอร์ที่มีวันที่ สถานที่ และราคาบัตร (เจอตอนค้นราคา) — น่าจะเป็นแหล่งที่ดีมาก ยังไม่ได้ตรวจว่ามีงานกี่งาน/ดึงได้ไหม

### allcpp.cn, 秀动 showstart, 喵特 nyato (จีน)
- ตอนนี้ใช้ Bilibili 会员购 ซึ่งได้ราว 20 งานต่อครั้ง (รายการวนซ้ำหลังหน้าแรกๆ)
- showstart: ใช้ RSSHub `/showstart/event/:cityCode/:showStyle?` · allcpp: ต้องใช้ Playwright
- เว็บจีนบางเว็บบล็อก IP ต่างประเทศ (GitHub Actions อยู่สหรัฐฯ)

### Walkerplus, connpass (ญี่ปุ่น)
- connpass API v2 ต้องขอ API key · Walkerplus ต้องดึงจากหน้าเว็บ

## ฟีเจอร์ที่ยังไม่ได้ทำ
- **แจ้งข้อมูลผิดโดยไม่ต้องมีบัญชี GitHub**: ตอนนี้ปุ่มพาไปเปิด issue ใน GitHub (ต้องมีบัญชี) ถ้าอยากให้ทุกคนแจ้งได้ ให้สร้าง Google Form แล้วบอก AI ให้เปลี่ยน `REPORT_URL` ใน `web/app.js`
- **เปิดดูได้ตอนไม่มีเน็ต**: เพิ่ม service worker เก็บไฟล์แอปกับ `events.json` (งานเล็ก)
- **แจ้งเตือน push ตอนปิดแอป**: ต้องมีเซิร์ฟเวอร์ push หรือใช้ LINE (ดูข้อ 2 ด้านบน)
- **ระบบล็อกอิน/ซิงก์ข้ามเครื่อง**: ตอนนี้ใช้ "สำรอง / ย้ายเครื่อง" (ลิงก์) แทน

## ข้อจำกัดที่ควรรู้
- **คุณภาพข้อมูล**: Nemotron คัดงาน แล้ว Haiku ตรวจซ้ำรอบละ 20 งาน เรียงจากงานเสี่ยงที่สุดก่อน (มาจากข่าวเดียว ไม่มีสถานที่ วันที่ห่างจากวันข่าวมาก ใกล้วันจัด) งานที่ยังไม่ได้ตรวจอาจมีจุดผิด
- **ค่าเข้า**: มาจากข่าว เว็บขายบัตร หรือการค้นเว็บ (DuckDuckGo) — ไม่เดาเอง และมีลิงก์ "ที่มา"
- **การค้นราคา**: DuckDuckGo อาจบล็อกถ้าค้นถี่ ระบบเว้นระยะไว้แล้ว
