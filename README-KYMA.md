# App Tạo Ảnh Thương Hiệu Cá Nhân — nối AI Kyma

## Kiến trúc (key không bao giờ lộ)

```
Trình duyệt của khách
  → /api/kyma-status, /api/kyma-chat, /api/kyma-image (Vercel Serverless Functions)
  → https://kymaapi.com/v1 (Kyma API)
```

- Key Kyma **chỉ nằm trong Environment Variable `KYMA_API_KEY` trên Vercel**.
- Trình duyệt không bao giờ thấy key, code trong repo không chứa key.
- Chưa nối key thì app vẫn chạy bình thường: lọc câu bằng logic local trên máy,
  tạo ảnh bằng cách tải ảnh lên như cũ.

## Model đang dùng (chỉ free-tier, rẻ nhất)

| Việc | Model | Giá mỗi lần gọi |
| --- | --- | --- |
| Lọc nội dung thành 5 câu tiêu đề 6–9 từ | `qwen3.7-flash` | $0.0435 input / $0.1886 output cho 1 triệu token |
| Tạo ảnh nền AI | `minimax-image-01` | **$0.005/ảnh** (model ảnh duy nhất trong free tier) |

Không dùng model trả phí nào khác khi chưa có duyệt của Phong.

## Tính năng đã nối

1. **Trạng thái AI**: khi tải trang, app gọi `/api/kyma-status` và hiện 1 dòng nhỏ
   dưới nút "Lọc câu đăng được ngay": đã nối hay chưa nối key.
2. **Lọc câu bằng AI**: nút "Lọc câu đăng được ngay" thử gọi `/api/kyma-chat`
   trước; thành công thì hiện 5 câu AI lọc, thất bại/chưa nối key thì im lặng
   dùng lại logic lọc local (không báo lỗi làm khách hoang mang).
3. **Tạo ảnh nền AI**: nút "Tạo ảnh nền AI bằng Kyma — $0.005/ảnh" ở Bước 1,
   kèm ô nhập mô tả ngắn. Ảnh tạo xong được đặt làm ảnh chân dung trong app.
   Chưa nối key thì toast "Chưa nối key Kyma trên Vercel — hãy tải ảnh lên
   như bình thường".

## Bước duy nhất Phong cần làm (1 lần)

1. Vào Vercel project **app-tao-anh-thuong-hieu-ca-nhan** → **Settings** →
   **Environment Variables** → thêm biến:
   - Name: `KYMA_API_KEY`
   - Value: key Kyma của anh (dán vào ô trên Vercel, không gửi qua chat, không ghi vào file)
2. **Redeploy** project để biến có hiệu lực.
3. Mở lại app: dòng trạng thái dưới nút "Lọc câu" sẽ hiện
   "AI Kyma đã nối — lọc bằng qwen3.7-flash".

## File liên quan

- `index.html` — giao diện app (đã nối Kyma, giữ nguyên logic local làm fallback)
- `api/kyma-status.js` — GET, chỉ báo có key hay chưa
- `api/kyma-chat.js` — POST `{text}`, trả `{lines:[...]}`
- `api/kyma-image.js` — POST `{prompt, ratio}`, tạo ảnh bất đồng bộ qua job,
  poll tối đa ~55 giây rồi trả URL/base64 ảnh
