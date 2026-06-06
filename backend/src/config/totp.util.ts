import crypto from "crypto";

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_TOTP_PERIOD_SECONDS = 30;
const DEFAULT_TOTP_DIGITS = 6;
const DEFAULT_TOTP_WINDOW = 2;

export const generateTicketSecret = (length: number = 20): string => {
    let secret = '';
    for (let i = 0; i < length; i++) {
        secret += BASE32_ALPHABET.charAt(crypto.randomInt(0, BASE32_ALPHABET.length));
    }
    return secret;
};

const normalizeBase32Secret = (secretString: string): string => {
    return String(secretString || '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/=+$/g, '')
        .toUpperCase();
};

const base32ToBuffer = (secretString: string): Buffer => {
    const normalized = normalizeBase32Secret(secretString);
    let bits = '';

    for (const char of normalized) {
        const value = BASE32_ALPHABET.indexOf(char);
        if (value === -1) {
            throw new Error(`Invalid base32 character: ${char}`);
        }
        bits += value.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }

    return Buffer.from(bytes);
};

const generateTotpAtCounter = (secretString: string, counter: number, digits = DEFAULT_TOTP_DIGITS): string => {
    const key = base32ToBuffer(secretString);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuffer.writeUInt32BE(counter >>> 0, 4);

    const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

    const otp = binary % 10 ** digits;
    return otp.toString().padStart(digits, '0');
};

export const generateCurrentToken = async (secretString: string, _userAccount?: string): Promise<string> => {
    const counter = Math.floor(Date.now() / 1000 / DEFAULT_TOTP_PERIOD_SECONDS);
    return generateTotpAtCounter(secretString, counter);
};

export const verifyTicketToken = async (
    token: string,
    secretString: string,
    window: number = DEFAULT_TOTP_WINDOW,
): Promise<boolean> => {
    const normalizedToken = String(token || '').trim();
    if (!/^\d{6}$/.test(normalizedToken)) return false;

    const currentCounter = Math.floor(Date.now() / 1000 / DEFAULT_TOTP_PERIOD_SECONDS);
    for (let offset = -window; offset <= window; offset += 1) {
        if (generateTotpAtCounter(secretString, currentCounter + offset) === normalizedToken) {
            return true;
        }
    }

    return false;
};
