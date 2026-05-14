import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

export const CheckoutCountdown = ({ showId }: { showId: string }) => {
    const [timeLeftMs, setTimeLeftMs] = useState<number>(0);

    useEffect(() => {
        const token = localStorage.getItem(`checkoutToken_${showId}`);
        if (!token) return;

        try {
            // 1. Bóc token để lấy mốc thời gian "Tử thần" (exp)
            const decoded = jwtDecode(token);
            if (!decoded.exp) return;

            // exp của JWT tính bằng Giây, Date.now() tính bằng Milli-giây
            const expireTimeMs = decoded.exp * 1000;

            // 2. Tính thời gian còn lại ngay lúc vừa render
            const calculateTimeLeft = () => Math.max(0, expireTimeMs - Date.now());

            setTimeLeftMs(calculateTimeLeft());

            // 3. Chạy Interval mỗi giây để cập nhật UI
            const interval = setInterval(() => {
                const remaining = calculateTimeLeft();
                setTimeLeftMs(remaining);

                if (remaining <= 0) {
                    clearInterval(interval);
                    // Hết giờ -> Báo lỗi & Đá về phòng chờ
                    alert("Hết thời gian chọn ghế!");
                    localStorage.removeItem(`checkoutToken_${showId}`);
                    window.location.href = `/queue/${showId}`;
                }
            }, 1000);

            return () => clearInterval(interval);
        } catch (error) {
            console.error("Token lỏ:", error);
        }
    }, [showId]);

    // Format ra mm:ss
    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-red-50 text-red-600 font-mono font-bold px-4 py-2 rounded-lg border border-red-200 shadow-sm">
            Thời gian giữ chỗ: {formatTime(timeLeftMs)}
        </div>
    );
};