import { create } from 'zustand';
import { useFeedbackStore } from '@/store/useFeedbackStore';

type SeatStatus =
    | 'available'
    | 'held'
    | 'sold'
    | 'locked'
    | 'unavailable'
    | 0
    | 1
    | 2
    | 3;

interface ISeat {
    _id?: string;
    id: string;

    show_id?: string;
    zone_id: string;
    ticket_type_id?: string;

    row?: string;
    seat_number?: string;
    col_index?: number;

    x?: number;
    y?: number;

    status: SeatStatus;

    tier?: string;
    price?: number;

    is_standing?: boolean;

    createdAt?: string;
    updatedAt?: string;

    [key: string]: any;
}

interface CartState {
    selectedSeats: ISeat[];
    maxTickets: number;
    comboCount: number;
    setComboCount: (count: number) => void;
    toggleSeat: (seat: ISeat, rowMap: Map<string, ISeat[]>) => void;
    removeSeat: (seatId: string) => void;
    setStandingZoneQuantity: (zoneId: string, availableSeats: ISeat[], quantity: number) => void;
    clearCart: () => void;
}
export const buildSeatMapCache = (allSeats: ISeat[]) => { 
    const rowMap = new Map<string, any[]>();

    allSeats.forEach(s => {
        if (!s.row || s.col_index === undefined || !s.zone_id) return;

        const rowKey = `${s.zone_id}_${s.row}`;
        console.log(rowKey);
        if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
        rowMap.get(rowKey)!.push(s);
    });

    
    for (const [_, seatsInRow] of rowMap.entries()) {
        seatsInRow.sort((a, b) => Number(a.col_index) - Number(b.col_index));
    }

    return rowMap;
};
export const findCluster = (startSeat: any, count: number, rowMap: Map<string, any[]>): any[] => {
    if (count === 1) return [startSeat];

    
    const rowKey = `${startSeat.zone_id}_${startSeat.row}`;

    
    const rowSeats = rowMap.get(rowKey)?.filter(s => s.status === 1 || s.status === 'available') || [];

    const startIndex = rowSeats.findIndex(s => s.id === startSeat.id);
    if (startIndex === -1) return [];

    for (let offset = 0; offset < count; offset++) {
        const leftIndex = startIndex - (count - 1 - offset);
        const rightIndex = startIndex + offset;

        if (leftIndex >= 0 && rightIndex < rowSeats.length) {
            const potentialCluster = rowSeats.slice(leftIndex, rightIndex + 1);
            const isContinuous = potentialCluster.every((s, i) =>
                i === 0 || Number(s.col_index) === Number(potentialCluster[i - 1].col_index) + 1
            );
            if (isContinuous && potentialCluster.length === count) return potentialCluster;
        }
    }
    return [];
};

export const hasOrphanSeat = (pendingSelectedIds: string[], rowMap: Map<string, any[]>): boolean => {
    
    for (const [_, seatsInRow] of rowMap.entries()) {
        let rowString = "X";

        for (let i = 0; i < seatsInRow.length; i++) {
            const s = seatsInRow[i];

            
            if (i > 0 && Number(s.col_index) > Number(seatsInRow[i - 1].col_index) + 1) {
                rowString += "X";
            }

            
            const isOccupied = (s.status !== 1 && s.status !== 'available') || pendingSelectedIds.includes(s.id);

            rowString += isOccupied ? "X" : "O"; 
        }

        rowString += "X";

        
        if (rowString.includes("XOX")) return true;
    }

    return false;
};

export const useCartStore = create<CartState>((set, get) => ({
    selectedSeats: [],
    maxTickets: 4,
    comboCount: 1,

    setComboCount: (count) => set({ comboCount: count }),

    toggleSeat: (seat, allSeats) => {
        const { selectedSeats, maxTickets, comboCount } = get();

        
        if (selectedSeats.find(s => s.id === seat.id)) {
            const newSelected = selectedSeats.filter(s => s.id !== seat.id);
            if (hasOrphanSeat(newSelected.map(s => s.id), allSeats)) {
                useFeedbackStore.getState().showError("Không thể bỏ chọn vì sẽ tạo ra ghế trống đơn lẻ!");
                return;
            }
            set({ selectedSeats: newSelected });
            return;
        }

        const hasDifferentZone = selectedSeats.some((selected: any) => String(selected.zone_id) !== String(seat.zone_id));
        if (hasDifferentZone) {
            useFeedbackStore.getState().showError('Đơn hàng hiện chỉ hỗ trợ chọn vé trong cùng một khu. Vui lòng xóa vé đã chọn trước khi đổi khu.');
            return;
        }

        
        const cluster = findCluster(seat, comboCount, allSeats);
        if (cluster.length === 0) {
            useFeedbackStore.getState().showError(`Không tìm thấy ${comboCount} chỗ trống liền kề ở khu vực này!`);
            return;
        }

        
        const newSeats = cluster.filter(s => !selectedSeats.some(sel => sel.id === s.id));

        if (selectedSeats.length + newSeats.length > maxTickets) {
            useFeedbackStore.getState().showError(`Bạn chỉ được mua tối đa ${maxTickets} vé!`);
            return;
        }

        const pendingSelectedIds = [...selectedSeats, ...newSeats].map(s => s.id);
        if (hasOrphanSeat(pendingSelectedIds, allSeats)) {
            useFeedbackStore.getState().showError("Vị trí này sẽ để lại 1 ghế trống đơn lẻ. Vui lòng chọn cụm khác!");
            return;
        }

        
        
        set({ selectedSeats: [...selectedSeats, ...newSeats] });
    },

    removeSeat: (seatId) =>
        set((state) => ({
            selectedSeats: state.selectedSeats.filter(
                (seat: any) => seat.id !== seatId && seat._id !== seatId
            ),
        })),

    setStandingZoneQuantity: (zoneId, availableSeats, quantity) => {
        const { selectedSeats, maxTickets } = get();
        const normalizedQuantity = Math.max(0, Math.min(quantity, maxTickets));
        const otherSeats = selectedSeats.filter((seat: any) => String(seat.zone_id) !== String(zoneId));
        const shouldReplaceOtherZones = otherSeats.length > 0 && normalizedQuantity > 0;
        const baseSeats = shouldReplaceOtherZones ? [] : otherSeats;

        if (shouldReplaceOtherZones) {
            useFeedbackStore.getState().showError('Đơn hàng hiện chỉ hỗ trợ chọn vé trong cùng một khu. Hệ thống đã chuyển sang khu GA bạn vừa chọn.');
        }

        if (baseSeats.length + normalizedQuantity > maxTickets) {
            useFeedbackStore.getState().showError(`Bạn chỉ được mua tối đa ${maxTickets} vé!`);
            return;
        }

        const pickedStandingSeats = availableSeats
            .filter((seat: any) => seat.status === 'available' || seat.status === 1 || selectedSeats.some((selected: any) => selected._id === seat._id || selected.id === seat.id))
            .sort((a: any, b: any) => Number(a.col_index || 0) - Number(b.col_index || 0))
            .slice(0, normalizedQuantity)
            .map((seat: any) => ({
                ...seat,
                id: seat.id || seat._id,
                is_standing: true,
            }));

        if (pickedStandingSeats.length < normalizedQuantity) {
            useFeedbackStore.getState().showError('Khu vực này không còn đủ vé GA.');
            return;
        }

        set({ selectedSeats: [...baseSeats, ...pickedStandingSeats] });
    },

    clearCart: () => set({ selectedSeats: [] })
}));
