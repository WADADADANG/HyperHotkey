# 📚 คู่มือเรียนรู้โปรไฟล์ตัวอย่าง (HyperHotkey Example Profiles Guide)

โปรไฟล์ตัวอย่างทั้งหมดในโฟลเดอร์นี้ (หมวด `[Ex]`) ถูกอ่านและตรวจสอบจากโครงสร้างไฟล์ JSON ทุกบรรทัดตรงตามความเป็นจริง 100% ครับ

---

## 📋 สารบัญโปรไฟล์ตัวอย่าง (Ex Profiles)

1. **`[Ex] 01. Single Key Loop.json`** — คำสั่ง `RM Heal` (กดปุ่ม 1 ทุก 3 วินาที)
2. **`[Ex] 02. Buff Sequence Queue.json`** — คำสั่ง `RM Full Buff` (กดบัฟเรียงคิว F2 ถึง F1 รวม 15 ปุ่ม เสร็จแล้วสลับคีย์ลัดสกิลกลับไปที่ F1)
3. **`[Ex] 03. Key Hold Toggle.json`** — คำสั่ง `Psy SpiritBomb` (กดปุ่ม 1 ค้างไว้ในเกม / ต้องเปิด Options > Game > Holding Keys ในเกม)
4. **`[Ex] 04. Pure Timer (Delay Only).json`** — คำสั่ง `Heal` ➔ `Wait 3 Sec` (หน่วง 3 วิ) ➔ `Buff GT`
5. **`[Ex] 05. Action Control (Stop_Start).json`** — คำสั่ง `AC Start (Toggle)` สลับเปิด-ปิดลูป `Heal Rain`
6. **`[Ex] 06. Action Branch (If-Else).json`** — คำสั่ง `Check Start` เช็คว่าลูป `Loop Start Heal Rain` รันอยู่หรือไม่ (ถ้ารันสั่งหยุด ถ้าหยุดสั่งรัน)
7. **`[Ex] 07. Key Forwarder.json`** — คำสั่ง `Forward Heal Rain (Client 1 & 2)` (กดปุ่ม 1 ที่จอหลัก ส่งปุ่ม 2 ไป Client 1 และ 2)
8. **`[Ex] 08. Cooldown Guard (Skill Guard).json`** — คำสั่ง `Barrier Of Life (Loop Buff)` (ดักคูลดาวน์สกิล Barrier Of Life กันหลุดจากสถานะเดินตาม/Follow)
9. **`[Ex] 09. Multi-Client Team Command.json`** — คำสั่ง `Multi Heal Rain` (กด Mouse 4 วนยิงปุ่ม 2 ไปทุกจอพร้อมกันทุก 3 วิ)
10. **`[Ex] 10. First Steps Prep (Pre-Loop).json`** — คำสั่ง `Heal & Buff GT (FirstSteps)` (ทำ First Steps: F1 สลับคีย์ลัดสกิล [0ms] ➔ ปุ่ม 6 [500ms] ก่อนเข้าลูปกดปุ่ม 1)

---

อ่านคู่มือฉบับเต็มได้ที่ไฟล์ `PROFILES_GUIDE.md` ในโฟลเดอร์หลักของโครงการครับ 🚀
