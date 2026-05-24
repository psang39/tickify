import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, RotateCcw } from "lucide-react";
import { api } from "@/lib/axiosClient";
import { ErrorModal } from "@/components/shared/ErrorModal";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";

type PaymentStatus = "loading" | "success" | "failed";

interface PaymentResultData {
    orderId?: string;
    showId?: string;
    email?: string;
    message?: string;
    canRetry?: boolean;
    cancellationDeadline?: string;
}

const PaymentResultPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [status, setStatus] = useState<PaymentStatus>("loading");
    const [resultData, setResultData] = useState<PaymentResultData>({});
    const [isRetrying, setIsRetrying] = useState(false);
    const [retryError, setRetryError] = useState("");

    const orderId = searchParams.get("orderId") || searchParams.get("order_id");
    const paymentStatus = searchParams.get("status");

    useEffect(() => {
        const verifyPayment = async () => {
            try {
                if (!orderId) {
                    setStatus("failed");
                    setResultData({
                        message: "Không tìm thấy mã đơn hàng."
                    });
                    return;
                }

                const response = await api.get(`/orders/${orderId}/payment-result`);
                const data = response.data?.data;
                const isSuccess = data?.status === "confirmed";

                if (isSuccess) {
                    const showId = data?.showId || data?.show_id;

                    if (showId) {
                        localStorage.removeItem(`checkoutToken_${showId}`);
                    }

                    setStatus("success");
                    setResultData({
                        orderId: data?.orderId || data?.order_id || orderId,
                        showId,
                        email: data?.email,
                        message: data?.message
                    });
                } else {
                    setStatus("failed");
                    setResultData({
                        orderId: data?.orderId || data?.order_id || orderId,
                        showId: data?.showId || data?.show_id,
                        message: data?.message || "Thanh toán không thành công.",
                        canRetry: Boolean(data?.canRetry),
                        cancellationDeadline: data?.cancellationDeadline
                    });
                }
            } catch (error: any) {
                console.error("Verify payment error:", error);

                setStatus("failed");
                setResultData({
                    orderId: orderId || undefined,
                    message:
                        error?.response?.data?.message ||
                        "Có lỗi xảy ra khi xác nhận thanh toán."
                });
            }
        };

        verifyPayment();
    }, [orderId, paymentStatus]);

    const handleRetryPayment = async () => {
        if (!resultData.orderId || isRetrying) return;

        setIsRetrying(true);
        setRetryError("");

        try {
            const response = await api.post("/payments/retry", {
                orderId: resultData.orderId,
                paymentMethod: "MOCK"
            });

            const paymentUrl = response.data?.data?.paymentUrl;
            if (!paymentUrl) {
                throw new Error("Không nhận được URL thanh toán lại.");
            }

            window.location.href = paymentUrl;
        } catch (error: any) {
            console.error("Retry payment error:", error);
            setRetryError(
                error?.response?.data?.message ||
                "Không thể thanh toán lại đơn hàng này. Vui lòng chọn vé lại."
            );
        } finally {
            setIsRetrying(false);
        }
    };

    const config = useMemo(() => {
        if (status === "success") {
            return {
                icon: <CheckCircle2 size={48} strokeWidth={1.8} />,
                title: "Cảm ơn bạn!",
                subtitle: "Thanh toán của bạn đã thành công",
                description: resultData.email
                    ? `Thông tin vé và đơn hàng đã được gửi đến ${resultData.email}`
                    : "Đơn hàng của bạn đã được ghi nhận trong hệ thống.",
                accentColor: "text-emerald-500",
                buttonColor: "bg-pink-500 hover:bg-pink-600",
                secondaryText: "Về trang chủ"
            };
        }

        return {
            icon: <XCircle size={48} strokeWidth={1.8} />,
            title: "Thanh toán thất bại",
            subtitle: resultData.canRetry ? "Bạn vẫn còn thời gian để thanh toán lại" : "Giao dịch chưa được hoàn tất",
            description:
                resultData.message ||
                "Bạn có thể thử thanh toán lại hoặc quay về trang sự kiện.",
            accentColor: "text-rose-500",
            buttonColor: "bg-pink-500 hover:bg-pink-600",
            secondaryText: "Về trang chủ"
        };
    }, [status, resultData]);

    if (status === "loading") {
        return <LoadingOverlay isVisible={true} message="Đang xác nhận thanh toán..." />;
    }


    return (
        <main className="relative min-h-[620px] bg-[#f5f6f8] overflow-hidden flex items-center justify-center px-6 py-24">
            <LoadingOverlay isVisible={isRetrying} message="Đang tạo lại thanh toán..." />
            <ErrorModal message={retryError} onClose={() => setRetryError("")} />
            {status === "success" && <ConfettiBackground />}

            <section className="relative z-10 w-full max-w-3xl text-center">
                <div className={`${config.accentColor} flex justify-center mb-5`}>
                    {config.icon}
                </div>

                <h1 className={`text-4xl md:text-5xl font-bold tracking-wide ${config.accentColor}`}>
                    {config.title}
                </h1>

                <p className={`mt-5 text-xl md:text-2xl font-medium ${config.accentColor}`}>
                    {config.subtitle}
                </p>

                <p className="mt-4 text-gray-600 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
                    {config.description}
                </p>

                {resultData.canRetry && resultData.cancellationDeadline && (
                    <p className="mt-3 text-sm text-gray-500">
                        Đơn hàng được giữ đến {new Date(resultData.cancellationDeadline).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit"
                        })}.
                    </p>
                )}


                <div className="mt-12 flex flex-col sm:flex-row justify-center gap-5">
                    <button
                        onClick={() => navigate("/")}
                        className="h-14 min-w-[240px] rounded-xl border border-gray-400 bg-white text-gray-700 font-medium text-lg transition hover:bg-gray-100"
                    >
                        {config.secondaryText}
                    </button>

                    {status === "failed" && resultData.canRetry ? (
                        <button
                            onClick={handleRetryPayment}
                            disabled={isRetrying}
                            className="h-14 min-w-[260px] rounded-xl bg-pink-500 text-white font-semibold text-lg tracking-wide transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {isRetrying ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Đang tạo lại thanh toán
                                </>
                            ) : (
                                <>
                                    <RotateCcw size={20} />
                                    Thanh toán lại
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                if (resultData.orderId) {
                                    navigate(`/orders/detail?order_id=${resultData.orderId}`);
                                } else {
                                    navigate("/profile/orders");
                                }
                            }}
                            className={`h-14 min-w-[260px] rounded-xl text-white font-semibold text-lg tracking-wide transition ${config.buttonColor}`}
                        >
                            Xem đơn hàng
                        </button>
                    )}
                </div>
            </section>
        </main>
    );
};

const ConfettiBackground: React.FC = () => {
    const pieces = Array.from({ length: 48 });

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {pieces.map((_, index) => {
                const left = `${8 + Math.random() * 84}%`;
                const top = `${12 + Math.random() * 78}%`;
                const rotate = `${Math.random() * 180}deg`;
                const opacity = 0.25 + Math.random() * 0.55;

                return (
                    <span
                        key={index}
                        className="absolute block w-1.5 h-1.5 bg-emerald-400"
                        style={{
                            left,
                            top,
                            opacity,
                            transform: `rotate(${rotate})`
                        }}
                    />
                );
            })}
        </div>
    );
};

export default PaymentResultPage;
