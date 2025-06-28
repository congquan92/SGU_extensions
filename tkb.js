document.addEventListener('DOMContentLoaded', () => {
    const weekSelect = document.getElementById('weekSelect');
    const prevWeekBtn = document.getElementById('prevWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    const timetableDisplay = document.getElementById('timetableDisplay');
    const statusMessageDiv = document.getElementById('statusMessage');
    const downloadPngBtn = document.getElementById('downloadPngBtn');
    const downloadIcsBtn = document.getElementById('downloadIcsBtn')

    let allTkbData = []; // To store all weeks of TKB data
    let dsTietTrongNgay = []; // To store period details
    let currentWeekIndex = 0; // To keep track of the currently displayed week

    // Lấy ngày hiện tại (chỉ ngày, tháng, năm)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Đặt giờ về 0 để chỉ so sánh ngày

    function setStatusMessage(message, type = 'info') {
        statusMessageDiv.textContent = message;
        statusMessageDiv.style.display = 'block';
        if (type === 'error') {
            statusMessageDiv.style.backgroundColor = '#f8d7da';
            statusMessageDiv.style.color = '#721c24';
        } else if (type === 'success') {
            statusMessageDiv.style.backgroundColor = '#d4edda';
            statusMessageDiv.style.color = '#155724';
        } else {
            statusMessageDiv.style.backgroundColor = '#e0f7fa';
            statusMessageDiv.style.color = '#006064';
        }
        // setTimeout(() => {
        //     statusMessageDiv.style.display = 'none';
        // }, 3000); // Hide after 3 seconds
    }

    function loadTkbData() {
        const storedData = localStorage.getItem('sguTkbData');
        if (storedData) {
            try {
                const parsedData = JSON.parse(storedData);
                allTkbData = parsedData.ds_tuan_tkb || [];
                dsTietTrongNgay = parsedData.ds_tiet_trong_ngay || [];

                if (allTkbData.length > 0) {
                    populateWeekSelect(); // Populate the dropdown
                    // Tìm tuần hiện tại (tuần chứa ngày hôm nay)
                    let foundCurrentWeek = false;
                    for (let i = 0; i < allTkbData.length; i++) {
                        let weekStartDate = null;
                        // Ưu tiên sử dụng ngay_bat_dau
                        if (allTkbData[i].ngay_bat_dau) {
                            const [d, m, y] = allTkbData[i].ngay_bat_dau.split('/').map(Number);
                            weekStartDate = new Date(y, m - 1, d);
                            weekStartDate.setHours(0,0,0,0);
                        } else {
                            // Fallback với regex đã sửa
                            const weekInfoMatch = allTkbData[i].thong_tin_tuan ? allTkbData[i].thong_tin_tuan.match(/\[từ ngày (.*?) đến ngày .*?\]/) : null;
                            const startDateString = weekInfoMatch ? weekInfoMatch[1] : '';
                            if (startDateString) {
                                const currentYear = new Date().getFullYear();
                                const [startDay, startMonth] = startDateString.split('/').map(Number);
                                weekStartDate = new Date(currentYear, startMonth - 1, startDay);
                                weekStartDate.setHours(0,0,0,0);
                            }
                        }
                        
                        if (weekStartDate) {
                            const weekEndDate = new Date(weekStartDate);
                            weekEndDate.setDate(weekStartDate.getDate() + 6); // Tuần thường có 7 ngày
                            weekEndDate.setHours(0, 0, 0, 0);
                            
                            if (today >= weekStartDate && today <= weekEndDate) {
                                currentWeekIndex = i;
                                foundCurrentWeek = true;
                                break;
                            }
                        }
                    }

                    if (!foundCurrentWeek) {
                        currentWeekIndex = 0; // Mặc định về tuần đầu tiên nếu không tìm thấy tuần hiện tại
                    }
                    
                    weekSelect.value = currentWeekIndex; // Set dropdown to the determined week
                    displayTimetable(allTkbData[currentWeekIndex]);
                    updateNavigationButtons();
                    setStatusMessage('Đã tải thời khóa biểu thành công.');
                } else {
                    timetableDisplay.innerHTML = '<p class="no-schedule">Không tìm thấy dữ liệu thời khóa biểu nào.</p>';
                    weekSelect.disabled = true;
                    prevWeekBtn.disabled = true;
                    nextWeekBtn.disabled = true;
                    setStatusMessage('Dữ liệu thời khóa biểu rỗng.', 'warning');
                }
            } catch (e) {
                console.error('Lỗi khi phân tích dữ liệu TKB từ localStorage:', e);
                timetableDisplay.innerHTML = '<p class="no-schedule">Đã xảy ra lỗi khi tải dữ liệu thời khóa biểu.</p>';
                weekSelect.disabled = true;
                prevWeekBtn.disabled = true;
                nextWeekBtn.disabled = true;
                setStatusMessage('Lỗi định dạng dữ liệu thời khóa biểu.', 'error');
            }
        } else {
            timetableDisplay.innerHTML = '<p class="no-schedule">Không tìm thấy dữ liệu thời khóa biểu. Vui lòng quay lại Popup và tải TKB.</p>';
            weekSelect.disabled = true;
            prevWeekBtn.disabled = true;
            nextWeekBtn.disabled = true;
            setStatusMessage('Không tìm thấy dữ liệu thời khóa biểu trong bộ nhớ cục bộ.', 'warning');
        }
    }

    function populateWeekSelect() {
        weekSelect.innerHTML = ''; // Clear existing options
        allTkbData.forEach((week, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = week.thong_tin_tuan || `Tuần ${index + 1}`;
            weekSelect.appendChild(option);
        });
    }

    function updateNavigationButtons() {
        prevWeekBtn.disabled = currentWeekIndex === 0;
        nextWeekBtn.disabled = currentWeekIndex === allTkbData.length - 1;
    }

    weekSelect.addEventListener('change', (event) => {
        currentWeekIndex = parseInt(event.target.value);
        displayTimetable(allTkbData[currentWeekIndex]);
        updateNavigationButtons();
        setStatusMessage(`Đang hiển thị: ${allTkbData[currentWeekIndex].thong_tin_tuan}`);
    });

    prevWeekBtn.addEventListener('click', () => {
        if (currentWeekIndex > 0) {
            currentWeekIndex--;
            weekSelect.value = currentWeekIndex; // Cập nhật dropdown
            displayTimetable(allTkbData[currentWeekIndex]);
            updateNavigationButtons();
            setStatusMessage(`Đang hiển thị tuần: ${allTkbData[currentWeekIndex].thong_tin_tuan}`);
        }
    });

    nextWeekBtn.addEventListener('click', () => {
        if (currentWeekIndex < allTkbData.length - 1) {
            currentWeekIndex++;
            weekSelect.value = currentWeekIndex; // Cập nhật dropdown
            displayTimetable(allTkbData[currentWeekIndex]);
            updateNavigationButtons();
            setStatusMessage(`Đang hiển thị tuần: ${allTkbData[currentWeekIndex].thong_tin_tuan}`);
        }
    });
    
     // Logic tải xuống PNG
    downloadPngBtn.addEventListener('click', () => {
        setStatusMessage('Đang tạo hình ảnh...', 'info');
        // Sử dụng html2canvas để chụp nội dung của .container
        html2canvas(document.querySelector('.container'), {
            scale: 2, // Tăng độ phân giải để hình ảnh rõ nét hơn
            useCORS: true // Quan trọng nếu có hình ảnh/font từ nguồn khác
        }).then(canvas => {
            // Tạo một link ẩn để tải xuống
            const link = document.createElement('a');
            link.download = `thoi_khoa_bieu_tuan_${currentWeekIndex + 1}.png`;
            link.href = canvas.toDataURL('image/png'); // Chuyển canvas thành URL dữ liệu PNG
            document.body.appendChild(link); // Thêm link vào body (tạm thời)
            link.click(); // Kích hoạt click để tải xuống
            document.body.removeChild(link); // Xóa link sau khi tải
            setStatusMessage('Đã tải xuống hình ảnh thành công!', 'success');
        }).catch(error => {
            console.error('Lỗi khi tạo hình ảnh:', error);
            setStatusMessage('Lỗi khi tải xuống hình ảnh TKB.', 'error');
        });
    });

     // **********************************************
    //  Logic tải xuống ICS
    // **********************************************
     downloadIcsBtn.addEventListener('click', () => {
        setStatusMessage('Đang tạo file lịch (.ics) cho tất cả các tuần...', 'info');

        if (!allTkbData || allTkbData.length === 0) {
            setStatusMessage('Không có dữ liệu thời khóa biểu để xuất.', 'warning');
            return;
        }

        let icsContent = `BEGIN:VCALENDAR\r\n`;
        icsContent += `VERSION:2.0\r\n`;
        icsContent += `PRODID:-//SGU TKB Viewer//NONSGML v1.0//EN\r\n`;
        icsContent += `CALSCALE:GREGORIAN\r\n`;
        icsContent += `METHOD:PUBLISH\r\n`;
        icsContent += `X-WR-CALNAME:Thời Khóa Biểu SGU\r\n`; // Tên lịch khi nhập vào GG Calendar

        let eventCounter = 0; // Để tạo UID duy nhất cho mỗi sự kiện

        allTkbData.forEach((weekData) => { // Lặp qua TẤT CẢ các tuần
            let weekStartDateObj = null;

            if (weekData.ngay_bat_dau) {
                const [d, m, y] = weekData.ngay_bat_dau.split('/').map(Number);
                weekStartDateObj = new Date(y, m - 1, d);
                weekStartDateObj.setHours(0,0,0,0);
            } else {
                const weekInfoMatch = weekData.thong_tin_tuan ? weekData.thong_tin_tuan.match(/\[từ ngày (.*?) đến ngày .*?\]/) : null;
                const startDateString = weekInfoMatch ? weekInfoMatch[1] : '';
                if (startDateString) {
                    // Cần xác định năm cho ngày bắt đầu nếu chỉ có ngày/tháng.
                    // Sử dụng năm của ngày hiện tại hoặc năm của tuần đầu tiên trong TKB.
                    // Để đơn giản và tránh lỗi năm cũ/mới, có thể lấy năm từ tuần đầu tiên
                    // hoặc giả định năm hiện tại nếu không có thông tin cụ thể.
                    // Tốt nhất là API nên trả về năm trong ngay_bat_dau hoặc thong_tin_tuan.
                    // Tạm thời, ta có thể lấy năm của tuần đầu tiên nếu ngay_bat_dau không có.
                    let year = new Date().getFullYear();
                    if (allTkbData.length > 0 && allTkbData[0].ngay_bat_dau) {
                        year = parseInt(allTkbData[0].ngay_bat_dau.split('/')[2]);
                    }
                    const [startDay, startMonth] = startDateString.split('/').map(Number);
                    weekStartDateObj = new Date(year, startMonth - 1, startDay);
                    weekStartDateObj.setHours(0,0,0,0);
                }
            }

            if (!weekStartDateObj || !weekData.ds_thoi_khoa_bieu || weekData.ds_thoi_khoa_bieu.length === 0) {
                console.warn(`Bỏ qua tuần: ${weekData.thong_tin_tuan || 'Không rõ thông tin'} do thiếu ngày bắt đầu hoặc dữ liệu TKB.`);
                return; // Bỏ qua tuần này và chuyển sang tuần tiếp theo
            }

            weekData.ds_thoi_khoa_bieu.forEach((lesson) => { // Lặp qua các buổi học trong mỗi tuần
                const lessonDateObj = getDateForDay(weekStartDateObj, lesson.thu_kieu_so);
                const startPeriodTimes = getPeriodTimes(lesson.tiet_bat_dau);
                const endPeriodTimes = getPeriodTimes(lesson.tiet_bat_dau + lesson.so_tiet - 1);

                if (lessonDateObj && startPeriodTimes && endPeriodTimes) {
                    const startDateTime = new Date(
                        lessonDateObj.getFullYear(),
                        lessonDateObj.getMonth(),
                        lessonDateObj.getDate(),
                        parseInt(startPeriodTimes.start.split(':')[0]),
                        parseInt(startPeriodTimes.start.split(':')[1])
                    );
                    const endDateTime = new Date(
                        lessonDateObj.getFullYear(),
                        lessonDateObj.getMonth(),
                        lessonDateObj.getDate(),
                        parseInt(endPeriodTimes.end.split(':')[0]),
                        parseInt(endPeriodTimes.end.split(':')[1])
                    );

                    const icsStart = formatIcsDateTime(startDateTime);
                    const icsEnd = formatIcsDateTime(endDateTime);
                    
                    eventCounter++; // Tăng bộ đếm để đảm bảo UID duy nhất
                    // UID nên đủ ngẫu nhiên hoặc chứa thông tin duy nhất
                    const uid = `${Date.now()}-${eventCounter}-${lesson.ma_mon}-${lesson.thu_kieu_so}-${lesson.tiet_bat_dau}`;

                    icsContent += `BEGIN:VEVENT\r\n`;
                    icsContent += `UID:${uid}\r\n`;
                    icsContent += `DTSTAMP:${formatIcsDateTime(new Date())}Z\r\n`; // Timestamp của lúc tạo event (UTC)
                    icsContent += `DTSTART;TZID=Asia/Ho_Chi_Minh:${icsStart}\r\n`; // Giờ địa phương + TZID
                    icsContent += `DTEND;TZID=Asia/Ho_Chi_Minh:${icsEnd}\r\n`;   // Giờ địa phương + TZID
                    icsContent += `SUMMARY:${lesson.ten_mon || 'Không có tên môn'}\r\n`;
                    if (lesson.ma_phong) {
                        icsContent += `LOCATION:${lesson.ma_phong}\r\n`;
                    }
                    let description = `Mã môn: ${lesson.ma_mon || 'N/A'}`;
                    if (lesson.ten_giang_vien) {
                        description += `\\nGiảng viên: ${lesson.ten_giang_vien}`;
                    }
                    if (weekData.thong_tin_tuan) {
                        description += `\\nTuần: ${weekData.thong_tin_tuan}`; // Thêm thông tin tuần vào mô tả
                    }
                    icsContent += `DESCRIPTION:${description.replace(/(\r\n|\n|\r)/gm, " ")}\r\n`; // Xóa bỏ ký tự xuống dòng không mong muốn
                    icsContent += `END:VEVENT\r\n`;
                }
            });
        });

        icsContent += `END:VCALENDAR\r\n`;

        // Tạo và tải xuống file .ics
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `TKB_SGU_ToanBo_Lich.ics`; // Đổi tên file để phản ánh tất cả các tuần
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setStatusMessage('Đã tạo và tải xuống file lịch (.ics) cho tất cả các tuần thành công!', 'success');
    });

    // Hàm định dạng ngày giờ cho ICS (YYYYMMDDTHHMMSS)
    function formatIcsDateTime(dateObj) {
        const year = dateObj.getFullYear();
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const day = dateObj.getDate().toString().padStart(2, '0');
        const hours = dateObj.getHours().toString().padStart(2, '0');
        const minutes = dateObj.getMinutes().toString().padStart(2, '0');
        const seconds = dateObj.getSeconds().toString().padStart(2, '0');
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    }


    function getDayName(dayOfWeek) {
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        if (dayOfWeek === 8) return days[0]; // Sunday (API uses 8 for Sunday)
        return days[dayOfWeek - 1]; // Monday (2) -> index 1, etc.
    }
    
    // Hàm này nhận vào một đối tượng Date (weekStartDateObj)
    function getDateForDay(weekStartDateObj, dayOfWeekNumber) {
        const targetDate = new Date(weekStartDateObj); // Tạo một bản sao để không ảnh hưởng đến đối tượng gốc
        let dayOffset;

        if (dayOfWeekNumber === 8) { // Chủ Nhật (API value)
            dayOffset = 6; // Chủ Nhật là 6 ngày sau Thứ Hai
        } else { // Thứ Hai đến Thứ Bảy
            dayOffset = dayOfWeekNumber - 2; // Thứ Hai (2) -> 0, Thứ Ba (3) -> 1, ..., Thứ Bảy (7) -> 5
        }
        
        targetDate.setDate(weekStartDateObj.getDate() + dayOffset);
        targetDate.setHours(0,0,0,0); // Đảm bảo đồng nhất về thời gian
        return targetDate;
    }

    function getPeriodTimes(tiet) {
        const period = dsTietTrongNgay.find(p => p.tiet === tiet);
        return period ? { start: period.gio_bat_dau, end: period.gio_ket_thuc } : null;
    }

   function displayTimetable(weekData) {
        if (!weekData || !weekData.ds_thoi_khoa_bieu || !Array.isArray(weekData.ds_thoi_khoa_bieu)) {
            timetableDisplay.innerHTML = '<p class="no-schedule">Không có thời khóa biểu chi tiết cho tuần này.</p>';
            return;
        }

        timetableDisplay.innerHTML = ''; // Clear previous content

        // Group lessons by day
        const lessonsByDay = {};
        for (let i = 2; i <= 8; i++) { // From Monday (2) to Sunday (8) based on API's thu_kieu_so
            lessonsByDay[i] = [];
        }

        weekData.ds_thoi_khoa_bieu.forEach(lesson => {
            if (lesson.thu_kieu_so && lessonsByDay[lesson.thu_kieu_so]) {
                lessonsByDay[lesson.thu_kieu_so].push(lesson);
            }
        });

        // Sort lessons within each day by tiết_bat_dau (start time)
        Object.values(lessonsByDay).forEach(dayLessons => {
            dayLessons.sort((a, b) => a.tiet_bat_dau - b.tiet_bat_dau);
        });
        
        let weekStartDateObj = null;

        // Cập nhật quan trọng: Ưu tiên sử dụng weekData.ngay_bat_dau
        if (weekData.ngay_bat_dau) {
            const [d, m, y] = weekData.ngay_bat_dau.split('/').map(Number);
            weekStartDateObj = new Date(y, m - 1, d);
            weekStartDateObj.setHours(0,0,0,0); // Đặt về đầu ngày
        } else {
            // Fallback: nếu ngay_bat_dau không có, thử phân tích từ thong_tin_tuan
            // Regex đã sửa để khớp với dấu ngoặc vuông và "từ ngày"
            const weekInfoMatch = weekData.thong_tin_tuan ? weekData.thong_tin_tuan.match(/\[từ ngày (.*?) đến ngày .*?\]/) : null;
            const startDateString = weekInfoMatch ? weekInfoMatch[1] : '';
            
            if (startDateString) {
                const currentYear = new Date().getFullYear(); // Sử dụng năm hiện tại làm mặc định
                const [startDay, startMonth] = startDateString.split('/').map(Number);
                weekStartDateObj = new Date(currentYear, startMonth - 1, startDay);
                weekStartDateObj.setHours(0,0,0,0);
            }
        }

        // Render timetable for each day, ordered from Monday to Sunday
        for (let dayNum = 2; dayNum <= 8; dayNum++) { // Monday (2) to Sunday (8)
            const dayLessons = lessonsByDay[dayNum];
            const dayName = getDayName(dayNum);
            let dayDateObj = null;
            let dayDateString = '';

            if (weekStartDateObj) {
                dayDateObj = getDateForDay(weekStartDateObj, dayNum);
                dayDateString = dayDateObj.toLocaleDateString('vi-VN');
            }

            const dayTimetableDiv = document.createElement('div');
            dayTimetableDiv.className = 'day-timetable';

            // Dòng console.log này bạn có thể giữ lại để kiểm tra
            // console.log("dayDateObj:", dayDateObj ? dayDateObj.toLocaleDateString('en-US') : null, "today:", today.toLocaleDateString('en-US'));

            // Kiểm tra và thêm class 'current-day' nếu là ngày hiện tại
            if (dayDateObj && dayDateObj.getTime() === today.getTime()) {
                dayTimetableDiv.classList.add('current-day');
            }

            dayTimetableDiv.innerHTML = `
                <div class="day-header">
                    <span>${dayName}</span>
                    <span class="date">${dayDateString}</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Tiết</th>
                            <th>Giờ Học</th>
                            <th>Mã Môn</th>
                            <th>Tên Môn</th>
                            <th>Phòng</th>
                            <th>Giảng Viên</th>
                        </tr>
                    </thead>
                    <tbody id="day-${dayNum}-body">
                        </tbody>
                </table>
            `;
            timetableDisplay.appendChild(dayTimetableDiv);

            const tbody = document.getElementById(`day-${dayNum}-body`);
            if (dayLessons.length > 0) {
                dayLessons.forEach(lesson => {
                    const startPeriodTimes = getPeriodTimes(lesson.tiet_bat_dau);
                    const endPeriodTimes = getPeriodTimes(lesson.tiet_bat_dau + lesson.so_tiet - 1);
                    
                    let timeRange = '';
                    if (startPeriodTimes && endPeriodTimes) {
                        timeRange = `${startPeriodTimes.start} - ${endPeriodTimes.end}`;
                    } else {
                        timeRange = 'N/A';
                    }

                    const row = tbody.insertRow();
                    row.innerHTML = `
                        <td>${lesson.tiet_bat_dau}${lesson.so_tiet > 1 ? `-${lesson.tiet_bat_dau + lesson.so_tiet - 1}` : ''}</td>
                        <td>${timeRange}</td>
                        <td>${lesson.ma_mon || ''}</td>
                        <td>${lesson.ten_mon || ''}</td>
                        <td>${lesson.ma_phong || ''}</td>
                        <td>${lesson.ten_giang_vien || ''}</td>
                    `;
                });
            } else {
                const row = tbody.insertRow();
                row.innerHTML = `<td colspan="6" class="no-schedule">Không có lịch học</td>`;
            }
        }
    }

    // Initial load
    loadTkbData();
});