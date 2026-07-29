import crypto from 'crypto';

export interface TicketQrPayload {
    ticketId: string;
    ticketSecret: string;
    currentTotpCode: string;
    signature: string;
}

export const createTicketSigningPayload = (ticketId: string, ticketSecret: string): string => {
    return `${ticketId}|${ticketSecret}`;
};

export const createTicketQrPayload = (payload: TicketQrPayload): string => {
    return [
        payload.ticketId,
        payload.ticketSecret,
        payload.currentTotpCode,
        payload.signature,
    ].join('|');
};

export const parseTicketQrPayload = (qrData: string): TicketQrPayload | null => {
    const parts = String(qrData || '').split('|').map(part => part.trim());
    if (parts.length !== 4 || parts.some(part => part.length === 0)) return null;

    return {
        ticketId: parts[0],
        ticketSecret: parts[1],
        currentTotpCode: parts[2],
        signature: parts[3],
    };
};

export const signTicketIdentity = (
    ticketId: string,
    ticketSecret: string,
    privateKey: string,
): string => {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(createTicketSigningPayload(ticketId, ticketSecret));
    signer.end();
    return signer.sign(privateKey, 'base64');
};

export const verifyTicketQrSignature = (
    payload: Pick<TicketQrPayload, 'ticketId' | 'ticketSecret' | 'signature'>,
    publicKey: string,
): boolean => {
    try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(createTicketSigningPayload(payload.ticketId, payload.ticketSecret));
        verifier.end();
        return verifier.verify(publicKey, payload.signature, 'base64');
    } catch {
        return false;
    }
};
