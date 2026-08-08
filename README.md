# 🚀 HyperHotkey (v2.2.0) - Background WebGL Multi-Client Automation Suite

เครื่องมืออัตโนมัติช่วยกดปุ่มคีย์บอร์ดและเมาส์ในเบราว์เซอร์แบบพื้นหลัง (Background Automation) ออกแบบมาสำหรับเกม HTML5 / WebGL เช่น **Flyff Universe** รองรับหลายจอพร้อมกัน ไม่แย่งเมาส์ ไม่กวนการทำงานของคอมพิวเตอร์

---

## 🔥 ความสามารถหลัก (Features)

| Feature | รายละเอียด |
|---------|-----------|
| 🎮 **Client Control Center (1-8)** | สั่งเปิด (`Launch`), สลับหยุดชั่วคราว (`Pause`), หรือปิด (`Close`) แต่ละจอได้อย่างอิสระผ่าน Web Dashboard |
| 🛡️ **Per-Client Anti-Detect & Proxy** | ตั้งค่า **User-Agent** สุ่ม และใส่ **HTTP/SOCKS5 Proxy IP** แยกประจำแต่ละจอได้อิสระ ป้องกันการโดนตรวจจับ IP ซ้ำ |
| 🌐 **Background Control** | ส่งปุ่มเข้าแท็บเกมพื้นหลังแบบ CDP Input แท้ เกมคิดว่าเปิดจออยู่ตลอดเวลา ไม่แย่งเมาส์ |
| ⚡ **8 Multi-Action Modes** | รองรับ **Loop** (กดวนซ้ำ + First Steps), **Buff Sequence** (กดสกิลตามคูลดาวน์), **Single Key Press**, **Timer / Delay**, **Key Forwarder**, **Key Hold**, **Action Control**, และ **Branch (If / Else)** |
| 🌿 **Condition Branch (If / Else)** | ตรวจสอบสถานะ Action อ้างอิงแล้วแยกสายการทำงาน (`onTrue` / `onFalse`) ช่วยควบคุมลูปได้อย่างชาญฉลาด |
| 🔍 **Profile Integrity Inspector & 1-Click Auto-Fix** | ระบบสแกนหาข้อผิดพลาดในโปรไฟล์ (ปุ่ม Trigger ชนกัน, สาย Chain ขาด, ลืมเลือกเป้าหมาย) พร้อมปุ่ม **`⚡ Auto-Fix`** ซ่อมแซมอัตโนมัติใน 1 คลิก |
| 🔗 **Action Chaining & Cooldown Guards** | ตั้งค่าลูกโซ่เชื่อม Action อัตโนมัติ พร้อมระบบเช็ค Cooldown และ Cooldown Presets ป้องกันกดทับซ้อน |
| 🖱️ **Ghost Mouse Jitter** | สุ่มขยับเมาส์ในแท็บเกมพื้นหลังเพื่อสร้าง `mousemove` event หลีกเลี่ยง AFK Detection |
| 🖥️ **Single-Instance Desktop Overlay** | หน้าต่างลอยแสดงสถานะ Real-time ติดตามบอท ลากย้ายได้ พร้อมระบบ Socket Lock ป้องกันหน้าต่างซ้อน |
| 📂 **Modular Config (configs/)** | แยกเก็บไฟล์ตั้งค่า `configs/global.json` (ค่าระบบ/Proxy) และ `configs/profiles/*.json` (ไฟล์ละ 1 โปรไฟล์) แชร์โปรไฟล์ขึ้น GitHub ง่าย ปลอดภัย ไม่ปะปนกับ IP ส่วนตัว |

---

## 🛠️ การติดตั้ง (Installation)

1. ติดตั้ง **Node.js v18+** จาก [nodejs.org](https://nodejs.org/)
2. ติดตั้ง **Python 3.x** จาก [python.org](https://www.python.org/) *(ต้องติ๊ก "Add Python to PATH")*
3. ดับเบิลคลิก `1 install.bat` *(รอจนขึ้น Press any key แล้วกดปิด)*
4. ดับเบิลคลิก `2 playwright install.bat` *(รอจนขึ้น Press any key แล้วกดปิด)*

---

## 💡 วิธีใช้งาน (Usage)

### 🚀 วิธีรันใช้งาน (เลือกได้ 2 แบบตามความสะดวก)

- **วิธีที่ 1 (แนะนำสำหรับผู้ใช้ทั่วไป):** ดับเบิลคลิก **`HyperHotkey Launcher.bat`** (หรือ `launcher.pyw`)
  - ระบบจะเด้งหน้าต่างโปรแกรมสีเข้มสวยงาม **ไร้หน้าต่างดำ CMD** พร้อมเปิดหน้าเว็บ Dashboard ให้อัตโนมัติทันที!
- **วิธีที่ 2 (สำหรับสายพัฒนา/CMD):** ดับเบิลคลิก `3 start.bat` หรือรัน `npm start`

---

1. เปิดหน้าเว็บควบคุม **[http://localhost:3000](http://localhost:3000)**
2. ตั้งค่า Proxy IP / User-Agent ประจำจอ (ถ้ามี) แล้วกดปุ่ม **`➕ Launch`** บนการ์ดจอนั้นๆ เพื่อเปิดเกมได้ทันที!
3. ปรับแต่งโปรไฟล์คำสั่ง และกดปุ่ม **`🔍 Validate Profile`** เพื่อสแกนตรวจสอบความถูกต้อง และกดปุ่มลอย **`💾`** เพื่อบันทึกใช้งาน!

---

## 🛡️ ความปลอดภัยและการหลบเลี่ยงการตรวจจับ (Anti-Detection)

- ✅ **Firefox CDP Layer:** ไร้ร่องรอย `navigator.webdriver = true` ที่ระบบป้องกันส่วนใหญ่ใช้ตรวจจับ
- ✅ **CDP Native Key Events:** ส่งคำสั่งกดค้าง/ปล่อยผ่าน Playwright CDP ระดับเบราว์เซอร์ เหมือนคนกดจริง
- ✅ **Human-Like Jitter:** สุ่มเวลา Delay และ Hold Time อัตโนมัติ ป้องกัน Pattern การกดที่สม่ำเสมอเกินไป
- ✅ **Per-Client Proxy & UA Fingerprint:** สุ่ม User-Agent และแยก IP Address อิสระในแต่ละจอ
