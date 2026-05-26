import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/axiosClient'; // Đường dẫn tới file Axios config của bạn
import { ErrorModal } from '@/components/shared/ErrorModal';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';

export default function MockGatewayPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Đọc tham số từ URL

    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);


    const handlePayment = async (status: 'SUCCESS' | 'FAILED') => {
        setIsLoading(true);
        try {
            const response = await api.post('/payments/mock/generate-return-url', {
                orderId: orderId,
                amount: amount,
                status: status
            });

            const returnUrl = response.data?.data?.returnUrl;

            if (returnUrl) {
                window.location.href = returnUrl;
            } else {
                throw new Error("Không nhận được Return URL từ máy chủ.");
            }

        } catch (error) {
            console.error("Lỗi khi xử lý giả lập thanh toán:", error);
            setErrorMessage("Có lỗi hệ thống xảy ra khi giả lập thanh toán.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!orderId || !amount) {
        return (
            <>
                <ErrorModal message="URL không hợp lệ. Thiếu thông tin đơn hàng!" onClose={() => navigate(`/`)} />
                <div className="p-10 text-center text-red-500 font-bold">URL không hợp lệ. Thiếu thông tin đơn hàng!</div>
            </>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
            <LoadingOverlay isVisible={isLoading} message="Đang xử lý thanh toán..." />
            <ErrorModal message={errorMessage} onClose={() => { setErrorMessage(null); navigate(`/`); }} />
            <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-blue-600 p-6 text-center text-white">
                    <h1 className="text-2xl font-bold tracking-wider">MOCK GATEWAY</h1>
                    <p className="text-blue-100 mt-1 text-sm">Môi trường giả lập thanh toán</p>
                </div>

                {/* Thông tin đơn hàng */}
                <div className="p-8">
                    <div className="text-center mb-8">
                        <p className="text-slate-500 text-sm mb-2">Số tiền thanh toán</p>
                        <p className="text-4xl font-bold text-slate-800 font-mono">
                            {Number(amount).toLocaleString('vi-VN')} đ
                        </p>
                    </div>

                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-8">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Mã đơn hàng:</span>
                            <span className="font-bold text-slate-700 font-mono">{orderId}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Nhà cung cấp:</span>
                            <span className="font-bold text-slate-700">TICKIFY (DỀ DÊ)</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => handlePayment('SUCCESS')}
                            disabled={isLoading}
                            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl transition-colors flex justify-center items-center"
                        >
                            {isLoading ? "Đang xử lý..." : "Xác nhận Thanh toán"}
                        </button>

                        <button
                            onClick={() => handlePayment('FAILED')}
                            disabled={isLoading}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-xl transition-colors"
                        >
                            Hủy giao dịch
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}