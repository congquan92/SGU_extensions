# SGU GPA Calculator & Graduation Predictor

## Tổng Quan

Đây là tiện ích mở rộng Chrome (Chrome Extension) được phát triển để hỗ trợ sinh viên trường Đại học Sài Gòn (SGU) trong việc tính toán điểm trung bình tích lũy (GPA) và dự đoán xếp loại tốt nghiệp. Tiện ích giúp sinh viên:

1. Lấy và quản lý token xác thực từ hệ thống thông tin đào tạo SGU
2. Tải dữ liệu bảng điểm tự động
3. Hiển thị tổng kết điểm hiện tại
4. Phân loại số tín chỉ theo loại điểm (A, B, C, D, F)
5. Dự đoán khả năng đạt xếp loại Giỏi (3.2) và Xuất sắc (3.6)
6. Đề xuất phương án cải thiện điểm thực tế, có tính đến giới hạn số môn có thể học cải thiện

## Cấu Trúc Dự Án

```
SGU_2/
  ├── background.js      # Script xử lý nền, bắt token và lưu trữ
  ├── manifest.json      # Cấu hình của extension
  ├── popup.html         # Giao diện người dùng
  ├── popup.js           # Xử lý logic tính toán và hiển thị
  └── icons/
      └── pikachu.png    # Icon của extension
```

## Tính Năng Chi Tiết

### 1. Quản Lý Token

- Tự động bắt token xác thực từ các request API của trang SGU
- Lưu và quản lý token thủ công
- Sao chép token để sử dụng ở nơi khác
- Xóa token đã lưu

### 2. Tải Dữ Liệu Điểm

- Gửi request API đến hệ thống SGU sử dụng token đã lưu
- Tải thông tin điểm của tất cả các học kỳ
- Xử lý dữ liệu trả về để phân tích tiếp

### 3. Hiển Thị Tổng Kết Hiện Tại

- Điểm trung bình hệ 10 và hệ 4
- Số tín chỉ tích lũy hiện tại
- Xếp loại hiện tại (Trung bình, Khá, Giỏi, Xuất sắc)
- Học kỳ gần nhất có dữ liệu

### 4. Phân Loại Tín Chỉ

- Đếm và hiển thị số tín chỉ đã đạt theo từng loại điểm
  

### 5. Dự Đoán Xếp Loại Tốt Nghiệp
- Tín A:  (4.0 điểm/tín)
- Tín B:  (3.0 điểm/tín)
- Tín C: (2.0 điểm/tín)
- Tín D:  (1.0 điểm/tín)
- Tín F: (0.0 điểm/tín)

Phân tích khả năng đạt xếp loại Giỏi (ĐTB ≥ 3.2) và Xuất sắc (ĐTB ≥ 3.6) dựa trên:

- Dữ liệu điểm hiện tại của sinh viên
- Số tín chỉ còn lại phải học để hoàn thành chương trình
- Số tín chỉ theo từng loại điểm có thể cải thiện

Tính năng này đưa ra các phương án khả thi và thực tế để sinh viên đạt được xếp loại mong muốn:
- Tính toán điểm trung bình cần đạt cho các môn còn lại
- Đề xuất số tín chỉ loại A và B cần đạt
- Nếu chỉ đạt A cho tất cả các môn còn lại vẫn chưa đủ:
  - Đề xuất cải thiện các môn đã học từ D → A, C → A hoặc B → A
  - Tính toán các phương án kết hợp khi số tín chỉ một loại không đủ
  - Cảnh báo khi không đủ tín chỉ để cải thiện
  - Hiển thị GPA dự kiến sau khi cải thiện

## Cách Sử Dụng

1. **Cài đặt extension vào Chrome**

2. **Lấy token xác thực**:
   - Đăng nhập vào hệ thống thông tin đào tạo SGU
   - Mở extension và nhấn "Lấy Token"
   - Hoặc dán token thủ công và lưu lại

3. **Tải dữ liệu điểm**:
   - Nhấn nút "Chạy" để tải dữ liệu điểm từ hệ thống

4. **Xem tổng kết hiện tại**:
   - Nhấn "Tổng Kết Điểm Hiện Tại" để hiển thị thông tin điểm trung bình và số tín chỉ

5. **Phân loại tín chỉ**:
   - Nhấn "Phân Loại Tín Chỉ" để xem số tín chỉ theo từng loại điểm

6. **Dự đoán xếp loại tốt nghiệp**:
   - Nhập tổng số tín chỉ ngành cần hoàn thành
   - Nhấn "Dự Đoán" để xem các phương án đạt xếp loại Giỏi và Xuất sắc

## Kỹ Thuật Sử Dụng

- **JavaScript**: Ngôn ngữ lập trình chính
- **Chrome Extension API**: Quản lý background script, popup và lưu trữ
- **Fetch API**: Gửi request đến server SGU
- **Chrome Storage**: Lưu trữ token xác thực
- **DOM Manipulation**: Cập nhật giao diện người dùng

## Lưu Ý

- Extension chỉ hoạt động khi người dùng đã đăng nhập vào hệ thống thông tin đào tạo SGU
- Dữ liệu điểm được lấy trực tiếp từ API của SGU, đảm bảo tính chính xác
- Tính năng dự đoán dựa trên dữ liệu thực tế và chỉ đề xuất các phương án cải thiện khả thi

## Tác Giả

- [Sinh viên trường Đại học Sài Gòn](https://nguyencongquan.id.vn/)

---
*Extension này không phải là sản phẩm chính thức của trường Đại học Sài Gòn và được phát triển với mục đích hỗ trợ sinh viên trong việc lập kế hoạch học tập.*
