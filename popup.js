const tokenInput = document.getElementById('tokenInput');
const fetchTokenButton = document.getElementById('fetchTokenButton');
const copyTokenButton = document.getElementById('copyTokenButton');
const saveTokenButton = document.getElementById('saveTokenButton');
const removeTokenButton = document.getElementById('removeTokenButton');
const fetchScoresButton = document.getElementById('fetchScoresButton');
const fetchDiemButton = document.getElementById('fetch_diem'); 
const fetchPLButton = document.getElementById('fetch_PL');
const statusDiv = document.getElementById('status');

let currentTinChi = 0;
let currentDTB4 = 0;
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
    fetchPLButton.disabled = !dataCraw; // Nút "Phân loại tính chỉ" chỉ hoạt động khi có dataCraw
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
        currentAuthToken = tokenInput.value;
        setStatus('Đã lấy token từ ô nhập liệu.', 'success');
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
        setStatus('Đã tải điểm thành công! Kiểm tra console.', 'success');
        dataCraw = data; 
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
            currentTinChi = diemHocky.so_tin_chi_dat_tich_luy;
            currentDTB4 = diemHocky.dtb_tich_luy_he_4;
            break; // Chỉ hiển thị tổng kết của học kỳ đầu tiên có dữ liệu
       }
    }
    setStatus('Đã hiển thị tổng kết hiện tại.', 'success');
    document.getElementById('currentSummarySection').style.display = 'block';
}

// Hàm phân loại tín chỉ
function displayCreditsByType() {
    let l_A = 0;
    let l_B = 0;
    let l_C = 0;
    let l_D = 0;
    let l_F = 0;

    const dsDiem = (dataCraw.data.ds_diem_hocky).flatMap(hk => hk.ds_diem_mon_hoc);
    console.log("Dữ liệu điểm các môn học:", dsDiem);
    for (let i = 0; i < dsDiem.length; i++) {
        const diemMonHoc = dsDiem[i];
        if (diemMonHoc.ket_qua == 1) {
            const tinChi = parseInt(diemMonHoc.so_tin_chi) || 0; // Đảm bảo là số, nếu không có thì 0
            switch (diemMonHoc.diem_tk_chu) {
                case 'A':
                    l_A += tinChi;
                    break;
                case 'B':
                    l_B += tinChi;
                    break;
                case 'C':
                    l_C += tinChi;
                    break;
                case 'D':
                    l_D += tinChi;
                    break;
                case 'F': // Mặc dù là đậu, nhưng nếu có F thì vẫn tính
                    l_F += tinChi;
                    break;
                default:
                    // Bỏ qua các trường hợp không xác định hoặc không có điểm chữ
                    break;
            }
        }
    }
    totalA.textContent = l_A;
    totalB.textContent = l_B;
    totalC.textContent = l_C;
    totalD.textContent = l_D;
    totalF.textContent = l_F;
    
    document.getElementById('creditsByTypeSection').style.display = 'block'; //
    setStatus('Đã hiển thị phân loại tín chỉ.', 'success');
}

function predictButton(){
    // Lấy tổng số tín chỉ ngành từ input
    const totalMajorCredits = parseInt(document.getElementById('input_Pre').value);
    const statusPredict = document.getElementById('status_Predict');
    const remainingCredits = document.getElementById('display_sotin_conlai');
    
    // Kiểm tra đầu vào
    if (!totalMajorCredits || isNaN(totalMajorCredits) || totalMajorCredits <= 0) {
        setStatus('Vui lòng nhập số tín chỉ ngành hợp lệ.', 'error');
        remainingCredits.textContent = "0";
        return;
    }
    
    // Lấy dữ liệu hiện tại
    const currentCredits = parseFloat(currentTinChi) || 0;
    const currentGPA = parseFloat(currentDTB4) || 0;
    
    // Tính số tín chỉ còn lại
    const remaining = totalMajorCredits - currentCredits;
    remainingCredits.textContent = remaining.toString();
    
    // Tính tổng điểm hiện tại
    const currentTotalPoints = currentCredits * currentGPA;
    
    // Điểm cần đạt cho từng xếp loại
    const targetGioi = 3.2;
    const targetXuatsac = 3.6;
    
    // Tổng điểm cần có để đạt từng loại
    const totalPointsNeededForGioi = totalMajorCredits * targetGioi;
    const totalPointsNeededForXuatsac = totalMajorCredits * targetXuatsac;
    
    // Điểm cần thêm cho từng loại
    const pointsNeededForGioi = totalPointsNeededForGioi - currentTotalPoints;
    const pointsNeededForXuatsac = totalPointsNeededForXuatsac - currentTotalPoints;
    
    // Điểm trung bình cần đạt cho các tín chỉ còn lại
    const avgNeededForGioi = (remaining > 0) ? pointsNeededForGioi / remaining : 0;
    const avgNeededForXuatsac = (remaining > 0) ? pointsNeededForXuatsac / remaining : 0;
    
    let resultHTML = "";
    
    // Phân tích kết quả đạt GIỎI
    if (currentGPA >= targetGioi) {
        resultHTML += `<p>💚 <strong>Giỏi:</strong> Bạn đã đạt đủ điều kiện xếp loại Giỏi với ĐTB hiện tại ${currentGPA.toFixed(2)}</p>`;
    } else if (remaining <= 0) {
        resultHTML += `<p>❌ <strong>Giỏi:</strong> Đã hoàn thành đủ tín chỉ nhưng ĐTB ${currentGPA.toFixed(2)} chưa đạt mức Giỏi (3.2)</p>`;
    } else if (avgNeededForGioi <= 4.0) {
        // Tính toán số tín A và B cần thiết
        const creditsA = Math.ceil((pointsNeededForGioi - remaining * 3.0) / 1.0);
        const creditsB = remaining - creditsA;
        
        if (creditsA <= remaining) {
            // Tính GPA dự kiến khi đạt được số tín A và B theo đề xuất
            const expectedPointsWithAB = currentTotalPoints + (creditsA * 4.0) + (creditsB * 3.0);
            const expectedGPAGioi = (expectedPointsWithAB / totalMajorCredits).toFixed(2);
            
            resultHTML += `<p>✅ <strong>Giỏi:</strong> Cần ĐTB ${avgNeededForGioi.toFixed(2)} cho ${remaining} tín còn lại.<br>
            → Cụ thể: <span style="color:blue">${creditsA} tín A</span> và <span style="color:blue">${creditsB} tín B</span><br>
            → GPA dự kiến: <strong>${expectedGPAGioi}</strong></p>`;
        }
    } else {
        // Cần cải thiện điểm cũ
        const maxPointsFromRemaining = remaining * 4.0; // Nếu tất cả A
        const stillNeeded = pointsNeededForGioi - maxPointsFromRemaining;
        const improveD = Math.ceil(stillNeeded / 3.0); // D→A: +3 điểm/tín
        const improveC = Math.ceil(stillNeeded / 2.0); // C→A: +2 điểm/tín
        const improveB = Math.ceil(stillNeeded / 1.0); // B→A: +1 điểm/tín
        
        // Tính GPA dự kiến nếu đạt được tất cả điều kiện cải thiện
        const expectedPointsAfterImprovement = currentTotalPoints + maxPointsFromRemaining + stillNeeded;
        const expectedGPAGioi = (expectedPointsAfterImprovement / totalMajorCredits).toFixed(2);
        
        resultHTML += `<p>⚠️ <strong>Giỏi:</strong> Cần đạt A cho tất cả ${remaining} tín còn lại<br>
        → <strong>VÀ</strong> cải thiện một trong những trường hợp sau:<br>
        <span style="color:red">${improveD} tín D → A</span>, hoặc<br>
        <span style="color:orange">${improveC} tín C → A</span>, hoặc<br>
        <span style="color:blue">${improveB} tín B → A</span><br>
        → GPA dự kiến sau cải thiện: <strong>${expectedGPAGioi}</strong></p>`;
    }
    
    // Phân tích kết quả đạt XUẤT SẮC
    if (currentGPA >= targetXuatsac) {
        resultHTML += `<p>💙 <strong>Xuất sắc:</strong> Bạn đã đạt đủ điều kiện xếp loại Xuất sắc với ĐTB hiện tại ${currentGPA.toFixed(2)}</p>`;
    } else if (remaining <= 0) {
        resultHTML += `<p>❌ <strong>Xuất sắc:</strong> Đã hoàn thành đủ tín chỉ nhưng ĐTB ${currentGPA.toFixed(2)} chưa đạt mức Xuất sắc (3.6)</p>`;
    } else if (avgNeededForXuatsac <= 4.0) {
        resultHTML += `<p>✅ <strong>Xuất sắc:</strong> Cần ĐTB ${avgNeededForXuatsac.toFixed(2)} cho ${remaining} tín còn lại.<br>`;
        
        if (avgNeededForXuatsac > 3.9) {
            // Tính GPA khi gần như toàn điểm A
            const expectedPointsWithAllA = currentTotalPoints + (remaining * 4.0);
            const expectedGPAXuatSac = (expectedPointsWithAllA / totalMajorCredits).toFixed(2);
            
            resultHTML += `→ Cần gần như toàn bộ điểm A cho các tín chỉ còn lại<br>
            → GPA dự kiến: <strong>${expectedGPAXuatSac}</strong></p>`;
        } else {
            // Tính toán số tín A và B cần thiết để đạt Xuất sắc
            const creditsA = Math.ceil((pointsNeededForXuatsac - remaining * 3.0) / 1.0);
            const creditsB = remaining - creditsA;
            
            // Tính GPA dự kiến
            const expectedPointsWithAB = currentTotalPoints + (creditsA * 4.0) + (creditsB * 3.0);
            const expectedGPAXuatSac = (expectedPointsWithAB / totalMajorCredits).toFixed(2);
            
            resultHTML += `→ Cụ thể: <span style="color:blue">${creditsA} tín A</span> và <span style="color:blue">${creditsB} tín B</span><br>
            → GPA dự kiến: <strong>${expectedGPAXuatSac}</strong></p>`;
        }
    } else {
        // Cần cải thiện điểm cũ
        const maxPointsFromRemaining = remaining * 4.0; // Nếu tất cả A
        const stillNeeded = pointsNeededForXuatsac - maxPointsFromRemaining;
        const improveD = Math.ceil(stillNeeded / 3.0); // D→A: +3 điểm/tín
        const improveC = Math.ceil(stillNeeded / 2.0); // C→A: +2 điểm/tín
        const improveB = Math.ceil(stillNeeded / 1.0); // B→A: +1 điểm/tín
        
        // Tính GPA dự kiến nếu đạt được tất cả điều kiện cải thiện
        const expectedPointsAfterImprovement = currentTotalPoints + maxPointsFromRemaining + stillNeeded;
        const expectedGPAXuatSac = (expectedPointsAfterImprovement / totalMajorCredits).toFixed(2);
        
        resultHTML += `<p>⚠️ <strong>Xuất sắc:</strong> Cần đạt A cho <strong>TẤT CẢ</strong> ${remaining} tín còn lại<br>
        → <strong>VÀ</strong> cải thiện một trong những trường hợp sau:<br>
        <span style="color:red">${improveD} tín D → A</span>, hoặc<br>
        <span style="color:orange">${improveC} tín C → A</span>, hoặc<br>
        <span style="color:blue">${improveB} tín B → A</span><br>
        → GPA dự kiến sau cải thiện: <strong>${expectedGPAXuatSac}</strong></p>`;
    }
    
    // Hiển thị kết quả
    statusPredict.innerHTML = resultHTML;
    
    // Hiển thị thông báo
    setStatus('Đã dự đoán chi tiết về khả năng đạt loại tốt nghiệp', 'success');
}


// Xử lý sự kiện khi nhấn nút "Chạy"
fetchScoresButton.addEventListener('click', () => {
    getStudentScores();
});

// Xử lý sự kiện khi nhấn nút "Tổng Kết Điểm Hiện Tại"
fetchDiemButton.addEventListener('click', () => {
    displayCurrentSummary();
});

// Xử lý sự kiện khi nhấn nút "Phân loại tính chỉ"
fetchPLButton.addEventListener('click', () => {
    displayCurrentSummary();
    displayCreditsByType();
});

// Xử lý sự kiện khi nhấn nút "Dự đoán"
document.getElementById('predictButton').addEventListener('click', () => {
   predictButton(); 
});