import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

interface CheckoutCountdownProps {
    showId: string;
    cancellationDeadline?: string;
}

export const CheckoutCountdown: React.FC<CheckoutCountdownProps> = ({ showId, cancellationDeadline }) => {
    const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
    const [isPaymentPhase, setIsPaymentPhase] = useState<boolean>(false);

    useEffect(() => {
        let expireTimeMs = 0;
        const isHolding = !!cancellationDeadline;
        setIsPaymentPhase(isHolding);

        try {
            if (isHolding) {
                // 1A. Nếu đã Hold ghế -> Lấy mốc thời gian từ Order
                expireTimeMs = new Date(cancellationDeadline).getTime();
            } else {
                // 1B. Nếu đang chọn ghế -> Lấy mốc thời gian từ Token
                const token = localStorage.getItem(`checkoutToken_${showId}`);
                if (!token) return;

                const decoded: any = jwtDecode(token);
                if (!decoded.exp) return;
                expireTimeMs = decoded.exp * 1000;
            }

            // 2. Tính thời gian còn lại
            const calculateTimeLeft = () => Math.max(0, expireTimeMs - Date.now());
            setTimeLeftMs(calculateTimeLeft());

            // 3. Chạy Interval mỗi giây
            const interval = setInterval(() => {
                const remaining = calculateTimeLeft();
                setTimeLeftMs(remaining);

                if (remaining <= 0) {
                    clearInterval(interval);

                    // 4. Xử lý khi hết giờ tùy theo giai đoạn
                    if (isHolding) {
                        alert("⏳ Hết thời gian thanh toán! Ghế của bạn đã được nhả ra.");
                        // Reload trang để tải lại sơ đồ ghế mới nhất và reset state
                        window.location.reload();
                    } else {
                        alert("⏳ Hết thời gian chọn ghế! Vui lòng xếp hàng lại.");
                        localStorage.removeItem(`checkoutToken_${showId}`);
                        window.location.href = `/queue/${showId}`;
                    }
                }
            }, 1000);

            return () => clearInterval(interval);
        } catch (error) {
            console.error("Lỗi parse thời gian Countdown:", error);
        }
    }, [showId, cancellationDeadline]);

    // Format ra mm:ss
    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`font-mono font-bold px-4 py-2 rounded-lg border shadow-sm transition-colors
            ${isPaymentPhase
                ? "bg-orange-50 text-orange-600 border-orange-200"
                : "bg-red-50 text-red-600 border-red-200"
            }`}
        >
            {isPaymentPhase ? "Thời gian thanh toán: " : "Thời gian giữ chỗ: "}
            {formatTime(timeLeftMs)}
        </div>
    );
};