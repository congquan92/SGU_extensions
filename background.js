let capturedAuthToken = null; // Biến để lưu trữ token đã bắt được

// Lắng nghe các yêu cầu mạng trước khi chúng được gửi
chrome.webRequest.onBeforeSendHeaders.addListener(
    function(details) {
        // Kiểm tra xem yêu cầu có đến domain của SGU API không
        // Dựa vào hình ảnh, API bạn muốn lấy token là w-locsinhvieninfo,
        // và các API khác như w-locdsdiemsinhvien cũng dùng chung Authorization header.
        // Do đó, chúng ta sẽ lắng nghe tất cả các request đến /api/
        if (details.url.startsWith("https://thongtindaotao.sgu.edu.vn/public/api")) {
            for (let i = 0; i < details.requestHeaders.length; ++i) {
                // Tìm header Authorization
                if (details.requestHeaders[i].name === 'Authorization') {
                    const token = details.requestHeaders[i].value;
                    if (token && token.startsWith("Bearer ")) {
                        capturedAuthToken = token.replace("Bearer ", ""); // Lấy phần token thực sự
                        console.log("Background: Captured Authorization Token:", capturedAuthToken);
                        // Lưu token vào storage để popup có thể truy cập
                        chrome.storage.local.set({ 'capturedAuthToken': capturedAuthToken });
                        break; // Đã tìm thấy token, không cần duyệt tiếp headers
                    }
                }
            }
        }
        return { requestHeaders: details.requestHeaders };
    },
    { urls: ["https://thongtindaotao.sgu.edu.vn/public/api/*"] }, // Lọc URL cho tất cả các yêu cầu từ domain này
    ["requestHeaders"] // Yêu cầu quyền truy cập vào request headers
);

// Lắng nghe các tin nhắn từ popup
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.action === "getCapturedToken") {
            // Khi popup yêu cầu token, gửi token đã bắt được về
            sendResponse({ token: capturedAuthToken });
        }
    }
);

console.log("Background service worker started. Listening for SGU API requests.");