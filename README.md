# HyperHotkey

เครื่องมือช่วยกดปุ่มคีย์บอร์ดและเมาส์ในเบราว์เซอร์อัตโนมัติแบบพื้นหลัง เหมาะสำหรับเกม WebGL เช่น Flyff Universe รองรับหลายจอพร้อมกัน

---

## ความสามารถหลัก

| Feature | รายละเอียด |
|---------|-----------|
| Background Control | ส่งปุ่มเข้าแท็บเกมพื้นหลัง ไม่ต้องโฟกัส ไม่แย่งเมาส์ |
| Multi-Client (1-8) | เปิดเบราว์เซอร์ได้ 1-8 จอ แยก Session อิสระ |
| Loop | วนกดปุ่มซ้ำตามเวลาที่กำหนด เช่น ฮีลอัตโนมัติ |
| Buff Sequence | กดปุ่มเรียงชุดพร้อมตั้งดีเลย์ |
| Single Press | กดปุ่มครั้งเดียวเมื่อกดปุ่มลัด |
| Key Forwarder | Remap กดค้าง/ปล่อย 1-to-1 ไปจอเป้าหมาย |
| Toggle Key Hold | กดค้างปุ่มพื้นหลังแบบสลับ On/Off |
| Desktop Overlay | หน้าต่างลอยแสดงสถานะบอทแต่ละจอแบบเรียลไทม์ ลากย้ายได้ |
| Client Aliases | ตั้งชื่อจอ เช่น `RM`, `Knight` แสดงบน Overlay และ Tab |
| Key Recorder | คลิกช่องแล้วกดปุ่มจริงเพื่อบันทึกค่าอัตโนมัติ |
| Human-Like Jitter | สุ่ม Delay กดปุ่มเลียนแบบมนุษย์ ป้องกันการโดนแบน |

---

## การติดตั้ง

1. ติดตั้ง **Node.js v18+** จาก [nodejs.org](https://nodejs.org/)
2. ติดตั้ง **Python 3.x** จาก [python.org](https://www.python.org/) — **ต้องติ๊ก "Add Python to PATH"**
3. ดับเบิลคลิก `1 install.bat`
4. ดับเบิลคลิก `2 playwright install.bat`

---

## วิธีใช้งาน

1. ดับเบิลคลิก `3 start.bat` หรือรัน `npm start`
2. ระบุหมายเลขจอที่ต้องการเปิด เช่น `1` หรือ `1-3` หรือ `2,4` แล้วเลือก Browser
3. บอทจะเปิดเกมและล็อกแท็บเป้าหมายให้อัตโนมัติ
4. ตั้งค่าและจัดการ Action ได้ผ่าน **[http://localhost:3000](http://localhost:3000)**
   - บันทึกซิงค์เรียลไทม์ ไม่ต้องรีสตาร์ท
   - เปิด Desktop Overlay ได้ในหน้าตั้งค่า

---

## 🛡️ ความปลอดภัยและการตรวจจับ

**ข้อดีที่ปลอดภัยกว่า Bot ทั่วไป:**

- ✅ ใช้ **Firefox** → ไม่มี `navigator.webdriver = true` ที่ Chromium-based bot มักติดมา
- ✅ ส่งปุ่มผ่าน `keyboard.down/up` ระดับ CDP ซึ่งเหมือน input จริง ไม่ใช่ JS inject
- ✅ มี **Human-Like Jitter** สุ่ม delay ป้องกัน timing pattern ซ้ำๆ
- ✅ เกมยังคิดว่า tab มี focus อยู่ตลอด (Playwright ไม่ทำให้ tab ดู hidden)
- ✅ มี **Ghost Mouse Jitter** สุ่มขยับเมาส์เล็กน้อยในแท็บเกมเพื่อสร้าง `mousemove` event ป้องกันการตรวจจับ (cursor บนหน้าจอจริงไม่ขยับ แต่ใน**เกมจะเห็นเมาส์ขยับเล็กน้อย**)

**สิ่งที่ยังอาจตรวจจับได้:**

- ⚠️ **Interval สม่ำเสมอเกินไป** หาก Jitter ตั้งน้อยเกินไป ควรตั้งอย่างน้อย 200-500ms

> **หมายเหตุ:** Flyff Universe ใช้ Anti-Cheat ฝั่ง Client-Side ตรวจ Memory injection และ DLL หลัก ไม่ได้เน้น browser fingerprinting มากนัก ความเสี่ยงจริงๆ มาจาก **pattern การกดปุ่มที่ไม่เป็นธรรมชาติ** และ **IP ที่ใช้ซ้ำหลายจอ** มากกว่า
