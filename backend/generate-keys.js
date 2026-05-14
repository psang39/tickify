// file: generate-keys.js
const crypto = require('crypto');

// Hàm sinh cặp khóa RSA 2048-bit (Độ dài chuẩn an toàn hiện nay)
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem' // Định dạng PEM dễ đọc
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});


console.log("/n1. PUBLIC KEY:");
console.log(publicKey);


console.log("/n2. PRIVATE KEY (Copy cái này để cho vào file .env của Backend):");


// ĐÂY LÀ PHẦN QUAN TRỌNG: 
// Chuyển các dấu xuống dòng thành ký tự \n để lưu vào .env không bị lỗi
const envPrivateKey = privateKey.replace(/\n/g, '\\n');
console.log(`RSA_PRIVATE_KEY="${envPrivateKey}"`);