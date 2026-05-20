import { create } from 'zustand';
import type { ISeat } from '@/types/seat.types'

interface CartState {
    selectedSeats: ISeat[];
    maxTickets: number;
    comboCount: number;
    setComboCount: (count: number) => void;
    toggleSeat: (seat: ISeat, rowMap: Map<string, ISeat[]>) => void;
    clearCart: () => void;
}
export const buildSeatMapCache = (allSeats: ISeat[]) => { // Thay any[] bằng ISeat[] nếu bạn dùng interface
    const rowMap = new Map<string, any[]>();

    allSeats.forEach(s => {
        if (!s.row || s.col_index === undefined || !s.zone_id) return;

        const rowKey = `${s.zone_id}_${s.row}`;
        console.log(rowKey);
        if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
        rowMap.get(rowKey)!.push(s);
    });

    // Sắp xếp 1 lần duy nhất theo cột cho từng hàng của từng khu riêng biệt
    for (const [_, seatsInRow] of rowMap.entries()) {
        seatsInRow.sort((a, b) => Number(a.col_index) - Number(b.col_index));
    }

    return rowMap;
};
export const findCluster = (startSeat: any, count: number, rowMap: Map<string, any[]>): any[] => {
    if (count === 1) return [startSeat];

    // 🔥 SỬA Ở ĐÂY: Dùng Composite Key (zone_id + row) thay vì chỉ dùng row
    const rowKey = `${startSeat.zone_id}_${startSeat.row}`;

    // Bốc thẳng row chứa ghế này ra (giờ đây chắc chắn không bị lẫn lộn giữa các Zone)
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
// 3. CẬP NHẬT MÁY QUÉT MỒ CÔI (Truyền rowMap vào)
export const hasOrphanSeat = (pendingSelectedIds: string[], rowMap: Map<string, any[]>): boolean => {
    // Duyệt qua từng hàng của từng khu vực (đã được cô lập hoàn hảo trong rowMap)
    for (const [_, seatsInRow] of rowMap.entries()) {
        let rowString = "X";

        for (let i = 0; i < seatsInRow.length; i++) {
            const s = seatsInRow[i];

            // Nhận diện lối đi (khoảng trống giữa các cột) để chèn "X" chắn lại
            if (i > 0 && Number(s.col_index) > Number(seatsInRow[i - 1].col_index) + 1) {
                rowString += "X";
            }

            // Trạng thái ghế: Đã bán/Đang hold (không rảnh) HOẶC Nằm trong danh sách chuẩn bị mua -> Tính là chữ "X" (bị chiếm)
            const isOccupied = (s.status !== 1 && s.status !== 'available') || pendingSelectedIds.includes(s.id);

            rowString += isOccupied ? "X" : "O"; // "O" là ghế còn trống hoàn toàn
        }

        rowString += "X";

        // Nếu chuỗi tồn tại dạng XOX (1 ghế trống bị kẹp giữa 2 ghế đã mua/lối đi/rìa) -> Phạt mồ côi
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

        // 1. Logic BỎ CHỌN
        if (selectedSeats.find(s => s.id === seat.id)) {
            const newSelected = selectedSeats.filter(s => s.id !== seat.id);
            if (hasOrphanSeat(newSelected.map(s => s.id), allSeats)) {
                alert("Không thể bỏ chọn vì sẽ tạo ra ghế trống đơn lẻ!");
                return;
            }
            set({ selectedSeats: newSelected });
            return;
        }

        // 2. Logic CHỌN CỤM
        const cluster = findCluster(seat, comboCount, allSeats);
        if (cluster.length === 0) {
            alert(`Không tìm thấy ${comboCount} chỗ trống liền kề ở khu vực này!`);
            return;
        }

        // 3. KIỂM TRA ĐIỀU KIỆN TRƯỚC KHI ADD
        const newSeats = cluster.filter(s => !selectedSeats.some(sel => sel.id === s.id));

        if (selectedSeats.length + newSeats.length > maxTickets) {
            alert(`Bạn chỉ được mua tối đa ${maxTickets} vé!`);
            return;
        }

        const pendingSelectedIds = [...selectedSeats, ...newSeats].map(s => s.id);
        if (hasOrphanSeat(pendingSelectedIds, allSeats)) {
            alert("Vị trí này sẽ để lại 1 ghế trống đơn lẻ. Vui lòng chọn cụm khác!");
            return;
        }

        // 🔥 FIX 3: Gộp chung thành 1 lệnh set duy nhất. 
        // Trước đó bạn gọi set() 2 lần liên tiếp với logic giống hệt nhau gây thừa thãi.
        set({ selectedSeats: [...selectedSeats, ...newSeats] });
    },

    clearCart: () => set({ selectedSeats: [] })
}));