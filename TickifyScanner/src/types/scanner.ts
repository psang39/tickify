export type ScanMode = 'online' | 'offline';
export type ScanStatus = 'LOCAL_VALID' | 'SYNCED_USED' | 'DUPLICATE_LOCAL' | 'SERVER_USED' | 'INVALID' | 'ERROR';
export type ShowTimeState = 'upcoming' | 'ongoing' | 'past' | 'cancelled';

export interface VenueInfo {
    _id?: string;
    name?: string;
    location?: string;
}

export interface AssignedShow {
    _id: string;
    name: string;
    description?: string;
    start_time: string;
    end_time: string;
    status?: string;
    public_key?: string;
    venue_id?: VenueInfo;
    time_state?: ShowTimeState;
}

export interface ScannedTicket {
    ticketId: string;
    showId: string;
    showName?: string;
    scannedAt: string;
    synced: boolean;
    status: ScanStatus;
    message?: string;
}

export interface StaffUser {
    id: string;
    first_name?: string;
    last_name?: string;
    email: string;
    role: string;
}
