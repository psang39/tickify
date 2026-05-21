import { TOTP, Secret } from "@otp-lib/authenticator";
import crypto from "crypto";


export const generateTicketSecret = (length: number = 20): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < length; i++) {
        secret += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return secret;
};

export const generateCurrentToken = async (secretString: string, userAccount: string): Promise<string> => {
    const secret = Secret.fromBase32(secretString);

    const totp = new TOTP({
        account: "ticket@event.com", // Có thể truyền user email vào đây nếu muốn
        issuer: "Ticketing System",
        secret: secret
    });

    return await totp.generate();
};


export const verifyTicketToken = async (token: string, secretString: string): Promise<boolean> => {
    const secret = Secret.fromBase32(secretString);

    const totp = new TOTP({
        account: "ticket@event.com",
        issuer: "Ticketing System",
        secret: secret
    });

    return await totp.verify(token);
};