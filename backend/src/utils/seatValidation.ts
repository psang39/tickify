// file: shared/utils/seatValidation.ts
import { ISeat } from "../types/seat.types";

/**
 * Kiểm tra xem việc chọn ghế có để lại "ghế mồ côi" (1 ghế lẻ loi) hay không.
 * @param rowSeats Mảng tất cả các ghế CỦA CÙNG 1 HÀNG (đã sort theo col_index tăng dần)
 * @param selectedSeatIds Mảng ID các ghế mà user đang muốn chọn
 * @returns {boolean} true nếu hợp lệ, false nếu vi phạm
 */
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