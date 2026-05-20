import * as OTPAuth from 'otpauth';
import KJUR from 'jsrsasign';

export const offlineScanProcess = async (qrData: string, publicKeyPEM: string) => {
    const parts = qrData.split('|');
    if (parts.length < 4) {
        return { success: false, message: "Mã QR không đúng chuẩn Dề Dê." };
    }
    const ticketId = parts[0];
    const ticketSecret = parts[1];
    const currentTotpCode = parts[2];
    const signatureFromQR = parts[3];

    try {
        const dataToVerify = `${ticketId}|${ticketSecret}`;
        const sig = new (KJUR as any).crypto.Signature({ alg: "SHA256withRSA" });
        sig.init(publicKeyPEM);
        sig.updateString(dataToVerify);
        const hexSignature = (KJUR as any).b64tohex(signatureFromQR);
        const isAuthentic = sig.verify(hexSignature);
        if (!isAuthentic) {
            return { success: false, message: "CẢNH BÁO: Vé giả mạo!" };
        }
    } catch (error) {
        return { success: false, message: "Lỗi đọc chữ ký điện tử." };
    }




    const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(ticketSecret),
    });


    const delta = totp.validate({ token: currentTotpCode, window: 1 });

    if (delta === null) {
        return { success: false, message: "LỖI: Mã QR đã hết hạn. Vui lòng mở lại App!" };
    }

    return { success: true, message: "✅ Vé hợp lệ!", ticketId: ticketId };
};