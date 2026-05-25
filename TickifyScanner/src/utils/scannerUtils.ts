import * as OTPAuth from 'otpauth';
import KJUR from 'jsrsasign';

export interface OfflineScanResult {
    success: boolean;
    message: string;
    ticketId?: string;
}

export function extractTicketId(qrData: string) {
    return String(qrData || '').split('|')[0] || '';
}

export const offlineScanProcess = async (qrData: string, publicKeyPEM: string): Promise<OfflineScanResult> => {
    const parts = String(qrData || '').split('|');
    if (parts.length < 4) {
        return { success: false, message: 'Mã QR không đúng chuẩn Tickify.' };
    }

    const ticketId = parts[0];
    const ticketSecret = parts[1];
    const currentTotpCode = parts[2];
    const signatureFromQR = parts[3];

    try {
        const dataToVerify = `${ticketId}|${ticketSecret}`;
        const sig = new (KJUR as any).crypto.Signature({ alg: 'SHA256withRSA' });
        sig.init(publicKeyPEM);
        sig.updateString(dataToVerify);
        const hexSignature = (KJUR as any).b64tohex(signatureFromQR);
        const isAuthentic = sig.verify(hexSignature);

        if (!isAuthentic) {
            return { success: false, message: 'CẢNH BÁO: Vé giả mạo hoặc không thuộc show này.' };
        }
    } catch (error) {
        return { success: false, message: 'Không đọc được chữ ký điện tử của vé.' };
    }

    try {
        const totp = new OTPAuth.TOTP({
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(ticketSecret),
        });

        const delta = totp.validate({ token: currentTotpCode, window: 1 });
        if (delta === null) {
            return { success: false, message: 'Mã QR đã hết hạn. Vui lòng yêu cầu khách mở lại vé.' };
        }
    } catch (error) {
        return { success: false, message: 'Không kiểm tra được mã TOTP của vé.' };
    }

    return { success: true, message: 'Vé hợp lệ trên thiết bị. Có thể cho khách qua cổng.', ticketId };
};
