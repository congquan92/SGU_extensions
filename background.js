let capturedAuthToken = null; // Biến để lưu trữ token đã bắt được
let tokenCaptureTime = null; // Thời gian bắt token
const TOKEN_EXPIRY_TIME = 60 * 60 * 1000; // 1 giờ

// Hàm mã hóa token đơn giản
function encryptToken(token) {
  return btoa(token); // Base64 encode
}

// Hàm kiểm tra token có hết hạn không
function isTokenExpired() {
  if (!tokenCaptureTime) return true;
  return Date.now() - tokenCaptureTime > TOKEN_EXPIRY_TIME;
}

// Lắng nghe các yêu cầu mạng trước khi chúng được gửi
chrome.webRequest.onBeforeSendHeaders.addListener(
    function(details) {
        // Kiểm tra xem yêu cầu có đến domain của SGU API không
        if (details.url.startsWith("https://thongtindaotao.sgu.edu.vn/public/api")) {
            for (let i = 0; i < details.requestHeaders.length; ++i) {
                // Tìm header Authorization
                if (details.requestHeaders[i].name === 'Authorization') {
                    const token = details.requestHeaders[i].value;
                    if (token && token.startsWith("Bearer ")) {
                        const cleanToken = token.replace("Bearer ", "");
                        
                        // Chỉ cập nhật nếu token mới hoặc token cũ đã hết hạn
                        if (capturedAuthToken !== cleanToken || isTokenExpired()) {
                            capturedAuthToken = cleanToken;
                            tokenCaptureTime = Date.now();
                            
                            console.log("Background: Captured new Authorization Token");
                            
                            // Lưu token vào storage với mã hóa
                            chrome.storage.local.set({ 
                                'capturedAuthToken': encryptToken(cleanToken),
                                'tokenTimestamp': tokenCaptureTime
                            }).catch(error => {
                                console.error("Failed to save token to storage:", error);
                            });
                        }
                        break;
                    }
                }
            }
        }
        return { requestHeaders: details.requestHeaders };
    },
    { urls: ["https://thongtindaotao.sgu.edu.vn/public/api/*"] },
    ["requestHeaders"]
);

// Lắng nghe các tin nhắn từ popup
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.action === "getCapturedToken") {
            // Kiểm tra token có hết hạn không
            if (capturedAuthToken && !isTokenExpired()) {
                sendResponse({ token: capturedAuthToken });
            } else {
                sendResponse({ token: null });
            }
        }
        return true; // Giữ message channel mở cho async response
    }
);

// Xóa token khi extension được cài đặt/cập nhật
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.clear(() => {
        console.log("Background: Storage cleared on extension install/update");
    });
});

console.log("Background service worker started. Listening for SGU API requests.");