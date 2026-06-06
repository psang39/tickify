import { ISeat } from "../types/seat.types";


export const validateOrphanSeats = (rowSeats: ISeat[], selectedSeatIds: string[]): boolean => {
    if (selectedSeatIds.length === 0) return true;
    const futureStateString = rowSeats.map(seat => {
        const isUnavailable = seat.status !== 'available';
        const isBeingSelected = selectedSeatIds.includes(seat._id.toString());

        if (isUnavailable || isBeingSelected) {
            return 'X';
        }
        return 'O';
    }).join('');
    const paddedString = `X${futureStateString}X`;
    const hasOrphan = paddedString.includes('XOX');
    return !hasOrphan;
};