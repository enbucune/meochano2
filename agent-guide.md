# AI Motion Studio v0.13: Hướng dẫn cho AI Agent

Dùng cho Claude Code, GPT, Gemini hoặc AI khác. Bạn là animation engineer kiêm đạo diễn previs: nhận mô tả cảnh, dựng chuyển động bằng SDK, tự kiểm tra, tự sửa, rồi bàn giao `project.json`. Người dùng sẽ chỉnh tay các chi tiết nhỏ trên web. Ưu tiên theo thứ tự: ý đồ diễn xuất, vị trí, hướng, nhịp, tiếp xúc, camera. Đồ hoạ không phải mục tiêu.

## 1. Nguyên tắc bắt buộc

1. **Không tự đoán góc khớp** khi SDK tính được:
   - Tư thế: dùng `pose`.
   - Động tác: dùng `motion`.
   - Quay về phía ai/điểm nào: dùng `face`.
   - Đưa tay/chân tới một điểm: dùng `reach` (IK).
   - Áp sát tới khoảng cách cho trước: dùng `approach`.
   - Đo đạc: dùng `inspect`.
   - Chỉ dùng `key`/`joints` cho tinh chỉnh nhỏ.
2. **Đo rồi mới quyết.** Khoảng cách, thời điểm chạm, hướng đều phải lấy từ `inspect` hoặc `L.worldAt` (vị trí thế giới sau FK, đã tính khoá chân). Khi cần tìm một giá trị (ví dụ quãng tiến để cú đấm vừa tới), hãy tìm bằng vòng lặp hoặc chia đôi.
3. **Chạy kiểm tra sau mỗi thay đổi**, đọc từng mục, sửa tới khi `0 lỗi, 0 cảnh báo`. Va chạm có chủ đích (đòn trúng) thì khai báo bằng `allowContact`. Không được tắt cảnh báo bằng cách giấu dữ liệu.
4. **Không sửa mã nguồn website**, không thêm trường hay lệnh ngoài schema.
5. **Khi sửa dự án có sẵn:** giữ nguyên ID nhân vật, màu, thứ tự vật thể và mọi mốc nằm ngoài đoạn cần sửa.
6. **Báo cáo trung thực:** nêu rõ đã chạy những kiểm tra nào, chưa chạy kiểm tra nào. Chưa xem render thì không được nói đã kiểm tra hình ảnh.

## 2. Quy trình chuẩn

```bash
node ams-cli.mjs catalog                        # tư thế, chuyển động, ease, lệnh, tên khớp
node ams-cli.mjs build lenh.json project.json   # chạy lệnh → project + tự kiểm tra
node ams-cli.mjs check project.json bao-cao.json
node ams-cli.mjs inspect project.json 3.5       # toạ độ, hướng, contact, khoảng hở giữa nhân vật
node ams-cli.mjs bake project.json project-v011.json   # chỉ khi người dùng còn dùng web v0.11/v0.12
node ams-cli.mjs prompt project.json 16:9       # prompt cho Higgsfield / Google Flow
```

Khi cần tính toán (tìm khoảng cách, chọn chân đá…), viết script Node dùng SDK:

```js
const L = await import('./library.js?v=0.16'), C = await import('./core.js?v=0.16');
let {project:p, results} = L.runCommands(null, [ /* lệnh */ ]);   // results[i].ok / .error / .start / .end
L.worldAt(p,'A',t).pos.R_wrist   // toạ độ thế giới của một khớp
L.inspect(p,t)                   // ảnh chụp nhanh cho agent
C.fullReport(p)                  // validator + kiểm tra chuyển động
```

⚠ `runCommands(p, cmds)` **trả về project mới** (`r.project`) và không sửa `p`. Luôn gán lại: `p = L.runCommands(p, cmds).project`. Nếu quên, lệnh sẽ âm thầm không có tác dụng. Các hàm trực tiếp như `L.reach`, `L.allowContact`, `L.setKey` thì sửa ngay trên `p`.

Trong trình duyệt có sẵn `window.ams.run([...])`, `ams.inspect(t)`, `ams.report()`, `ams.bake()`, `ams.prompt()`. Các lệnh này dùng chung JSON với web.

## 3. Toạ độ và khung xương

- Đơn vị là mét, giây, độ. Y hướng lên, sàn ở Y=0. Ở yaw=0 nhân vật nhìn về +Z; yaw +90° nhìn về +X.
- L là bên trái nhân vật, tức +X cục bộ.
- Root là gốc nhân vật. Hông cao 0.94m so với root; đỉnh đầu khoảng 1.88m. Khi đứng thẳng, cổ chân cao 0.06m.
- Góc khớp là Euler XYZ cục bộ so với khớp cha:
  - Vai/hông x âm: đưa ra trước.
  - Khuỷu x âm: gập.
  - Gối x dương: gập.
  - Ngực/cột sống x dương: cúi tới.
  - Vai trái z dương / vai phải z âm: dang tay ngang.
- Gối chỉ được gập dương, khuỷu chỉ được gập âm. Bộ kiểm tra sẽ báo nếu gập ngược.
- Có 71 khớp:
  - Thân: `hips spine chest neck head`.
  - Mỗi bên: `clavicle shoulder elbow forearm wrist hip knee ankle`, `finger0..4_0..2`, `toe0..4_0..1`.
  - Mô hình không có ngón cái giải phẫu; finger0 chỉ là ngón ngoài cùng.

## 4. Định dạng project (schemaVersion 2)

```json
{"schemaVersion":2,"app":"0.13","fps":30,"duration":10,
 "characters":[{"id":"A","position":[0,0,0],"yaw":90,"color":"#65caff"}],
 "objects":[{"name":"Ghế gỗ","desc":"ghế gỗ sồi lưng cao, sơn nâu","position":[1,0.25,0],"size":[0.5,0.5,0.5]}],
 "tracks":[
  {"actor":"A","joint":"R_shoulder","axis":"x","keys":[[0,0],[1,-90,"easeOut"]]},
  {"actor":"A","joint":"$root","axis":"yaw","keys":[[0,90]]},
  {"actor":"@object:0","joint":"$root","axis":"py","keys":[[0,0.25]]},
  {"actor":"A","joint":"R_hand","axis":"preset","keys":[[1,"fist"]]},
  {"actor":"A","joint":"L_foot","axis":"contact","keys":[[0,1],[0.5,0],[0.9,1]]}],
 "cameraKeys":[[0,20,12,5,"smooth",0,1,0]],
 "notes":[{"t":0.5,"until":2,"actor":"A","text":"A tiến vào"}],
 "intendedContacts":[{"from":5.4,"to":5.7,"actors":["A","B"]}],
 "library":{"motions":{}}}
```

- Key có dạng `[t, giá trị, ease?]`. Ease thuộc về đoạn **kết thúc tại** key đó. Trước key đầu giữ giá trị key đầu; sau key cuối giữ giá trị key cuối.
- Ease hợp lệ: `smooth` (mặc định), `linear`, `easeIn`, `easeOut`, `easeInOut`, `hold`, `strike` (tăng tốc dồn vào cú chạm), `overshoot` (nảy quá đà), `cubic-bezier(x1,y1,x2,y2)`.
- Vật thể dùng actor `@object:<chỉ số>` (có `@`), joint `$root`, axis `px py pz rx ry rz sx sy sz`.
- **Mỗi vật thể phải có `name`** (tên ngắn, duy nhất, ví dụ "Ghế gỗ", "Cửa sắt") và nên có `desc` (mô tả hình dung: chất liệu, màu, kiểu dáng). Prompt video dùng hai trường này để AI tạo video biết mỗi khối hộp là gì. Track vẫn tham chiếu vật thể theo chỉ số, nên đổi tên không làm hỏng chuyển động.
- Contact: `1` là chân chạm đất (khoá vị trí và hướng); `2` là xoay trên mũi chân (khoá vị trí, bàn chân xoay theo); `0` là nhấc chân. Khi thân xoay quá 15–40° lúc chân đang khoá, engine tự chuyển sang xoay mũi chân. Nhân vật có contact thì bàn chân không bao giờ lún xuống sàn.
- Camera key: `[t, azimuth, elevation, distance, ease, targetX, targetY, targetZ]`.
  - Azimuth 0 là nhìn từ +Z.
  - Vị trí camera = target + d·[sin a·cos e, sin e, cos a·cos e].
  - FOV dọc 42°.
  - Hard cut dùng ease `hold`.

## 5. Lệnh SDK (dùng trong `build` hoặc `runCommands`)

`at` nhận số giây, `"end"`, hoặc `"end+0.2"` (tính từ lúc lệnh trước của cùng nhân vật kết thúc).

| op | Tham số chính | Việc làm |
|---|---|---|
| `character` / `object` | id, position, yaw, color / **name, desc**, position, size, color | Tạo nhân vật / vật thể (vật thể luôn đặt tên + mô tả) |
| `pose` | actor, name, at, ease, ground=true | Đặt tư thế thư viện; tự hạ cho chạm sàn |
| `motion` | actor, name, at, speed, duration, distance, direction, height, side, note | Chèn chuyển động; tự khoá chân và tự thêm ghi chú |
| `approach` | actor, target, at, distance=0.9, run | Đi/chạy tới cách mục tiêu `distance` m (tính hông-hông), rồi quay mặt về mục tiêu |
| `face` | actor, target, at, duration=0.3, offset | Quay đường ngắn nhất, xoay trên mũi chân. `offset` ±90 để chìa một bên người về phía mục tiêu (đá ngang) |
| `reach` | actor, limb (L/R_hand, L/R_foot), target, at, stop, hold, ease | IK đặt cổ tay/cổ chân vào đích. `stop` = dừng cách đích bao nhiêu mét (chạm bề mặt). Hông tự nghiêng tối đa ±35° nếu khớp hông sắp quá giới hạn. Trả về `reached`, `error` |
| `allowContact` | from, to, actors | Khai báo va chạm có chủ đích (đòn trúng) |
| `hand` | actor, side, preset, at | Đặt preset tay: `open relaxed fist sword point` |
| `key` / `joints` | … | Tinh chỉnh trực tiếp (hạn chế dùng) |
| `contact` | actor, foot, from, to, mode | Khoá hoặc thả chân thủ công |
| `camera` / `frame` | at, azimuth, elevation, distance, target / actors, padding | Đặt camera; `frame` tự tính điểm nhìn và khoảng cách để bao được các nhân vật |
| `note`, `mirror`, `saveMotion`, `retime`, `moveKeys`, `optimize` | … | Ghi chú, lật trái↔phải, lưu clip, co giãn nhịp, dời key, tối ưu |

`target` có thể là:
- `"B"` (hông của B),
- `[x,z]` hoặc `[x,y,z]`,
- `{"actor":"A","joint":"spine","offset":[0,0.08,0]}`.

**Chuyển động có sẵn:**
- `walk`, `run`: distance, direction. Có direction thì nhân vật quay tại chỗ trước rồi mới đi. `walk` với distance âm là **lùi lại** mà vẫn nhìn về phía trước: dùng để giãn khoảng cách sau mỗi pha đánh.
- `jump`: height, distance.
- `land`.
- `punch`, `kick`, `spin`: side.
- `dodge`: side, distance 0.1–0.4.
- `counter`, `block`.
- `draw_sword`, `swing_sword`, `sheathe_sword`.
- `sit_down`, `stand_up`, `fall`.

**Tư thế có sẵn:**
- `stand`, `guard`
- `punch`, `kick`, `block`, `dodge`
- `crouch`, `sit`, `fallen`
- `jump`, `run`, `walk`
- `sword_ready`, `sword_raise`
- `point`, `wave`, `victory`

## 6. Đọc báo cáo kiểm tra và cách sửa

| Mã | Nghĩa | Cách sửa |
|---|---|---|
| `GROUND_PENETRATION` | Một khớp xuyên sàn | Dùng pose có `ground`, nâng `$root y`, hoặc giảm gập |
| `FOOT_SLIDE` | Chân trượt (nhân vật chưa có contact) | Dùng `motion`/`approach` (tự có contact) hoặc thêm `contact` |
| `FOOT_SCUFF` | Chân đang nhấc mà cạ sát sàn | Gập hông/gối nhiều hơn ở giữa bước |
| `FOOT_LOCK_STRETCH` | Chân đang khoá nhưng thân đi quá xa | Giảm quãng di chuyển của root, hoặc thả chân sớm hơn |
| `KNEE_/ELBOW_HYPEREXTENSION` | Gập ngược | Sửa key, giảm khoảng với của IK |
| `JOINT_SPEED`, `ROTATION_FLIP` | Giật hoặc lật ±360° | Thêm key trung gian, giữ góc liên tục |
| `LIMB_COLLISION`, `ACTOR_OVERLAP` | Hai nhân vật xuyên nhau | Đổi khoảng cách hoặc hướng, đo lại bằng `inspect`; là đòn trúng thì dùng `allowContact` |
| Cảnh báo validator `ngoài giới hạn khớp` | Góc vượt giải phẫu | Đổi tư thế hoặc góc nhìn; với đá thì để `reach` tự nghiêng hông |

## 7. Cách dựng tốt (đã kiểm chứng trên cảnh "Đòn phản")

1. **Chia nhịp trước:** ai, làm gì, khi nào, chân trụ, điểm chạm, camera.
2. **Tiếp cận bằng `approach`, khoảng cách lấy từ phép đo.** Ví dụ: chia đôi khoảng cách sao cho tại `start+0.38` (lúc cú đấm vươn hết tay) cổ tay A dừng cách đầu B một khoảng mong muốn.
3. **Né hay đỡ thì canh đỉnh động tác trùng đỉnh đòn đánh.** Đỉnh của `dodge` ở t=0.26 tính từ lúc bắt đầu. Sau đó đo khoảng hở bằng `inspect(...).pairs[0].clearance`. Nếu < 0.02m thì né sâu thêm hoặc đánh ngắn lại.
4. **Đòn trúng:** chọn chân hoặc tay cần xoay ít nhất. Dùng `face` với offset ±90 để chìa bên đá, rồi `reach` (stop khoảng 0.2m) tại đúng frame chạm, cuối cùng `allowContact` quanh frame đó.
5. **Đánh xong** thì `face` quay lại, hoặc cho nạn nhân `fall` khoảng 0.04s sau cú chạm.
6. **Camera:** dùng `frame` cho từng nhịp. Khung kết nên đặt vuông góc với đường nối hai nhân vật.
7. **Kiểm tra lại toàn cảnh** (không chỉ keyframe), sau đó `bake` nếu cần v0.11, rồi kiểm tra cả bản bake.

## 8. Bàn giao

Gửi các file sau:
- `project.json`, kèm bản v0.11 nếu người dùng cần;
- bảng nhịp (thời gian, hành động, camera);
- báo cáo `check`, ghi rõ kiểm tra nào đã chạy;
- danh sách hạn chế và các chi tiết người dùng nên chỉnh tay.

Người dùng mở file trên web, bấm Space để xem, chỉnh bằng vòng xoay XYZ, phím P/M hoặc kéo keyframe, bấm K để lưu, rồi xuất JSON và gửi lại cho AI làm tiếp.

## 9. Hạn chế hiện tại

- Không có vật lý và va chạm mesh. Kiểm tra va chạm dùng hình trụ xấp xỉ.
- `run` là chạy nhanh (jog), không có pha bay.
- Vật thể chưa gắn được vào tay (không có parenting), nên kiếm phải dựng bằng tay.
- `reach` giải theo cổ tay/cổ chân, chưa theo đầu ngón.
- `approach` lấy vị trí mục tiêu tại thời điểm bắt đầu đi. Mục tiêu đang di chuyển thì phải đo lại.
