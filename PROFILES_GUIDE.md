# 📚 คู่มือเรียนรู้โปรไฟล์ตัวอย่าง (HyperHotkey Example Profiles Guide)

ยินดีต้อนรับสู่คู่มือเรียนรู้โปรไฟล์ตัวอย่างของ **HyperHotkey**! 
เอกสารฉบับนี้อธิบายรายละเอียดตรงตามการตั้งค่าจริงในไฟล์โปรไฟล์ตัวอย่างหมวด `[Ex]` ทั้ง 10 ไฟล์อย่างแม่นยำครับ

---

## 📋 สารบัญโปรไฟล์ตัวอย่าง (Ex Profiles)

1. [📌 01. [Ex] 01. Single Key Loop](#1-ex-01-single-key-loop) — กดปุ่มเดิมรัวๆ ทุก 3 วินาที
2. [📌 02. [Ex] 02. Buff Sequence Queue](#2-ex-02-buff-sequence-queue) — กดบัฟทีละสกิลเรียงตามลำดับจนครบชุดแล้วหยุดเอง
3. [📌 03. [Ex] 03. Key Hold Toggle](#3-ex-03-key-hold-toggle) — กดปุ่มค้างแช่ไว้ (เช่น ใช้สกิลค้าง Psy SpiritBomb)
4. [📌 04. [Ex] 04. Pure Timer (Delay Only)](#4-ex-04-pure-timer-delay-only) — หน่วงเวลากดใช้บัฟหลังจากฮีล 1 ครั้ง
5. [📌 05. [Ex] 05. Action Control (Stop_Start)](#5-ex-05-action-control-stop_start) — ใช้สั่งเปิด-ปิด-สลับการทำงาน หรือสั่งหยุดคำสั่งอื่นกะทันหัน
6. [📌 06. [Ex] 06. Action Branch (If-Else)](#6-ex-06-action-branch-if-else) — เช็คสถานะการทำงานของแอคชั่นอื่น (ถ้าฮีลรันอยู่สั่งหยุด ถ้าหยุดอยู่สั่งรัน)
7. [📌 07. [Ex] 07. Key Forwarder](#7-ex-07-key-forwarder) — กดปุ่มที่จอหลัก แล้วส่งสัญญาณปุ่มข้ามไปยิงใส่จออื่นทันที
8. [📌 08. [Ex] 08. Cooldown Guard (Skill Guard)](#8-ex-08-cooldown-guard-skill-guard) — ดักกันกดซ้ำตอนสกิลติดคูลดาวน์ (ป้องกันตัวละครหลุดจากสถานะเดินตาม/Follow)
9. [📌 09. [Ex] 09. Multi-Client Team Command](#9-ex-09-multi-client-team-command) — สั่งงานทุกจอพร้อมกันในปุ่มเดียว (เช่น กดฮีลพร้อมกันทุกจอ)
10. [📌 10. [Ex] 10. First Steps Prep (Pre-Loop)](#10-ex-10-first-steps-prep-pre-loop) — ขั้นตอนเตรียมตัวก่อนเริ่มลูป (กดเลือกเป้าหมาย ➔ กดเปิดสกิล ➔ เข้าลูป)

---

### 1. [Ex] 01. Single Key Loop
- **ชื่อคำสั่ง (Action Name)**: `RM Heal`
- **โหมดการทำงาน (Mode)**: `loop`
- **ปุ่มกดเริ่ม (Trigger)**: `Mouse Button 4` (ปุ่มข้างเมาส์)
- **จอเป้าหมาย (Target Client)**: `Client 1`
- **ปุ่มที่ยิงลงเกม (Keys)**: `["1"]` (ปุ่ม 1 / สกิล Heal)
- **รอบเวลา (Interval)**: `3000ms` (3 วินาที)
- **การทำงาน**: กดปุ่มข้างเมาส์ (`Mouse 4`) บอทจะกดปุ่ม `1` ทันที 1 ครั้ง แล้ววนกดซ้ำทุกๆ 3 วินาทีไปเรื่อยๆ จนกว่าจะกดปุ่มข้างเมาส์ซ้ำอีกครั้งเพื่อสั่งหยุด

---

### 2. [Ex] 02. Buff Sequence Queue
- **ชื่อคำสั่ง (Action Name)**: `RM Full Buff`
- **โหมดการทำงาน (Mode)**: `buff_sequence`
- **ปุ่มกดเริ่ม (Trigger)**: `INSERT` (คีย์บอร์ด)
- **จอเป้าหมาย (Target Client)**: `Client 1`
- **ชุดปุ่มที่ยิงเรียงคิว (Keys)**: `F2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, F3, 1, 2, F1` (รวม 15 ปุ่ม)
- **หน่วงเวลาระหว่างบัฟ (delayBuff)**: `800ms` (0.8 วินาที)
- **การทำงาน**: เมื่อกดปุ่ม `INSERT` บอทจะกดปุ่มสกิลบัฟเรียงตามลำดับจนครบทั้ง 15 ปุ่ม โดยเว้นระยะห่างปุ่มละ 0.8 วินาที
เมื่อบัฟเสร็จแล้ว คีย์ลัดสกิลจะถูกสลับไปที่ F1 แล้วจะหยุดรันเองอัตโนมัติ

---

### 3. [Ex] 03. Key Hold Toggle
- **ชื่อคำสั่ง (Action Name)**: `Psy SpiritBomb`
- **โหมดการทำงาน (Mode)**: `key_hold`
- **ปุ่มกดเริ่ม (Trigger)**: `Mouse Button 4` (ปุ่มข้างเมาส์)
- **จอเป้าหมาย (Target Client)**: `Client 1`
- **ปุ่มเป้าหมายที่กดค้าง (Target Key)**: `ปุ่ม 1` (สกิล Psy SpiritBomb)
- **การทำงาน**: กดครั้งแรก ➔ บอทจะส่งคำสั่งกดปุ่ม `1` แช่ค้างไว้ในเกม ช่วยให้ผู้เล่นไม่ต้องกดปุ่มสกิลเองหมายเป้าหมาย / สามารถกดเดินได้ปกติ หากไม่มีเป้าหมาย (คุณต้องตั้งค่าเกมให้รองรับการกดปุ่มค้าง Options > Game > Holding Keys ปรับเป็น เปิดใช้งาน )

---

### 4. [Ex] 04. Pure Timer (Delay Only)
- **คำสั่งที่มีในโปรไฟล์ (Actions)**: `Heal` ➔ `Wait 3 Sec` ➔ `Buff GT`
- **โหมดและการตั้งค่า**:
  1. `Heal`: Mode `single_press`, Trigger: `Mouse 4`, Key: `["1"]`, สายโซ่ `onFired` ➔ `Wait 3 Sec`
  2. `Wait 3 Sec`: Mode `delay_only`, หน่วงเวลา `delayMs: 3000` (3 วินาที), สายโซ่ `onComplete` ➔ `Buff GT`
  3. `Buff GT`: Mode `single_press`, Trigger: `none`, Key: `["6"]`
- **การทำงาน**: กดปุ่มข้างเมาส์ ➔ ยิงปุ่ม `1` (Heal) ➔ บอทรอนับเวลาถอยหลัง 3 วินาที (รอแอนิเมชั่นฮีลจบ) ➔ พอครบ 3 วินาที จะยิงปุ่ม `6` (Buff GT) ต่อให้อัตโนมัติ

---

### 5. [Ex] 05. Action Control (Stop_Start)
- **คำสั่งที่มีในโปรไฟล์ (Actions)**: `AC Start (Toggle)` และ `Heal Rain`
- **โหมดและการตั้งค่า**:
  1. `AC Start (Toggle)`: Mode `control`, Trigger: `Mouse 4`, Operation: `toggle`, เป้าหมาย: `Heal Rain`
  2. `Heal Rain`: Mode `loop`, Trigger: `none`, Key: `["1"]`, Interval: `1000ms`
- **การทำงาน**: กดปุ่มข้างเมาส์ที่คำสั่ง `AC Start (Toggle)` ➔ บอทจะส่งคำสั่งสลับไปสั่งให้ลูป `Heal Rain` เริ่มทำงาน (หรือสั่งหยุดรันทันทีถ้ากำลังรันอยู่)

---

### 6. [Ex] 06. Action Branch (If-Else)
- **คำสั่งที่มีในโปรไฟล์ (Actions)**: `Check Start`, `Loop Start Heal Rain`, `AC Stop Hean Rain`
- **โหมดและการตั้งค่า**:
  1. `Check Start`: Mode `branch`, Trigger: `Mouse 4`, เช็คเป้าหมาย `Loop Start Heal Rain` เงื่อนไข `is_running`
     - ถ้าทำงานอยู่ (`onTrue`) ➔ รันคำสั่ง `AC Stop Hean Rain` (สั่งหยุดลูป)
     - ถ้าไม่ได้ทำงาน (`onFalse`) ➔ รันคำสั่ง `Loop Start Heal Rain` (สั่งเริ่มลูป)
  2. `Loop Start Heal Rain`: Mode `loop`, Key: `["2"]`, Interval: `3000ms`
  3. `AC Stop Hean Rain`: Mode `control`, Operation: `stop`, เป้าหมาย: `Loop Start Heal Rain`
- **การทำงาน**: กดปุ่มข้างเมาส์ ➔ บอทเช็คสถานะของ `Loop Start Heal Rain` ถ้ารันอยู่จะสั่งหยุด ถ้าหยุดอยู่จะสั่งเริ่มรัน

---

### 7. [Ex] 07. Key Forwarder
- **ชื่อคำสั่ง (Action Name)**: `Forward Heal Rain (Client 1 & 2)`
- **โหมดการทำงาน (Mode)**: `forward`
- **ปุ่มกดเริ่ม (Trigger)**: `ปุ่ม 1` (คีย์บอร์ด)
- **จอเป้าหมาย (Target Client)**: `Client 1, 2` (`"1,2"`)
- **ปุ่มเป้าหมายที่ส่งข้าม (Target Key)**: `ปุ่ม 2` (สกิล Heal Rain)
- **การทำงาน**: ขณะเล่นอยู่ที่จอหลัก พอกดปุ่ม `1` ที่คีย์บอร์ด ➔ บอทจะส่งต่อสัญญาณปุ่ม `2` ข้ามไปยิงใส่ **Client 1 และ Client 2** พร้อมกันทันที

---

### 8. [Ex] 08. Cooldown Guard (Skill Guard)
- **ชื่อคำสั่ง (Action Name)**: `Barrier Of Life (Loop Buff)`
- **โหมดการทำงาน (Mode)**: `loop`
- **ปุ่มกดเริ่ม (Trigger)**: `Mouse Button 4` (ปุ่มข้างเมาส์)
- **จอเป้าหมาย (Target Client)**: `Client 1`
- **ปุ่มที่ยิงลงเกม (Keys)**: `["8"]` (สกิล Barrier Of Life)
- **รอบเวลา (Interval)**: `1000ms` (1 วินาที)
- **ชุดคูลดาวน์สกิล (cooldownPresetId)**: `skill_ringmaster_barrier-of-life` ( Barrier Of Life )
- **การทำงาน**: กดปุ่มข้างเมาส์ ➔ บอทจะรันลูปยิงปุ่ม `8` แต่จะถูกระบบ **Skill Cooldown Guard** ดักตรวจคูลดาวน์ของสกิล Barrier Of Life ไว้ หากสกิลยังติดคูลดาวน์ บอทจะดักข้ามคำสั่งยิงปุ่ม เพื่อป้องกันไม่ให้ยิงปุ่มขยะไปรบกวนสถานะการเดินตาม (Follow) ของตัวละคร

---

### 9. [Ex] 09. Multi-Client Team Command
- **ชื่อคำสั่ง (Action Name)**: `Multi Heal Rain`
- **โหมดการทำงาน (Mode)**: `loop`
- **ปุ่มกดเริ่ม (Trigger)**: `Mouse Button 4` (ปุ่มข้างเมาส์)
- **จอเป้าหมาย (Target Client)**: `All Clients` (`"all"`)
- **ปุ่มที่ยิงลงเกม (Keys)**: `["2"]` (สกิล Heal Rain)
- **รอบเวลา (Interval)**: `3000ms` (3 วินาที)
- **การทำงาน**: กดปุ่มข้างเมาส์ (`Mouse 4`) ➔ บอทจะวนยิงปุ่ม `2` (Heal Rain) ลงไปในเบราว์เซอร์ทุกจอที่เชื่อมต่ออยู่พร้อมกันทุกๆ 3 วินาทีอัตโนมัติ

---

### 10. [Ex] 10. First Steps Prep (Pre-Loop)
- **ชื่อคำสั่ง (Action Name)**: `Heal & Buff GT (FirstSteps)`
- **โหมดการทำงาน (Mode)**: `loop` + `First Steps`
- **ปุ่มกดเริ่ม (Trigger)**: `Mouse Button 4` (ปุ่มข้างเมาส์)
- **ขั้นตอนเริ่มต้น (First Steps)**: 
  1. กดปุ่ม `F1` (สลับคีย์ลัดสกิล) ➔ `delay: 0` (หน่วง 0ms)
  2. กดปุ่ม `6` (สกิล Buff GT) ➔ `delay: 500` (หน่วง 500ms)
- **ปุ่มลูปหลัก (Keys)**: `["1"]` (สกิล Heal, รอบเวลา `3000ms`)
- **การทำงาน**: เมื่อกดปุ่มข้างเมาส์ ➔ บอทจะกด `F1` (สลับคีย์ลัดสกิล) ➔ จากนั้นกด `ปุ่ม 6` (Buff GT) หน่วงเวลา 500ms ➔ เมื่อทำ First Steps ทั้ง 2 ขั้นตอนจบแล้ว ถึงจะเริ่มวนกด `ปุ่ม 1` ทุกๆ 3 วินาทีเป็นลูปหลัก

---

💡 **ทริคแนะนำ**: สามารถเลือกโปรไฟล์ตัวอย่างเหล่านี้ในเมนูด้านบนของโปรแกรมเพื่อดูการตั้งค่าจริง และกด **คัดลอกโปรไฟล์ (Clone Profile)** ไปใช้งานได้ทันทีครับ! 🚀
