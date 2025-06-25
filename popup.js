const tokenInput = document.getElementById('tokenInput');
const fetchTokenButton = document.getElementById('fetchTokenButton');
const copyTokenButton = document.getElementById('copyTokenButton');
const saveTokenButton = document.getElementById('saveTokenButton');
const removeTokenButton = document.getElementById('removeTokenButton');
const fetchScoresButton = document.getElementById('fetchScoresButton');
const fetchDiemButton = document.getElementById('fetch_diem'); // Nút mới
const statusDiv = document.getElementById('status');

let dataCraw = null; 
let currentAuthToken = ''; 

// Hàm cập nhật trạng thái
function setStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.style.color = '#333';
    statusDiv.style.backgroundColor = '#e9ecef';

    if (type === 'error') {
        statusDiv.style.color = '#721c24';
        statusDiv.style.backgroundColor = '#f8d7da';
    } else if (type === 'success') {
        statusDiv.style.color = '#155724';
        statusDiv.style.backgroundColor = '#d4edda';
    } else if (type === 'warning') {
        statusDiv.style.color = '#856404';
        statusDiv.style.backgroundColor = '#fff3cd';
    }
}

// Cập nhật trạng thái của nút "Chạy" dựa trên việc có token hay không
function updateFetchScoresButtonState() {
    fetchScoresButton.disabled = !currentAuthToken;
    fetchDiemButton.disabled = !dataCraw; // Nút "Tính điểm" chỉ hoạt động khi có dataCraw
}

// Hàm khởi tạo khi popup mở
document.addEventListener('DOMContentLoaded', async () => {
    // Thử lấy token đã bắt được từ storage ngay khi popup mở
    const result = await chrome.storage.local.get('capturedAuthToken');
    if (result.capturedAuthToken) {
        currentAuthToken = result.capturedAuthToken;
        tokenInput.value = currentAuthToken;
        setStatus('Token đã sẵn sàng từ phiên trước.', 'success');
    } else {
        // Nếu không có token đã bắt được, thử lấy token đã lưu thủ công trước đó
        const manualTokenResult = await chrome.storage.local.get('manualAuthToken');
        if (manualTokenResult.manualAuthToken) {
            currentAuthToken = manualTokenResult.manualAuthToken;
            tokenInput.value = currentAuthToken;
            setStatus('Token đã lưu thủ công đã sẵn sàng.', 'success');
        } else {
            setStatus('Không có token. Vui lòng lấy token hoặc dán thủ công.', 'info');
        }
    }
    updateFetchScoresButtonState();
});

// Xử lý sự kiện khi nhấn nút "Lấy Token" (kết hợp tự động và thủ công)
fetchTokenButton.addEventListener('click', async () => {
    // Ưu tiên lấy từ input nếu người dùng đã dán
    if (tokenInput.value && tokenInput.value.startsWith('Bearer ')) {
        currentAuthToken = tokenInput.value.replace('Bearer ', '');
        setStatus('Đã lấy token từ ô nhập liệu.', 'success');
        updateFetchScoresButtonState();
        return;
    } else if (tokenInput.value) {
        // Nếu người dùng dán nhưng thiếu "Bearer "
        currentAuthToken = tokenInput.value;
        setStatus('Đã lấy token từ ô nhập liệu (thiếu "Bearer ").', 'warning');
        updateFetchScoresButtonState();
        return;
    }

    // Nếu input rỗng, cố gắng lấy token tự động từ background script
    setStatus('Đang chờ token được bắt từ phiên hoạt động... Vui lòng tải lại trang SGU nếu chưa thấy.', 'info');
    fetchScoresButton.disabled = true;

    const response = await chrome.runtime.sendMessage({ action: "getCapturedToken" });
    if (response && response.token) {
        currentAuthToken = response.token;
        tokenInput.value = currentAuthToken;
        setStatus('Đã lấy token tự động thành công từ phiên hoạt động!', 'success');
    } else {
        setStatus('Chưa có token được bắt. Đảm bảo bạn đã đăng nhập và một API đã gửi token.', 'warning');
        currentAuthToken = '';
    }
    updateFetchScoresButtonState();
});

// Xử lý sự kiện sao chép token
copyTokenButton.addEventListener('click', () => {
    if (currentAuthToken) {
        navigator.clipboard.writeText(currentAuthToken)
            .then(() => {
                setStatus('Đã sao chép token!', 'success');
                setTimeout(() => setStatus('Đã sao chép token!', 'success'), 2000);
            })
            .catch(err => {
                setStatus('Không thể sao chép token.', 'error');
                console.error('Failed to copy token:', err);
            });
    } else {
        setStatus('Không có token để sao chép.', 'warning');
    }
});

// Xử lý sự kiện lưu token thủ công
saveTokenButton.addEventListener('click', async () => {
    const tokenToSave = tokenInput.value;
    if (tokenToSave) {
        await chrome.storage.local.set({ 'manualAuthToken': tokenToSave });
        currentAuthToken = tokenToSave;
        setStatus('Đã lưu token thủ công!', 'success');
        updateFetchScoresButtonState();
    } else {
        setStatus('Vui lòng nhập token để lưu.', 'warning');
    }
});

// Xử lý sự kiện xóa token thủ công
removeTokenButton.addEventListener('click', async () => {
    await chrome.storage.local.remove('manualAuthToken');
    currentAuthToken = '';
    tokenInput.value = '';
    setStatus('Đã xóa token đã lưu.', 'info');
    updateFetchScoresButtonState();
});

// --- Hàm lấy dữ liệu điểm từ API ---
async function getStudentScores() {
    const apiUrl = "https://thongtindaotao.daihocsaigon.edu.vn/api/srm/w-locdsdiemsinhvien?hien_thi_mon_theo_hkdk=false";

    if (!currentAuthToken) {
        setStatus('Vui lòng lấy token trước khi tải điểm.', 'error');
        return null;
    }

    setStatus('Đang tải dữ liệu điểm...', 'info');

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
               'Authorization': `Bearer ${currentAuthToken}`, // SỬ DỤNG TOKEN ĐÃ LẤY
               'Content-Type': 'application/json',
               'Accept': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Lỗi HTTP khi tải điểm: ${response.status} - ${response.statusText}`, errorText);
            setStatus(`Lỗi tải điểm: ${response.status} - ${response.statusText}`, 'error');
            return null;
        }

        const data = await response.json();

        console.log("Dữ liệu thô từ API:", data);
        console.log("Dữ liệu API ds hoc kỳ:", data.data.ds_diem_hocky);
        console.log("Dữ liệu API ds điểm các môn học :", (data.data.ds_diem_hocky).map(hk => hk.ds_diem_mon_hoc));
        setStatus('Đã tải điểm thành công! Kiểm tra console.', 'success');
        dataCraw = data; // Lưu dữ liệu vào biến toàn cục để sử dụng sau này
        updateFetchScoresButtonState(); // Cập nhật trạng thái nút "Tính điểm" sau khi có dữ liệu
        return data;

    } catch (error) {
        console.error("Có lỗi xảy ra khi lấy dữ liệu API điểm:", error);
        setStatus(`Lỗi khi lấy dữ liệu điểm: ${error.message}`, 'error');
        return null;
    }
}
// Hàm  xếp loại
function calculateXepLoai(dtb) {
    if (dtb < 2.0) {
        return 'Không đủ điều kiện tốt nghiệp';
    } else if (dtb >= 2.0 && dtb < 2.5) {
        return 'Trung bình';
    } else if (dtb >= 2.5 && dtb < 3.2) {
        return 'Khá';
    } else if (dtb >= 3.2 && dtb < 3.6) {
        return 'Giỏi';
    } else if (dtb >= 3.6 && dtb <= 4.0) {
        return 'Xuất sắc';
    }
    return 'Không xác định';
}

// Hàm hiển thị Tổng kết hiện tại
function displayCurrentSummary() {
    const dsDiemHocky = dataCraw.data.ds_diem_hocky;
    console.log("Dữ liệu điểm học kỳ:", dsDiemHocky);

    for( let i = 0; i < dsDiemHocky.length; i++) {
        const diemHocky = dsDiemHocky[i];
        if (diemHocky.so_tin_chi_dat_hk == '' && diemHocky.so_tin_chi_dat_tich_luy == '') {
           continue;
        }
        if (diemHocky.so_tin_chi_dat_hk && diemHocky.so_tin_chi_dat_tich_luy) {
            document.getElementById('currentDTB10').textContent = diemHocky.dtb_tich_luy_he_10	;
            document.getElementById('currentDTB4').textContent = diemHocky.dtb_tich_luy_he_4;
            document.getElementById('currentTinChi').textContent = diemHocky.so_tin_chi_dat_tich_luy;
            document.getElementById('currentXepLoai').textContent = calculateXepLoai(diemHocky.dtb_tich_luy_he_4);
            document.getElementById('currentSemester').textContent = diemHocky.ten_hoc_ky;
            break; // Chỉ hiển thị tổng kết của học kỳ đầu tiên có dữ liệu
       }
    }
    setStatus('Đã hiển thị tổng kết hiện tại.', 'success');
    document.getElementById('currentSummarySection').style.display = 'block';
}

// Xử lý sự kiện khi nhấn nút "Chạy"
fetchScoresButton.addEventListener('click', () => {
    getStudentScores();
});

// Xử lý sự kiện khi nhấn nút "Tính điểm"
fetchDiemButton.addEventListener('click', () => {
    displayCurrentSummary();
    console.log("hello");
});    