import React, { useState, useEffect, useMemo } from 'react';
import { jwtDecode } from 'jwt-decode';

interface CheckoutCountdownProps {
    showId: string;
    cancellationDeadline?: string;
    serverNow?: string;
}

export const CheckoutCountdown: React.FC<CheckoutCountdownProps> = ({
    showId,
    cancellationDeadline,
    serverNow
}) => {
    const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
    const [isPaymentPhase, setIsPaymentPhase] = useState<boolean>(false);
    const serverOffsetMs = useMemo(() => {
        if (!serverNow) return 0;

        const serverTimeMs = new Date(serverNow).getTime();

        if (Number.isNaN(serverTimeMs)) return 0;

        return serverTimeMs - Date.now();
    }, [serverNow]);

    useEffect(() => {
        let expireTimeMs = 0;
        const isHolding = !!cancellationDeadline;
        setIsPaymentPhase(isHolding);

        try {
            if (isHolding) {
                expireTimeMs = new Date(cancellationDeadline).getTime();
            } else {
                const token = localStorage.getItem(`checkoutToken_${showId}`);
                if (!token) return;

                const decoded: any = jwtDecode(token);
                if (!decoded.exp) return;

                expireTimeMs = decoded.exp * 1000;
            }

            if (Number.isNaN(expireTimeMs)) return;

            // Dùng giờ server đã được offset
            const getCurrentServerTimeMs = () => Date.now() + serverOffsetMs;

            const calculateTimeLeft = () => {
                return Math.max(0, expireTimeMs - getCurrentServerTimeMs());
            };

            setTimeLeftMs(calculateTimeLeft());

            const interval = setInterval(() => {
                const remaining = calculateTimeLeft();
                setTimeLeftMs(remaining);

                if (remaining <= 0) {
                    clearInterval(interval);

                    if (isHolding) {
                        alert("⏳ Hết thời gian thanh toán! Ghế của bạn đã được nhả ra.");
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
    }, [showId, cancellationDeadline, serverOffsetMs]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return `${minutes.toString().padStart(2, '0')}:${seconds
            .toString()
            .padStart(2, '0')}`;
    };

    return (
        <div
            className={`font-bold px-8 py-2 rounded-lg border transition-colors
            ${isPaymentPhase
                    ? "bg-gray-50 text-black-300 border-gray-200 font-medium"
                    : "bg-gray-50 text-black-300 border-gray-200 font-medium"
                }`}
        >
            {isPaymentPhase ? "Thời gian thanh toán: " : "Thời gian giữ chỗ: "}
            <span className="text-red-600 text-lg">{formatTime(timeLeftMs)}</span>
        </div>
    );
};