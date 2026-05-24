import crypto from 'crypto';
import { ENCRYPTION_MASTER_KEY } from '../config/index';
export const generateRSAKeyPair = (): { publicKey: string; privateKey: string } => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
    return { publicKey, privateKey };
};


export const encryptPrivateKey = (privateKey: string): string => {
    const secretKey = ENCRYPTION_MASTER_KEY;
    if (!secretKey) {
        throw new Error('Biến môi trường ENCRYPTION_MASTER_KEY chưa được cấu hình!');
    }
    const key = Buffer.from(secretKey, 'hex');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
};

export const decryptPrivateKey = (encryptedData: string): string => {
    const secretKey = process.env.ENCRYPTION_MASTER_KEY || '64_char_hex_string_fallback_for_demo_purposes_only';
    const key = Buffer.from(secretKey, 'hex');

    const [ivHex, encryptedHex] = encryptedData.split(':');
    if (!ivHex || !encryptedHex) {
        throw new Error('Dữ liệu khóa bí mật bị sai cấu trúc mã hóa (Thiếu IV hoặc CipherText)');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};