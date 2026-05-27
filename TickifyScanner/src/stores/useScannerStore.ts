import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AssignedShow, ScannedTicket, ScanStatus, StaffUser } from '../types/scanner';

function normalizePersistedJwt(value?: string | null): string | null {
    if (!value) return null;

    const trimmed = value.trim();
    const withoutBearer = trimmed.replace(/^Bearer\s+/i, '').trim();
    const sessionMatch = withoutBearer.match(/(?:^|;|,|\s)SessionID=([^;,\s]+)/i);
    const candidate = sessionMatch ? sessionMatch[1] : withoutBearer;
    const token = candidate.replace(/^SessionID=/i, '').trim();

    return token.split('.').length === 3 ? token : null;
}

interface ScannerState {
    sessionToken: string | null;
    user: StaffUser | null;
    selectedShow: AssignedShow | null;
    publicKeysByShowId: Record<string, string>;
    scannedTickets: ScannedTicket[];

    setAuth: (sessionToken: string, user: StaffUser) => void;
    logout: () => void;
    setSelectedShow: (show: AssignedShow | null) => void;
    savePublicKey: (showId: string, publicKey: string) => void;
    addScannedTicket: (input: Omit<ScannedTicket, 'scannedAt'> & { scannedAt?: string }) => ScannedTicket;
    hasTicketInShow: (showId: string, ticketId: string) => boolean;
    getPendingTicketsByShow: (showId: string) => ScannedTicket[];
    markTicketSynced: (showId: string, ticketId: string, message?: string) => void;
    markTicketFailed: (showId: string, ticketId: string, status: ScanStatus, message?: string) => void;
    clearSyncedTickets: (showId?: string) => void;
}

export const useScannerStore = create<ScannerState>()(
    persist(
        (set, get) => ({
            sessionToken: null,
            user: null,
            selectedShow: null,
            publicKeysByShowId: {},
            scannedTickets: [],

            setAuth: (sessionToken, user) => set({ sessionToken: normalizePersistedJwt(sessionToken), user }),
            logout: () => set({ sessionToken: null, user: null, selectedShow: null }),
            setSelectedShow: (show) => set({ selectedShow: show }),
            savePublicKey: (showId, publicKey) => set((state) => ({
                publicKeysByShowId: { ...state.publicKeysByShowId, [showId]: publicKey },
            })),

            hasTicketInShow: (showId, ticketId) => get().scannedTickets.some(
                ticket => ticket.showId === showId && ticket.ticketId === ticketId && ticket.status !== 'INVALID',
            ),

            addScannedTicket: (input) => {
                const scannedAt = input.scannedAt || new Date().toISOString();
                const current = get().scannedTickets;
                const existing = current.find(ticket => ticket.showId === input.showId && ticket.ticketId === input.ticketId);

                if (existing) {
                    const duplicate: ScannedTicket = {
                        ...existing,
                        status: 'DUPLICATE_LOCAL',
                        message: 'Vé này đã được quét trên thiết bị này',
                    };
                    set({ scannedTickets: [duplicate, ...current.filter(ticket => ticket !== existing)] });
                    return duplicate;
                }

                const ticket: ScannedTicket = { ...input, scannedAt };
                set({ scannedTickets: [ticket, ...current] });
                return ticket;
            },

            getPendingTicketsByShow: (showId) => get().scannedTickets.filter(
                ticket => ticket.showId === showId && !ticket.synced && ticket.status === 'LOCAL_VALID',
            ),

            markTicketSynced: (showId, ticketId, message) => set((state) => ({
                scannedTickets: state.scannedTickets.map(ticket => (
                    ticket.showId === showId && ticket.ticketId === ticketId
                        ? { ...ticket, synced: true, status: 'SYNCED_USED', message: message || 'Đã đồng bộ thành USED' }
                        : ticket
                )),
            })),

            markTicketFailed: (showId, ticketId, status, message) => set((state) => ({
                scannedTickets: state.scannedTickets.map(ticket => (
                    ticket.showId === showId && ticket.ticketId === ticketId
                        ? { ...ticket, status, message: message || ticket.message }
                        : ticket
                )),
            })),

            clearSyncedTickets: (showId) => set((state) => ({
                scannedTickets: state.scannedTickets.filter(ticket => {
                    if (showId && ticket.showId !== showId) return true;
                    return !ticket.synced;
                }),
            })),
        }),
        {
            name: 'tickify-scanner-storage',
            storage: createJSONStorage(() => AsyncStorage),
            version: 2,
            migrate: (persistedState: any) => {
                const sessionToken = normalizePersistedJwt(
                    persistedState?.sessionToken || persistedState?.sessionCookie || persistedState?.token,
                );

                return {
                    ...persistedState,
                    sessionToken,
                    user: sessionToken ? persistedState?.user || null : null,
                    selectedShow: sessionToken ? persistedState?.selectedShow || null : null,
                };
            },
        },
    ),
);
