const tokenInput = document.getElementById("tokenInput");
const fetchTokenButton = document.getElementById("fetchTokenButton");
const copyTokenButton = document.getElementById("copyTokenButton");
const saveTokenButton = document.getElementById("saveTokenButton");
const removeTokenButton = document.getElementById("removeTokenButton");
const fetchScoresButton = document.getElementById("fetchScoresButton");
const fetchDiemButton = document.getElementById("fetch_diem");
const fetchPLButton = document.getElementById("fetch_PL");
const statusDiv = document.getElementById("status");

let currentTinChi = 0;
let currentDTB4 = 0;
let dataCraw = null;
let currentAuthToken = "";

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
  }
}

// Cập nhật trạng thái của nút "Chạy" dựa trên việc có token hay không
function updateFetchScoresButtonState() {
  fetchScoresButton.disabled = !currentAuthToken;
  fetchDiemButton.disabled = !dataCraw; // Nút "Tính điểm" chỉ hoạt động khi có dataCraw
  fetchPLButton.disabled = !dataCraw; // Nút "Phân loại tính chỉ" chỉ hoạt động khi có dataCraw
}

// Hàm khởi tạo khi popup mở
document.addEventListener("DOMContentLoaded", async () => {
  // Thử lấy token đã bắt được từ storage ngay khi popup mở
  const result = await chrome.storage.local.get("capturedAuthToken");
  if (result.capturedAuthToken) {
    currentAuthToken = result.capturedAuthToken;
    tokenInput.value = currentAuthToken;
    setStatus("Token đã sẵn sàng từ phiên trước.", "success");
  } else {
    // Nếu không có token đã bắt được, thử lấy token đã lưu thủ công trước đó
    const manualTokenResult = await chrome.storage.local.get("manualAuthToken");
    if (manualTokenResult.manualAuthToken) {
      currentAuthToken = manualTokenResult.manualAuthToken;
      tokenInput.value = currentAuthToken;
      setStatus("Token đã lưu thủ công đã sẵn sàng.", "success");
    } else {
      setStatus(
        "Không có token. Vui lòng lấy token hoặc dán thủ công.",
        "info"
      );
    }
  }
  updateFetchScoresButtonState();
});

// Xử lý sự kiện khi nhấn nút "Lấy Token" (kết hợp tự động và thủ công)
fetchTokenButton.addEventListener("click", async () => {
  // Ưu tiên lấy từ input nếu người dùng đã dán
  if (tokenInput.value && tokenInput.value.startsWith("Bearer ")) {
    currentAuthToken = tokenInput.value.replace("Bearer ", "");
    setStatus("Đã lấy token từ ô nhập liệu.", "success");
    updateFetchScoresButtonState();
    return;
  } else if (tokenInput.value) {
    currentAuthToken = tokenInput.value;
    setStatus("Đã lấy token từ ô nhập liệu.", "success");
    updateFetchScoresButtonState();
    return;
  }

  // Nếu input rỗng, cố gắng lấy token tự động từ background script
  setStatus(
    "Đang chờ token được bắt từ phiên hoạt động... Vui lòng tải lại trang SGU nếu chưa thấy.",
    "info"
  );
  fetchScoresButton.disabled = true;

  const response = await chrome.runtime.sendMessage({
    action: "getCapturedToken",
  });
  if (response && response.token) {
    currentAuthToken = response.token;
    tokenInput.value = currentAuthToken;
    setStatus("Đã lấy token tự động thành công từ phiên hoạt động!", "success");
  } else {
    setStatus(
      "Chưa có token được bắt. Đảm bảo bạn đã đăng nhập và một API đã gửi token.",
      "warning"
    );
    currentAuthToken = "";
  }
  updateFetchScoresButtonState();
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
async function getStudentScores() {
  const apiUrl =
    "https://thongtindaotao.daihocsaigon.edu.vn/api/srm/w-locdsdiemsinhvien?hien_thi_mon_theo_hkdk=false";

  if (!currentAuthToken) {
    setStatus("Vui lòng lấy token trước khi tải điểm.", "error");
    return null;
  }

  setStatus("Đang tải dữ liệu điểm...", "info");

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentAuthToken}`, // SỬ DỤNG TOKEN ĐÃ LẤY
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Lỗi HTTP khi tải điểm: ${response.status} - ${response.statusText}`,
        errorText
      );
      setStatus(
        `Lỗi tải điểm: ${response.status} - ${response.statusText}`,
        "error"
      );
      return null;
    }

    const data = await response.json();
    setStatus("Đã tải điểm thành công!", "success");
    dataCraw = data;
    updateFetchScoresButtonState(); // Cập nhật trạng thái nút "Tính điểm" sau khi có dữ liệu
    return data;
  } catch (error) {
    console.error("Có lỗi xảy ra khi lấy dữ liệu API điểm:", error);
    setStatus(`Lỗi khi lấy dữ liệu điểm: ${error.message}`, "error");
    return null;
  }
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
  getStudentScores();
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

// --- CẬP NHẬT PHẦN NÀY ---
async function getSemester() {
  const apiURL =
    "https://thongtindaotao.daihocsaigon.edu.vn/api/sch/w-locdshockytkbuser";
  if (!currentAuthToken) {
    setStatus("Vui lòng lấy token trước khi tải học kỳ.", "error");
    return null;
  }
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
      console.error(
        `Lỗi HTTP khi tải học kỳ: ${response.status} - ${response.statusText}`,
        errorText
      );
      try {
        const errorData = JSON.parse(errorText);
        setStatus(
          `Lỗi tải học kỳ: ${errorData.message || response.statusText}`,
          "error"
        );
      } catch (e) {
        setStatus(
          `Lỗi tải học kỳ: ${response.status} - ${response.statusText}`,
          "error"
        );
      }
      return null;
    }
    const data = await response.json();
    return data.data.hoc_ky_theo_ngay_hien_tai;
  } catch (error) {
    console.error("Có lỗi xảy ra khi lấy dữ liệu học kỳ:", error);
    setStatus(`Lỗi khi lấy dữ liệu học kỳ: ${error.message}`, "error");
    return null;
  }
}

async function fetchTKB(getSemesterResult) {
  const apiUrl =
    "https://thongtindaotao.daihocsaigon.edu.vn/api/sch/w-locdstkbtuanusertheohocky";
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
  setStatus("Đang tải thời khóa biểu...", "info");
  const getSemesterResult = await getSemester(); // Chờ getSemester hoàn thành
  console.log("Học kỳ hiện tại:", getSemesterResult);
  const tkbResult = await fetchTKB(getSemesterResult); // Chờ fetchTKB hoàn thành
  if (tkbResult) {
    localStorage.setItem("sguTkbData", JSON.stringify(tkbResult));
    setStatus("Đã tải TKB thành công. Đang mở tab xem trước...", "success");
    // Mở tab mới để hiển thị thời khóa biểu
    chrome.tabs.create({ url: chrome.runtime.getURL("tkb_viewer.html") });
  } else {
    setStatus(
      "Không thể tải thời khóa biểu. Vui lòng kiểm tra lại token hoặc mạng.",
      "error"
    );
  }
});
