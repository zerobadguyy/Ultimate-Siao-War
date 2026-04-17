# Deploy แบบฟรี

## 1. เตรียม Supabase

1. สร้างโปรเจกต์ฟรีใน Supabase
2. เปิด SQL Editor
3. วางไฟล์ [supabase/schema.sql](D:/card-game%20-%20Copy/supabase/schema.sql) แล้วกด Run
4. ไปที่ Project Settings > API
5. คัดลอกค่า `Project URL`
6. คัดลอกค่า `service_role` key

## 2. เตรียมไฟล์เสียงและเพลง

วางไฟล์เหล่านี้ใน [assets/audio](D:/card-game%20-%20Copy/assets/audio)

- `index.mp3`
- `game.mp3`
- `bethwin.mp3`
- `jowin1.mp3`
- `japink.mp3`
- และไฟล์เสียงอื่นที่เกมใช้อยู่

วางไฟล์รูปฉากชนะใน [assets/images](D:/card-game%20-%20Copy/assets/images)

- `bethwin.png`
- `jowin1.png`
- `japink.png`

## 3. ขึ้น Render

1. เอาโปรเจกต์นี้ขึ้น GitHub
2. เข้า Render แล้วเลือก New > Blueprint
3. เลือก repo นี้
4. Render จะอ่านไฟล์ [render.yaml](D:/card-game%20-%20Copy/render.yaml) ให้
5. ใส่ env:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. กด Deploy
7. เมื่อขึ้นเสร็จ Render จะให้ลิงก์เว็บ เอาลิงก์นั้นส่งให้เพื่อนเล่นได้เลย

## 4. ขึ้น Koyeb

1. เอาโปรเจกต์นี้ขึ้น GitHub
2. เข้า Koyeb แล้วเลือก Create App
3. เลือก GitHub repo นี้
4. เลือก build จาก [Dockerfile](D:/card-game%20-%20Copy/Dockerfile)
5. ใส่ env:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Deploy แล้วรอระบบสร้าง public URL
7. เอา URL ที่ได้ส่งให้เพื่อนเล่น

## 5. หมายเหตุ

- ถ้าไม่ได้ใส่ค่า Supabase เกมจะ fallback ไปใช้ไฟล์ `data/stats.json` ในเครื่อง
- ถ้าจะให้เพื่อนเล่นได้แม้เราปิดคอม ต้อง deploy ขึ้น Render หรือ Koyeb เท่านั้น ไม่ควรรันจากเครื่องเราเอง
