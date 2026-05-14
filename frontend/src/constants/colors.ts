export const COLORS = {
    primary: '#FF0082',    // Hồng đậm
    secondary: '#262880',  // Xanh dương đậm

    // Semantic colors
    info: '#4588E7',
    success: '#00BA88',
    warning: '#F4B740',
    error: '#F4B740',      // Đang trùng với warning theo spec hiện tại

    // Monochrome / Neutral
    white: '#FFFFFF',
    neutral: {
        dark: '#141418',   // Background tối hoặc Text chính
        base: '#282831',   // Card background hoặc Text phụ
    },

    // Bổ sung thêm các màu phụ trợ từ ảnh thiết kế của bạn
    seat: {
        available: '#4588E7', // Lấy tạm màu info cho ghế trống (có thể đổi)
        selected: '#FF0082',  // Ghế đang chọn dùng màu primary
        sold: '#d1d5db',      // Ghế đã bán (xám nhạt)
    }
};