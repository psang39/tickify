import { TOTP, Secret } from "@otp-lib/authenticator";
import crypto from "crypto";

/**
 * 1. Hàm tạo chuỗi Secret (Base32) cho từng vé mới.
 * Sử dụng tập ký tự chuẩn Base32 (A-Z và 2-7).
 */
export const generateTicketSecret = (length: number = 20): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < length; i++) {
        secret += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return secret;
};

/**
 * 2. Hàm tạo ra mã 6 số (Dùng để test thử hoặc cấp cho Frontend).
 * Lưu ý: Trả về Promise nên phải dùng await.
 */
export const generateCurrentToken = async (secretString: string, userAccount: string): Promise<string> => {
    // Ép chuỗi string lưu trong Database thành đối tượng Secret của thư viện
    const secret = Secret.fromBase32(secretString);

    const totp = new TOTP({
        account: "ticket@event.com", // Có thể truyền user email vào đây nếu muốn
        issuer: "Ticketing System",
        secret: secret
        // Lưu ý: Nếu muốn set thời gian 15s thay vì 30s mặc định, 
        // bạn có thể check thêm docs của lib này xem nó hỗ trợ thuộc tính period/step ở đây không.
    });

    return await totp.generate();
};

/**
 * 3. Hàm kiểm tra mã (Dành cho Server kiểm tra lúc Check-in nếu không dùng RSA).
 * Trả về true nếu mã hợp lệ.
 */
export const verifyTicketToken = async (token: string, secretString: string): Promise<boolean> => {
    const secret = Secret.fromBase32(secretString);

    const totp = new TOTP({
        account: "ticket@event.com",
        issuer: "Ticketing System",
        secret: secret
    });

    return await totp.verify(token);
};