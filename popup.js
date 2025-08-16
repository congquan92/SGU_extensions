const tokenInput = document.getElementById("tokenInput");
const fetchTokenButton = document.getElementById("fetchTokenButton");
const copyTokenButton = document.getElementById("copyTokenButton");
const saveTokenButton = document.getElementById("saveTokenButton");
const removeTokenButton = document.getElementById("removeTokenButton");
const fetchScoresButton = document.getElementById("fetchScoresButton");
const fetchDiemButton = document.getElementById("fetch_diem");
const fetchPLButton = document.getElementById("fetch_PL");
const exportReportButton = document.getElementById("exportReportButton");
const clearCacheButton = document.getElementById("clearCacheButton");
const showStatisticsButton = document.getElementById("showStatisticsButton");
const statusDiv = document.getElementById("status");

let currentTinChi = 0;
let currentDTB4 = 0;
let dataCraw = null;
let currentAuthToken = "";

// Cache để tránh gọi API nhiều lần
let cachedSemesterData = null;
let cacheExpiry = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 phút

// Validation và mã hóa token đơn giản
function encryptToken(token) {
  return btoa(token); // Base64 encode - cơ bản nhưng tốt hơn plaintext
}

function decryptToken(encryptedToken) {
  try {
    return atob(encryptedToken);
  } catch (e) {
    return encryptedToken; // Fallback nếu không mã hóa
  }
}

function validateToken(token) {
  return token && token.length > 20 && !token.includes(' '); // Validation cơ bản
}

// Hàm cập nhật trạng thái
function setStatus(message, type = "info") {
  statusDiv.textContent = message;
  statusDiv.style.color = "#333";
  statusDiv.style.backgroundColor = "#e9ecef";

  if (type === "error") {
    statusDiv.style.color = "#721c24";
    statusDiv.style.backgroundColor = "#f8d7da";
  } else if (type === "success") {
    statusDiv.style.color = "#155724";
    statusDiv.style.backgroundColor = "#d4edda";
  } else if (type === "warning") {
    statusDiv.style.color = "#856404";
    statusDiv.style.backgroundColor = "#fff3cd";
  } else if (type === "loading") {
    statusDiv.style.color = "#0c5460";
    statusDiv.style.backgroundColor = "#d1ecf1";
  }
}

// Loading state management
function setLoadingState(isLoading, buttonId = null) {
  const buttons = buttonId ? [document.getElementById(buttonId)] : 
    [fetchTokenButton, fetchScoresButton, fetchDiemButton, fetchPLButton];
  
  buttons.forEach(button => {
    if (button) {
      button.disabled = isLoading;
      if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.textContent = "Đang xử lý...";
      } else {
        button.textContent = button.dataset.originalText || button.textContent;
      }
    }
  });
}

// Cập nhật trạng thái của nút "Chạy" dựa trên việc có token hay không
function updateFetchScoresButtonState() {
  fetchScoresButton.disabled = !currentAuthToken;
  fetchDiemButton.disabled = !dataCraw; // Nút "Tính điểm" chỉ hoạt động khi có dataCraw
  fetchPLButton.disabled = !dataCraw; // Nút "Phân loại tính chỉ" chỉ hoạt động khi có dataCraw
  exportReportButton.disabled = !dataCraw; // Nút "Xuất báo cáo" chỉ hoạt động khi có dataCraw
}

// Hàm khởi tạo khi popup mở
document.addEventListener("DOMContentLoaded", async () => {
  setLoadingState(true);
  
  try {
    // Thử lấy token đã bắt được từ storage ngay khi popup mở
    const result = await chrome.storage.local.get("capturedAuthToken");
    if (result.capturedAuthToken) {
      currentAuthToken = decryptToken(result.capturedAuthToken);
      
      if (validateToken(currentAuthToken)) {
        tokenInput.value = currentAuthToken;
        setStatus("Token đã sẵn sàng từ phiên trước.", "success");
      } else {
        setStatus("Token không hợp lệ, vui lòng lấy token mới.", "warning");
        currentAuthToken = "";
      }
    } else {
      // Nếu không có token đã bắt được, thử lấy token đã lưu thủ công trước đó
      const manualTokenResult = await chrome.storage.local.get("manualAuthToken");
      if (manualTokenResult.manualAuthToken) {
        currentAuthToken = decryptToken(manualTokenResult.manualAuthToken);
        
        if (validateToken(currentAuthToken)) {
          tokenInput.value = currentAuthToken;
          setStatus("Token đã lưu thủ công đã sẵn sàng.", "success");
        } else {
          setStatus("Token đã lưu không hợp lệ.", "warning");
          currentAuthToken = "";
        }
      } else {
        setStatus("Không có token. Vui lòng lấy token hoặc dán thủ công.", "info");
      }
    }
    
    // Kiểm tra cache dữ liệu điểm
    const cachedData = await chrome.storage.local.get(["cachedScoreData", "cacheTimestamp"]);
    if (cachedData.cachedScoreData && cachedData.cacheTimestamp) {
      const now = Date.now();
      if (now - cachedData.cacheTimestamp < CACHE_DURATION) {
        dataCraw = cachedData.cachedScoreData;
        setStatus("Đã tải dữ liệu điểm từ cache.", "success");
      }
    }
    
  } catch (error) {
    console.error("Lỗi khi khởi tạo:", error);
    setStatus("Có lỗi khi khởi tạo. Vui lòng thử lại.", "error");
  } finally {
    updateFetchScoresButtonState();
    setLoadingState(false);
  }
});

// Xử lý sự kiện khi nhấn nút "Lấy Token" (kết hợp tự động và thủ công)
fetchTokenButton.addEventListener("click", async () => {
  setLoadingState(true, "fetchTokenButton");
  
  try {
    // Ưu tiên lấy từ input nếu người dùng đã dán
    if (tokenInput.value && tokenInput.value.startsWith("Bearer ")) {
      const token = tokenInput.value.replace("Bearer ", "");
      if (validateToken(token)) {
        currentAuthToken = token;
        await chrome.storage.local.set({ 
          manualAuthToken: encryptToken(token),
          tokenTimestamp: Date.now()
        });
        setStatus("Đã lấy và lưu token từ ô nhập liệu.", "success");
        updateFetchScoresButtonState();
        return;
      } else {
        setStatus("Token không hợp lệ. Vui lòng kiểm tra lại.", "error");
        return;
      }
    } else if (tokenInput.value) {
      if (validateToken(tokenInput.value)) {
        currentAuthToken = tokenInput.value;
        await chrome.storage.local.set({ 
          manualAuthToken: encryptToken(tokenInput.value),
          tokenTimestamp: Date.now()
        });
        setStatus("Đã lấy và lưu token từ ô nhập liệu.", "success");
        updateFetchScoresButtonState();
        return;
      } else {
        setStatus("Token không hợp lệ. Vui lòng kiểm tra lại.", "error");
        return;
      }
    }

    // Nếu input rỗng, cố gắng lấy token tự động từ background script
    setStatus("Đang chờ token được bắt từ phiên hoạt động...", "loading");

    const response = await chrome.runtime.sendMessage({
      action: "getCapturedToken",
    });
    
    if (response && response.token && validateToken(response.token)) {
      currentAuthToken = response.token;
      tokenInput.value = currentAuthToken;
      await chrome.storage.local.set({ 
        capturedAuthToken: encryptToken(response.token),
        tokenTimestamp: Date.now()
      });
      setStatus("Đã lấy token tự động thành công từ phiên hoạt động!", "success");
    } else {
      setStatus("Chưa có token được bắt hoặc token không hợp lệ. Đảm bảo bạn đã đăng nhập và một API đã gửi token.", "warning");
      currentAuthToken = "";
    }
  } catch (error) {
    console.error("Lỗi khi lấy token:", error);
    setStatus("Có lỗi khi lấy token. Vui lòng thử lại.", "error");
  } finally {
    updateFetchScoresButtonState();
    setLoadingState(false, "fetchTokenButton");
  }
});

// Xử lý sự kiện sao chép token
copyTokenButton.addEventListener("click", () => {
  if (currentAuthToken) {
    navigator.clipboard
      .writeText(currentAuthToken)
      .then(() => {
        setStatus("Đã sao chép token!", "success");
        setTimeout(() => setStatus("Đã sao chép token!", "success"), 2000);
      })
      .catch((err) => {
        setStatus("Không thể sao chép token.", "error");
        console.error("Failed to copy token:", err);
      });
  } else {
    setStatus("Không có token để sao chép.", "warning");
  }
});

// Xử lý sự kiện lưu token thủ công
saveTokenButton.addEventListener("click", async () => {
  const tokenToSave = tokenInput.value;
  if (tokenToSave) {
    await chrome.storage.local.set({ manualAuthToken: tokenToSave });
    currentAuthToken = tokenToSave;
    setStatus("Đã lưu token thủ công!", "success");
    updateFetchScoresButtonState();
  } else {
    setStatus("Vui lòng nhập token để lưu.", "warning");
  }
});

// Xử lý sự kiện xóa token thủ công
removeTokenButton.addEventListener("click", async () => {
  await chrome.storage.local.remove("manualAuthToken");
  currentAuthToken = "";
  tokenInput.value = "";
  setStatus("Đã xóa token đã lưu.", "info");
  updateFetchScoresButtonState();
});

// --- Hàm lấy dữ liệu điểm từ API ---
async function getStudentScores(useCache = true) {
  const apiUrl = "https://thongtindaotao.sgu.edu.vn/api/srm/w-locdsdiemsinhvien?hien_thi_mon_theo_hkdk=false";

  if (!currentAuthToken) {
    setStatus("Vui lòng lấy token trước khi tải điểm.", "error");
    return null;
  }

  // Kiểm tra cache trước
  if (useCache) {
    const cachedData = await chrome.storage.local.get(["cachedScoreData", "cacheTimestamp"]);
    if (cachedData.cachedScoreData && cachedData.cacheTimestamp) {
      const now = Date.now();
      if (now - cachedData.cacheTimestamp < CACHE_DURATION) {
        dataCraw = cachedData.cachedScoreData;
        setStatus("Đã tải điểm từ cache (tiết kiệm băng thông).", "success");
        updateFetchScoresButtonState();
        return dataCraw;
      }
    }
  }

  setStatus("Đang tải dữ liệu điểm từ server...", "loading");
  setLoadingState(true, "fetchScoresButton");

  // Retry logic
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      attempts++;
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentAuthToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setStatus("Token đã hết hạn. Vui lòng lấy token mới.", "error");
          currentAuthToken = "";
          tokenInput.value = "";
          updateFetchScoresButtonState();
          return null;
        }
        
        const errorText = await response.text();
        console.error(`Lỗi HTTP khi tải điểm: ${response.status} - ${response.statusText}`, errorText);
        
        if (attempts === maxAttempts) {
          setStatus(`Lỗi tải điểm sau ${maxAttempts} lần thử: ${response.status}`, "error");
          return null;
        } else {
          setStatus(`Lần thử ${attempts}/${maxAttempts} thất bại. Đang thử lại...`, "warning");
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
          continue;
        }
      }

      const data = await response.json();
      
      // Validate dữ liệu trả về
      if (!data || !data.data || !data.data.ds_diem_hocky) {
        setStatus("Dữ liệu trả về không hợp lệ.", "error");
        return null;
      }
      
      // Lưu vào cache
      await chrome.storage.local.set({
        cachedScoreData: data,
        cacheTimestamp: Date.now()
      });
      
      setStatus("Đã tải điểm thành công!", "success");
      dataCraw = data;
      updateFetchScoresButtonState();
      return data;
      
    } catch (error) {
      console.error(`Lần thử ${attempts}: Có lỗi xảy ra khi lấy dữ liệu API điểm:`, error);
      
      if (attempts === maxAttempts) {
        setStatus(`Lỗi khi lấy dữ liệu điểm: ${error.message}`, "error");
        return null;
      } else {
        setStatus(`Lần thử ${attempts}/${maxAttempts} thất bại. Đang thử lại...`, "warning");
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }
  
  setLoadingState(false, "fetchScoresButton");
  return null;
}
// Hàm  xếp loại
function calculateXepLoai(dtb) {
  if (dtb < 2.0) {
    return "Không đủ điều kiện tốt nghiệp";
  } else if (dtb >= 2.0 && dtb < 2.5) {
    return "Trung bình";
  } else if (dtb >= 2.5 && dtb < 3.2) {
    return "Khá";
  } else if (dtb >= 3.2 && dtb < 3.6) {
    return "Giỏi";
  } else if (dtb >= 3.6 && dtb <= 4.0) {
    return "Xuất sắc";
  }
  return "Không xác định";
}

// Hàm hiển thị Tổng kết hiện tại
function displayCurrentSummary() {
  const dsDiemHocky = dataCraw.data.ds_diem_hocky;
  // console.log("Dữ liệu điểm học kỳ:", dsDiemHocky);

  for (let i = 0; i < dsDiemHocky.length; i++) {
    const diemHocky = dsDiemHocky[i];
    if (
      diemHocky.so_tin_chi_dat_hk == "" &&
      diemHocky.so_tin_chi_dat_tich_luy == ""
    ) {
      continue;
    }
    if (diemHocky.so_tin_chi_dat_hk && diemHocky.so_tin_chi_dat_tich_luy) {
      document.getElementById("currentDTB10").textContent =
        diemHocky.dtb_tich_luy_he_10;
      document.getElementById("currentDTB4").textContent =
        diemHocky.dtb_tich_luy_he_4;
      document.getElementById("currentTinChi").textContent =
        diemHocky.so_tin_chi_dat_tich_luy;
      document.getElementById("currentXepLoai").textContent = calculateXepLoai(
        diemHocky.dtb_tich_luy_he_4
      );
      document.getElementById("currentSemester").textContent =
        diemHocky.ten_hoc_ky;
      currentTinChi = diemHocky.so_tin_chi_dat_tich_luy;
      currentDTB4 = diemHocky.dtb_tich_luy_he_4;
      break;
    }
  }
  setStatus("Đã hiển thị tổng kết hiện tại.", "success");
  document.getElementById("currentSummarySection").style.display = "block";
}

// Hàm phân loại tín chỉ
function displayCreditsByType() {
  let l_A = 0;
  let l_B = 0;
  let l_C = 0;
  let l_D = 0;
  let l_F = 0;

  const dsDiem = dataCraw.data.ds_diem_hocky.flatMap(
    (hk) => hk.ds_diem_mon_hoc
  );
  console.log("Dữ liệu điểm các môn học:", dsDiem);
  for (let i = 0; i < dsDiem.length; i++) {
    const diemMonHoc = dsDiem[i];
    if (diemMonHoc.ket_qua == 1) {
      const tinChi = parseInt(diemMonHoc.so_tin_chi) || 0; // Đảm bảo là số, nếu không có thì 0
      switch (diemMonHoc.diem_tk_chu) {
        case "A":
          l_A += tinChi;
          break;
        case "B":
          l_B += tinChi;
          break;
        case "C":
          l_C += tinChi;
          break;
        case "D":
          l_D += tinChi;
          break;
        case "F": // Mặc dù là đậu, nhưng nếu có F thì vẫn tính
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
  totalTL.textContent = l_A + l_B + l_C + l_D + l_F;

  document.getElementById("creditsByTypeSection").style.display = "block";
  setStatus("Đã hiển thị phân loại tín chỉ.", "success");
}

function predictButton() {
  // Lấy tổng số tín chỉ ngành từ input
  const totalMajorCredits = parseInt(
    document.getElementById("input_Pre").value
  );
  const statusPredict = document.getElementById("status_Predict");
  const remainingCredits = document.getElementById("display_sotin_conlai");

  // Kiểm tra đầu vào
  if (
    !totalMajorCredits ||
    isNaN(totalMajorCredits) ||
    totalMajorCredits <= 0
  ) {
    setStatus("Vui lòng nhập số tín chỉ ngành hợp lệ.", "error");
    remainingCredits.textContent = "0";
    return;
  }

  // Lấy dữ liệu hiện tại
  const currentCredits = parseFloat(currentTinChi) || 0;
  const currentGPA = parseFloat(currentDTB4) || 0;

  // Tính số tín chỉ còn lại
  const remaining = Math.max(0, totalMajorCredits - currentCredits);
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
  const pointsNeededForXuatsac =
    totalPointsNeededForXuatsac - currentTotalPoints;

  // Điểm trung bình cần đạt cho các tín chỉ còn lại
  const avgNeededForGioi = remaining > 0 ? pointsNeededForGioi / remaining : 0;
  const avgNeededForXuatsac =
    remaining > 0 ? pointsNeededForXuatsac / remaining : 0;

  let resultHTML = "";

  // Kiểm tra nếu điểm trung bình hiện tại hoặc số tín chỉ không hợp lệ
  if (isNaN(currentGPA) || isNaN(currentCredits) || currentCredits <= 0) {
    resultHTML = `<p>⚠️ <strong>Lỗi:</strong> Dữ liệu điểm hiện tại không hợp lệ. Vui lòng tải dữ liệu điểm trước khi dự đoán.</p>`;
    statusPredict.innerHTML = resultHTML;
    setStatus("Dữ liệu điểm hiện tại không hợp lệ", "error");
    return;
  }

  // Phân tích kết quả đạt GIỎI
  if (currentGPA >= targetGioi) {
    resultHTML += `<p>💚 <strong>Giỏi:</strong> Bạn đã đạt đủ điều kiện xếp loại Giỏi với ĐTB hiện tại ${currentGPA.toFixed(
      2
    )}</p>`;
  } else if (remaining <= 0) {
    resultHTML += `<p>❌ <strong>Giỏi:</strong> Đã hoàn thành đủ tín chỉ nhưng ĐTB ${currentGPA.toFixed(
      2
    )} chưa đạt mức Giỏi (3.2)</p>`;
  } else if (avgNeededForGioi <= 4.0) {
    // Tính toán số tín A và B cần thiết
    const creditsA = Math.ceil((pointsNeededForGioi - remaining * 3.0) / 1.0);
    const creditsB = remaining - creditsA;

    if (creditsA <= remaining && creditsA >= 0) {
      // Tính GPA dự kiến khi đạt được số tín A và B theo đề xuất
      const expectedPointsWithAB =
        currentTotalPoints + creditsA * 4.0 + creditsB * 3.0;
      const expectedGPAGioi = (
        expectedPointsWithAB / totalMajorCredits
      ).toFixed(2);

      resultHTML += `<p>✅ <strong>Giỏi:</strong> Cần ĐTB ${avgNeededForGioi.toFixed(
        2
      )} cho ${remaining} tín còn lại.<br>
            → Cụ thể: <span style="color:blue">${creditsA} tín A</span> và <span style="color:blue">${creditsB} tín B</span><br>
            → GPA dự kiến: <strong>${expectedGPAGioi}</strong></p>`;
    } else {
      // Trường hợp số lượng tín chỉ A cần nhiều hơn tín chỉ còn lại hoặc âm
      resultHTML += `<p>⚠️ <strong>Giỏi:</strong> Số liệu không hợp lệ. Vui lòng kiểm tra lại thông tin điểm và tín chỉ.</p>`;
    }
  } else {
    // Cần cải thiện điểm cũ
    const maxPointsFromRemaining = remaining * 4.0; // Nếu tất cả A
    const stillNeeded = pointsNeededForGioi - maxPointsFromRemaining;

    if (stillNeeded > 0) {
      const improveD = Math.ceil(stillNeeded / 3.0); // D→A: +3 điểm/tín
      const improveC = Math.ceil(stillNeeded / 2.0); // C→A: +2 điểm/tín
      const improveB = Math.ceil(stillNeeded / 1.0); // B→A: +1 điểm/tín

      // Tính GPA dự kiến nếu đạt được tất cả điều kiện cải thiện
      const expectedPointsAfterImprovement =
        currentTotalPoints + maxPointsFromRemaining + stillNeeded;
      const expectedGPAGioi = (
        expectedPointsAfterImprovement / totalMajorCredits
      ).toFixed(2);

      // Lấy số tín chỉ thực tế từ UI
      const totalD =
        parseInt(document.getElementById("totalD").textContent) || 0;
      const totalC =
        parseInt(document.getElementById("totalC").textContent) || 0;
      const totalB =
        parseInt(document.getElementById("totalB").textContent) || 0;

      // Tạo mảng phương án cải thiện khả thi và mảng cảnh báo
      let viableOptions = [];
      let improvementWarnings = [];

      // Phương án 1: Cải thiện D → A
      if (totalD > 0) {
        if (improveD <= totalD) {
          viableOptions.push(
            `<span style="color:red">${improveD} tín D → A</span>`
          );
        } else {
          // Cải thiện tất cả D hiện có + thêm tín chỉ khác
          const remainingAfterAllD = stillNeeded - totalD * 3.0;

          // Kiểm tra nếu vẫn cần thêm điểm sau khi cải thiện hết D
          if (remainingAfterAllD > 0) {
            // Tính số tín chỉ C cần cải thiện sau khi đã dùng hết D
            const neededC = Math.ceil(remainingAfterAllD / 2.0);
            if (neededC <= totalC) {
              viableOptions.push(
                `<span style="color:red">TẤT CẢ ${totalD} tín D → A</span> <strong>VÀ</strong> <span style="color:orange">${neededC} tín C → A</span>`
              );
            }

            // Tính số tín chỉ B cần cải thiện sau khi đã dùng hết D
            const neededB = Math.ceil(remainingAfterAllD / 1.0);
            if (neededB <= totalB) {
              viableOptions.push(
                `<span style="color:red">TẤT CẢ ${totalD} tín D → A</span> <strong>VÀ</strong> <span style="color:blue">${neededB} tín B → A</span>`
              );
            }
          }

          improvementWarnings.push(
            `<br>⚠️ Bạn chỉ có ${totalD} tín D (thiếu ${
              improveD - totalD
            } tín để đạt mục tiêu)`
          );
        }
      } else if (improveD > 0) {
        improvementWarnings.push(`<br>⚠️ Bạn không có tín chỉ D để cải thiện`);
      }

      // Phương án 2: Cải thiện C → A
      if (totalC > 0) {
        if (improveC <= totalC) {
          viableOptions.push(
            `<span style="color:orange">${improveC} tín C → A</span>`
          );
        } else {
          // Cải thiện tối đa C hiện có + thêm tín chỉ khác
          const remainingAfterMaxC = stillNeeded - totalC * 2.0;

          // Kiểm tra nếu vẫn cần thêm điểm sau khi cải thiện tối đa C
          if (remainingAfterMaxC > 0 && totalB > 0) {
            const neededB = Math.ceil(remainingAfterMaxC / 1.0);
            if (neededB <= totalB) {
              viableOptions.push(
                `<span style="color:orange">TẤT CẢ ${totalC} tín C → A</span> <strong>VÀ</strong> <span style="color:blue">${neededB} tín B → A</span>`
              );
            }
          }

          improvementWarnings.push(
            `<br>⚠️ Bạn chỉ có ${totalC} tín C (cần ${improveC})`
          );
        }
      } else if (improveC > 0) {
        improvementWarnings.push(`<br>⚠️ Bạn không có tín chỉ C để cải thiện`);
      }

      // Phương án 3: Cải thiện B → A
      if (totalB > 0) {
        if (improveB <= totalB) {
          viableOptions.push(
            `<span style="color:blue">${improveB} tín B → A</span>`
          );
        } else {
          improvementWarnings.push(
            `<br>⚠️ Bạn chỉ có ${totalB} tín B (thiếu ${
              improveB - totalB
            } tín để đạt mục tiêu)`
          );
        }
      } else if (improveB > 0) {
        improvementWarnings.push(`<br>⚠️ Bạn không có tín chỉ B để cải thiện`);
      }

      // Phương án 4: Kết hợp nhiều loại để tối ưu hóa (ưu tiên cải thiện D trước)
      if (totalD > 0 && totalC > 0 && improveD > totalD) {
        const pointsFromD = totalD * 3.0;
        const remainingPoints = stillNeeded - pointsFromD;
        const neededC = Math.ceil(Math.min(remainingPoints / 2.0, totalC));
        const pointsFromC = neededC * 2.0;

        if (remainingPoints - pointsFromC > 0 && totalB > 0) {
          const neededB = Math.ceil((remainingPoints - pointsFromC) / 1.0);
          if (neededB <= totalB) {
            viableOptions.push(
              `<span style="color:red">TẤT CẢ ${totalD} tín D → A</span> <strong>VÀ</strong> <span style="color:orange">${neededC} tín C → A</span> <strong>VÀ</strong> <span style="color:blue">${neededB} tín B → A</span>`
            );
          }
        }
      }

      // Tính toán GPA tối đa có thể đạt khi sử dụng tất cả tín còn lại để học A
      // và cải thiện tất cả D, C và B nếu cần
      const allRemainingAsA = remaining * 4.0;
      const allD = totalD * 3.0; // Cải thiện từ 1.0 lên 4.0
      const allC = totalC * 2.0; // Cải thiện từ 2.0 lên 4.0
      const allB = totalB * 1.0; // Cải thiện từ 3.0 lên 4.0

      const maxPossiblePoints =
        currentTotalPoints + allRemainingAsA + allD + allC + allB;
      const maxPossibleGPA = (maxPossiblePoints / totalMajorCredits).toFixed(2);

      // Hiển thị kết quả dựa trên các phương án khả thi
      if (viableOptions.length === 0) {
        resultHTML += `<p>❌ <strong>Giỏi:</strong> Không thể đạt Giỏi với số tín chỉ hiện có.<br>
                → Cần đạt A cho tất cả ${remaining} tín còn lại và cải thiện các môn cũ, nhưng:<br>
                ${improvementWarnings.join("")}<br>
                → GPA tối đa có thể đạt: <strong>${maxPossibleGPA}</strong></p>`;
      } else {
        resultHTML += `<p>⚠️ <strong>Giỏi:</strong> Cần đạt A cho tất cả ${remaining} tín còn lại<br>
                → <strong>VÀ</strong> cải thiện một trong những trường hợp sau:<br>
                ${viableOptions.join(", hoặc<br>")}<br>
                → GPA dự kiến sau cải thiện: <strong>${expectedGPAGioi}</strong>
                ${improvementWarnings.join("")}</p>`;
      }
    } else {
      // Trường hợp tính toán không đúng hoặc dữ liệu không hợp lệ
      resultHTML += `<p>⚠️ <strong>Giỏi:</strong> Có lỗi khi tính toán. Vui lòng kiểm tra dữ liệu đầu vào.</p>`;
    }
  }

  // Phân tích kết quả đạt XUẤT SẮC
  if (currentGPA >= targetXuatsac) {
    resultHTML += `<p>💙 <strong>Xuất sắc:</strong> Bạn đã đạt đủ điều kiện xếp loại Xuất sắc với ĐTB hiện tại ${currentGPA.toFixed(
      2
    )}</p>`;
  } else if (remaining <= 0) {
    resultHTML += `<p>❌ <strong>Xuất sắc:</strong> Đã hoàn thành đủ tín chỉ nhưng ĐTB ${currentGPA.toFixed(
      2
    )} chưa đạt mức Xuất sắc (3.6)</p>`;
  } else if (avgNeededForXuatsac <= 4.0) {
    resultHTML += `<p>✅ <strong>Xuất sắc:</strong> Cần ĐTB ${avgNeededForXuatsac.toFixed(
      2
    )} cho ${remaining} tín còn lại.<br>`;

    if (avgNeededForXuatsac > 3.9) {
      // Tính GPA khi gần như toàn điểm A
      const expectedPointsWithAllA = currentTotalPoints + remaining * 4.0;
      const expectedGPAXuatSac = (
        expectedPointsWithAllA / totalMajorCredits
      ).toFixed(2);

      resultHTML += `→ Cần gần như toàn bộ điểm A cho các tín chỉ còn lại<br>
            → GPA dự kiến: <strong>${expectedGPAXuatSac}</strong></p>`;
    } else {
      // Tính toán số tín A và B cần thiết để đạt Xuất sắc
      const creditsA = Math.ceil(
        (pointsNeededForXuatsac - remaining * 3.0) / 1.0
      );
      const creditsB = remaining - creditsA;

      if (creditsA <= remaining && creditsA >= 0) {
        // Tính GPA dự kiến
        const expectedPointsWithAB =
          currentTotalPoints + creditsA * 4.0 + creditsB * 3.0;
        const expectedGPAXuatSac = (
          expectedPointsWithAB / totalMajorCredits
        ).toFixed(2);

        resultHTML += `→ Cụ thể: <span style="color:blue">${creditsA} tín A</span> và <span style="color:blue">${creditsB} tín B</span><br>
                → GPA dự kiến: <strong>${expectedGPAXuatSac}</strong></p>`;
      } else {
        resultHTML += `→ Số liệu không hợp lệ. Vui lòng kiểm tra lại thông tin điểm và tín chỉ.</p>`;
      }
    }
  } else {
    // Cần cải thiện điểm cũ
    const maxPointsFromRemaining = remaining * 4.0; // Nếu tất cả A
    const stillNeeded = pointsNeededForXuatsac - maxPointsFromRemaining;

    if (stillNeeded > 0) {
      const improveD = Math.ceil(stillNeeded / 3.0); // D→A: +3 điểm/tín
      const improveC = Math.ceil(stillNeeded / 2.0); // C→A: +2 điểm/tín
      const improveB = Math.ceil(stillNeeded / 1.0); // B→A: +1 điểm/tín

      // Tính GPA dự kiến nếu đạt được tất cả điều kiện cải thiện
      const expectedPointsAfterImprovement =
        currentTotalPoints + maxPointsFromRemaining + stillNeeded;
      const expectedGPAXuatSac = (
        expectedPointsAfterImprovement / totalMajorCredits
      ).toFixed(2);

      // Lấy số tín chỉ thực tế từ UI
      const totalD =
        parseInt(document.getElementById("totalD").textContent) || 0;
      const totalC =
        parseInt(document.getElementById("totalC").textContent) || 0;
      const totalB =
        parseInt(document.getElementById("totalB").textContent) || 0;

      // Tạo mảng phương án cải thiện khả thi và mảng cảnh báo
      let viableOptions = [];
      let improvementWarnings = [];

      // Phương án 1: Cải thiện D → A
      if (totalD > 0) {
        if (improveD <= totalD) {
          viableOptions.push(
            `<span style="color:red">${improveD} tín D → A</span>`
          );
        } else {
          // Cải thiện tất cả D hiện có + thêm tín chỉ khác
          const remainingAfterAllD = stillNeeded - totalD * 3.0;

          // Kiểm tra nếu vẫn cần thêm điểm sau khi cải thiện hết D
          if (remainingAfterAllD > 0) {
            // Tính số tín chỉ C cần cải thiện sau khi đã dùng hết D
            const neededC = Math.ceil(remainingAfterAllD / 2.0);
            if (neededC <= totalC) {
              viableOptions.push(
                `<span style="color:red">TẤT CẢ ${totalD} tín D → A</span> <strong>VÀ</strong> <span style="color:orange">${neededC} tín C → A</span>`
              );
            }

            // Tính số tín chỉ B cần cải thiện sau khi đã dùng hết D
            const neededB = Math.ceil(remainingAfterAllD / 1.0);
            if (neededB <= totalB) {
              viableOptions.push(
                `<span style="color:red">TẤT CẢ ${totalD} tín D → A</span> <strong>VÀ</strong> <span style="color:blue">${neededB} tín B → A</span>`
              );
            }
          }

          improvementWarnings.push(
            `<br>⚠️ Bạn chỉ có ${totalD} tín D (thiếu ${
              improveD - totalD
            } tín để đạt mục tiêu)`
          );
        }
      } else if (improveD > 0) {
        improvementWarnings.push(`<br>⚠️ Bạn không có tín chỉ D để cải thiện`);
      }

      // Phương án 2: Cải thiện C → A
      if (totalC > 0) {
        if (improveC <= totalC) {
          viableOptions.push(
            `<span style="color:orange">${improveC} tín C → A</span>`
          );
        } else {
          // Cải thiện tối đa C hiện có + thêm tín chỉ khác
          const remainingAfterMaxC = stillNeeded - totalC * 2.0;

          // Kiểm tra nếu vẫn cần thêm điểm sau khi cải thiện tối đa C
          if (remainingAfterMaxC > 0 && totalB > 0) {
            const neededB = Math.ceil(remainingAfterMaxC / 1.0);
            if (neededB <= totalB) {
              viableOptions.push(
                `<span style="color:orange">TẤT CẢ ${totalC} tín C → A</span> <strong>VÀ</strong> <span style="color:blue">${neededB} tín B → A</span>`
              );
            }
          }

          improvementWarnings.push(
            `<br>⚠️ Bạn chỉ có ${totalC} tín C (cần ${improveC})`
          );
        }
      } else if (improveC > 0) {
        improvementWarnings.push(`<br>⚠️ Bạn không có tín chỉ C để cải thiện`);
      }

      // Phương án 3: Cải thiện B → A
      if (totalB > 0) {
        if (improveB <= totalB) {
          viableOptions.push(
            `<span style="color:blue">${improveB} tín B → A</span>`
          );
        } else {
          improvementWarnings.push(
            `<br>⚠️ Bạn chỉ có ${totalB} tín B (thiếu ${
              improveB - totalB
            } tín để đạt mục tiêu)`
          );
        }
      } else if (improveB > 0) {
        improvementWarnings.push(`<br>⚠️ Bạn không có tín chỉ B để cải thiện`);
      }

      // Phương án 4: Kết hợp nhiều loại để tối ưu hóa (ưu tiên cải thiện D trước)
      if (totalD > 0 && totalC > 0 && improveD > totalD) {
        const pointsFromD = totalD * 3.0;
        const remainingPoints = stillNeeded - pointsFromD;
        const neededC = Math.ceil(Math.min(remainingPoints / 2.0, totalC));
        const pointsFromC = neededC * 2.0;

        if (remainingPoints - pointsFromC > 0 && totalB > 0) {
          const neededB = Math.ceil((remainingPoints - pointsFromC) / 1.0);
          if (neededB <= totalB) {
            viableOptions.push(
              `<span style="color:red">TẤT CẢ ${totalD} tín D → A</span> <strong>VÀ</strong> <span style="color:orange">${neededC} tín C → A</span> <strong>VÀ</strong> <span style="color:blue">${neededB} tín B → A</span>`
            );
          }
        }
      }

      // Tính toán GPA tối đa có thể đạt khi sử dụng tất cả tín còn lại để học A
      // và cải thiện tất cả D, C và B nếu cần
      const allRemainingAsA = remaining * 4.0;
      const allD = totalD * 3.0; // Cải thiện từ 1.0 lên 4.0
      const allC = totalC * 2.0; // Cải thiện từ 2.0 lên 4.0
      const allB = totalB * 1.0; // Cải thiện từ 3.0 lên 4.0

      const maxPossiblePoints =
        currentTotalPoints + allRemainingAsA + allD + allC + allB;
      const maxPossibleGPA = (maxPossiblePoints / totalMajorCredits).toFixed(2);

      // Hiển thị kết quả dựa trên các phương án khả thi
      if (viableOptions.length === 0) {
        resultHTML += `<p>❌ <strong>Xuất sắc:</strong> Không thể đạt Xuất sắc với số tín chỉ hiện có.<br>
                → Cần đạt A cho tất cả ${remaining} tín còn lại và cải thiện các môn cũ, nhưng:<br>
                ${improvementWarnings.join("")}<br>
                → GPA tối đa có thể đạt: <strong>${maxPossibleGPA}</strong></p>`;
      } else {
        resultHTML += `<p>⚠️ <strong>Xuất sắc:</strong> Cần đạt A cho <strong>TẤT CẢ</strong> ${remaining} tín còn lại<br>
                → <strong>VÀ</strong> cải thiện một trong những trường hợp sau:<br>
                ${viableOptions.join(", hoặc<br>")}<br>
                → GPA dự kiến sau cải thiện: <strong>${expectedGPAXuatSac}</strong>
                ${improvementWarnings.join("")}</p>`;
      }
    } else {
      // Trường hợp tính toán không đúng hoặc dữ liệu không hợp lệ
      resultHTML += `<p>⚠️ <strong>Xuất sắc:</strong> Có lỗi khi tính toán. Vui lòng kiểm tra dữ liệu đầu vào.</p>`;
    }
  }

  // Hiển thị kết quả
  statusPredict.innerHTML = resultHTML;

  // Hiển thị thông báo
  setStatus("Đã dự đoán chi tiết về khả năng đạt loại tốt nghiệp", "success");
}

// "Load Dữ liệu"
fetchScoresButton.addEventListener("click", () => {
  getStudentScores(false); // Force reload from server
});

// "Tổng Kết Điểm Hiện Tại"
fetchDiemButton.addEventListener("click", () => {
  displayCurrentSummary();
  displayCreditsByType();
  document.getElementById("creditsByTypeSection").style.display = "none";
});

// "Phân loại tính chỉ"
fetchPLButton.addEventListener("click", () => {
  displayCurrentSummary();
  document.getElementById("currentSummarySection").style.display = "none";
  displayCreditsByType();
});

// "Dự đoán"
document.getElementById("predictButton").addEventListener("click", () => {
  predictButton();
});

// "Xuất báo cáo PDF"
exportReportButton.addEventListener("click", async () => {
  if (!dataCraw) {
    setStatus("Không có dữ liệu để xuất báo cáo.", "warning");
    return;
  }
  
  setLoadingState(true, "exportReportButton");
  setStatus("Đang tạo báo cáo PDF...", "loading");
  
  try {
    const reportContent = generateReportContent();
    await generatePDF(reportContent);
    setStatus("Đã xuất báo cáo PDF thành công!", "success");
  } catch (error) {
    console.error("Lỗi khi xuất PDF:", error);
    setStatus("Có lỗi khi xuất báo cáo PDF.", "error");
  } finally {
    setLoadingState(false, "exportReportButton");
  }
});

// "Xóa Cache"
clearCacheButton.addEventListener("click", async () => {
  try {
    await chrome.storage.local.remove(["cachedScoreData", "cacheTimestamp"]);
    dataCraw = null;
    updateFetchScoresButtonState();
    setStatus("Đã xóa cache thành công.", "success");
  } catch (error) {
    console.error("Lỗi khi xóa cache:", error);
    setStatus("Có lỗi khi xóa cache.", "error");
  }
});

// Hàm tạo nội dung báo cáo
function generateReportContent() {
  if (!dataCraw) return "";
  
  const dsDiemHocky = dataCraw.data.ds_diem_hocky;
  let currentSemester = "";
  let currentDTB10 = 0;
  let currentDTB4 = 0;
  let currentTinChi = 0;
  
  // Lấy thông tin học kỳ gần nhất
  for (let i = 0; i < dsDiemHocky.length; i++) {
    const diemHocky = dsDiemHocky[i];
    if (diemHocky.so_tin_chi_dat_hk && diemHocky.so_tin_chi_dat_tich_luy) {
      currentSemester = diemHocky.ten_hoc_ky;
      currentDTB10 = diemHocky.dtb_tich_luy_he_10;
      currentDTB4 = diemHocky.dtb_tich_luy_he_4;
      currentTinChi = diemHocky.so_tin_chi_dat_tich_luy;
      break;
    }
  }
  
  // Tính phân loại tín chỉ
  let l_A = 0, l_B = 0, l_C = 0, l_D = 0, l_F = 0;
  const dsDiem = dsDiemHocky.flatMap(hk => hk.ds_diem_mon_hoc);
  
  for (let i = 0; i < dsDiem.length; i++) {
    const diemMonHoc = dsDiem[i];
    if (diemMonHoc.ket_qua == 1) {
      const tinChi = parseInt(diemMonHoc.so_tin_chi) || 0;
      switch (diemMonHoc.diem_tk_chu) {
        case "A": l_A += tinChi; break;
        case "B": l_B += tinChi; break;
        case "C": l_C += tinChi; break;
        case "D": l_D += tinChi; break;
        case "F": l_F += tinChi; break;
      }
    }
  }
  
  return `
    <h1>BÁO CÁO KẾT QUẢ HỌC TẬP</h1>
    <h2>Đại học Sài Gòn (SGU)</h2>
    <hr>
    
    <h3>Tổng kết hiện tại (${currentSemester})</h3>
    <table border="1" style="width:100%; border-collapse: collapse;">
      <tr><td><strong>ĐTB Học kỳ (Hệ 10)</strong></td><td>${currentDTB10}</td></tr>
      <tr><td><strong>ĐTB Học kỳ (Hệ 4)</strong></td><td>${currentDTB4}</td></tr>
      <tr><td><strong>Tổng tín chỉ tích lũy</strong></td><td>${currentTinChi}</td></tr>
      <tr><td><strong>Xếp loại hiện tại</strong></td><td>${calculateXepLoai(currentDTB4)}</td></tr>
    </table>
    
    <h3>Phân loại tín chỉ</h3>
    <table border="1" style="width:100%; border-collapse: collapse;">
      <tr><td><strong>Tín chỉ loại A</strong></td><td style="color: blue;">${l_A}</td></tr>
      <tr><td><strong>Tín chỉ loại B</strong></td><td style="color: blue;">${l_B}</td></tr>
      <tr><td><strong>Tín chỉ loại C</strong></td><td style="color: blue;">${l_C}</td></tr>
      <tr><td><strong>Tín chỉ loại D</strong></td><td style="color: red;">${l_D}</td></tr>
      <tr><td><strong>Tín chỉ loại F</strong></td><td style="color: red;">${l_F}</td></tr>
      <tr><td><strong>Tổng cộng</strong></td><td style="color: green;"><strong>${l_A + l_B + l_C + l_D + l_F}</strong></td></tr>
    </table>
    
    <hr>
    <p><em>Báo cáo được tạo bởi SGU Extension vào ${new Date().toLocaleString('vi-VN')}</em></p>
  `;
}

// Hàm tạo PDF (sử dụng window.print với CSS tùy chỉnh)
async function generatePDF(content) {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Báo cáo kết quả học tập</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          h1, h2 { text-align: center; color: #2c3e50; }
          h3 { color: #34495e; margin-top: 20px; }
          hr { margin: 20px 0; }
          @media print {
            body { margin: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        ${content}
        <br><br>
        <button onclick="window.print()">In báo cáo</button>
        <button onclick="window.close()">Đóng</button>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// "Hiển thị thống kê"
showStatisticsButton.addEventListener("click", () => {
  displayAdvancedStatistics();
});

// Hàm hiển thị thống kê nâng cao
function displayAdvancedStatistics() {
  if (!dataCraw) {
    setStatus("Không có dữ liệu để tính thống kê.", "warning");
    return;
  }

  const dsDiem = dataCraw.data.ds_diem_hocky.flatMap(hk => hk.ds_diem_mon_hoc);
  const validScores = dsDiem.filter(d => d.diem_tk_he_10 !== null && d.diem_tk_he_10 !== "");
  
  if (validScores.length === 0) {
    setStatus("Không có dữ liệu điểm hợp lệ để thống kê.", "warning");
    return;
  }

  // Tính xu hướng điểm (so sánh 3 học kỳ gần nhất)
  const semesters = dataCraw.data.ds_diem_hocky.filter(hk => 
    hk.dtb_hk_he_4 && hk.dtb_hk_he_4 !== ""
  ).slice(0, 3);
  
  let trendText = "Không đủ dữ liệu";
  if (semesters.length >= 2) {
    const recent = parseFloat(semesters[0].dtb_hk_he_4);
    const previous = parseFloat(semesters[1].dtb_hk_he_4);
    
    if (recent > previous) {
      trendText = "📈 Tăng (" + (recent - previous).toFixed(2) + ")";
    } else if (recent < previous) {
      trendText = "📉 Giảm (" + (previous - recent).toFixed(2) + ")";
    } else {
      trendText = "➡️ Ổn định";
    }
  }

  // Tìm môn học xuất sắc nhất và cần cải thiện nhất
  const passedSubjects = validScores.filter(d => d.ket_qua == 1);
  let bestSubject = "Không có";
  let worstSubject = "Không có";
  
  if (passedSubjects.length > 0) {
    const sortedByScore = passedSubjects.sort((a, b) => 
      parseFloat(b.diem_tk_he_10) - parseFloat(a.diem_tk_he_10)
    );
    
    bestSubject = `${sortedByScore[0].ten_mon_hoc} (${sortedByScore[0].diem_tk_he_10})`;
    worstSubject = `${sortedByScore[sortedByScore.length - 1].ten_mon_hoc} (${sortedByScore[sortedByScore.length - 1].diem_tk_he_10})`;
  }

  // Tính tỷ lệ đậu
  const totalSubjects = validScores.length;
  const passedSubjectsCount = passedSubjects.length;
  const passRate = totalSubjects > 0 ? ((passedSubjectsCount / totalSubjects) * 100).toFixed(1) + "%" : "0%";

  // Hiển thị kết quả
  document.getElementById("trendIndicator").textContent = trendText;
  document.getElementById("bestSubject").textContent = bestSubject;
  document.getElementById("worstSubject").textContent = worstSubject;
  document.getElementById("passRate").textContent = passRate;
  document.getElementById("statisticsSection").style.display = "block";
  
  setStatus("Đã hiển thị thống kê nâng cao.", "success");
}

// --- CẬP NHẬT PHẦN NÀY ---
async function getSemester() {
  const apiURL = "https://thongtindaotao.sgu.edu.vn/api/sch/w-locdshockytkbuser";
  
  if (!currentAuthToken) {
    setStatus("Vui lòng lấy token trước khi tải học kỳ.", "error");
    return null;
  }

  // Kiểm tra cache
  if (cachedSemesterData && cacheExpiry && Date.now() < cacheExpiry) {
    return cachedSemesterData;
  }

  setStatus("Đang tải thông tin học kỳ...", "loading");
  
  const payload = {
    filter: { is_tieng_anh: null },
    additional: {
      paging: { limit: 100, page: 1 },
      ordering: [{ name: "hoc_ky", order_type: 1 }],
    },
  };

  try {
    const response = await fetch(apiURL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentAuthToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Lỗi HTTP khi tải học kỳ: ${response.status} - ${response.statusText}`, errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        setStatus(`Lỗi tải học kỳ: ${errorData.message || response.statusText}`, "error");
      } catch (e) {
        setStatus(`Lỗi tải học kỳ: ${response.status} - ${response.statusText}`, "error");
      }
      return null;
    }

    const data = await response.json();
    const semesterData = data.data.hoc_ky_theo_ngay_hien_tai;
    
    // Cache kết quả
    cachedSemesterData = semesterData;
    cacheExpiry = Date.now() + CACHE_DURATION;
    
    return semesterData;
  } catch (error) {
    console.error("Có lỗi xảy ra khi lấy dữ liệu học kỳ:", error);
    setStatus(`Lỗi khi lấy dữ liệu học kỳ: ${error.message}`, "error");
    return null;
  }
}

async function fetchTKB(getSemesterResult) {
  const apiUrl =
    "https://thongtindaotao.sgu.edu.vn/api/sch/w-locdstkbtuanusertheohocky";
  if (!currentAuthToken) {
    setStatus("Vui lòng lấy token trước khi tải thời khóa biểu.", "error");
    return null;
  }
  // const currentSemesterId = 20243; // Học kỳ muốn tra cứu
  console.log("Học kỳ hiện tại:", getSemesterResult);
  const payload = {
    filter: {
      hoc_ky: getSemesterResult,
      ten_hoc_ky: "",
    },
    additional: {
      paging: {
        limit: 100,
        page: 1,
      },
      ordering: [
        {
          name: null,
          order_type: null,
        },
      ],
    },
  };

  setStatus("Đang tải dữ liệu thời khóa biểu...", "info");

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentAuthToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Lỗi HTTP khi tải TKB: ${response.status} - ${response.statusText}`,
        errorText
      );
      try {
        const errorData = JSON.parse(errorText);
        setStatus(
          `Lỗi tải TKB: ${errorData.message || response.statusText}`,
          "error"
        );
      } catch (e) {
        setStatus(
          `Lỗi tải TKB: ${response.status} - ${response.statusText}`,
          "error"
        );
      }
      return null;
    }

    const data = await response.json();
    console.log("Dữ liệu TKB gốc:", data);
    return data.data;
  } catch (error) {
    console.error("Có lỗi xảy ra khi lấy dữ liệu TKB:", error);
    setStatus(`Lỗi khi lấy dữ liệu TKB: ${error.message}`, "error");
    return null;
  }
}

// CẬP NHẬT LẮNG NGHE SỰ KIỆN CHO NÚT 'tkb'
document.getElementById("tkb").addEventListener("click", async () => {
  setLoadingState(true);
  setStatus("Đang tải thời khóa biểu...", "loading");
  
  try {
    const getSemesterResult = await getSemester();
    if (!getSemesterResult) {
      setStatus("Không thể lấy thông tin học kỳ hiện tại.", "error");
      return;
    }
    
    console.log("Học kỳ hiện tại:", getSemesterResult);
    const tkbResult = await fetchTKB(getSemesterResult);
    
    if (tkbResult && tkbResult.length > 0) {
      localStorage.setItem("sguTkbData", JSON.stringify({
        ds_tuan_tkb: tkbResult,
        ds_tiet_trong_ngay: [],
        timestamp: Date.now()
      }));
      
      setStatus("Đã tải TKB thành công. Đang mở tab xem trước...", "success");
      chrome.tabs.create({ url: chrome.runtime.getURL("tkb_viewer.html") });
    } else {
      setStatus("Không có dữ liệu thời khóa biểu hoặc dữ liệu rỗng.", "warning");
    }
  } catch (error) {
    console.error("Lỗi khi tải TKB:", error);
    setStatus(`Lỗi khi tải thời khóa biểu: ${error.message}`, "error");
  } finally {
    setLoadingState(false);
  }
});
