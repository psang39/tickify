import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/axiosClient'; // Đường dẫn tới file Axios config của bạn

export default function MockGatewayPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Đọc tham số từ URL

    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');

    const [isLoading, setIsLoading] = useState(false);

    // 🔐 Hàm tạo Chữ ký điện tử y hệt chuẩn của VNPAY/MoMo
    const generateSignature = async (rawData: string, secret: string) => {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            enc.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', key, enc.encode(rawData));
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    };

    const handlePayment = async (status: 'SUCCESS' | 'FAILED') => {
        setIsLoading(true);
        try {
            const transactionId = `MOCK_${Date.now()}`;
            const rawData = `order_id=${orderId}&amount=${amount}&status=${status}&transactionId=${transactionId}`;

            // ⚠️ QUAN TRỌNG: Sửa lại chuỗi này cho giống y hệt MOCK_PAYMENT_SECRET trong file .env của Backend!
            // (Trong thực tế, trang Gateway là của bên thứ 3 nên họ tự giữ Secret này)
            const secret = 'bacf52a3ec1d9d69372195cffac11ec50ec0874338c38505013cf8d541fde0fe';

            const signature = await generateSignature(rawData, secret);

            // Đóng vai Cổng thanh toán, gọi về Webhook của hệ thống Dề Dê
            await api.post('/webhooks/payment-result', {
                order_id: orderId,
                amount: amount,
                status: status,
                transaction_id: transactionId,
                signature: signature
            });

            if (status === 'SUCCESS') {
                alert("Giao dịch thành công! Đang quay lại trang chủ...");
                // Giao dịch xong thì điều hướng user về trang xem vé hoặc trang thành công
                navigate(`/`);
            } else {
                alert("Giao dịch thất bại / Đã hủy.");
                navigate(`/`);
            }

        } catch (error) {
            console.error("Lỗi khi gửi Webhook:", error);
            alert("Có lỗi hệ thống xảy ra khi giả lập thanh toán.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!orderId || !amount) {
        return <div className="p-10 text-center text-red-500 font-bold">URL không hợp lệ. Thiếu thông tin đơn hàng!</div>;
    }

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Header giống giao diện ngân hàng */}
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

                    {/* Nút thao tác */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => handlePayment('SUCCESS')}
                            disabled={isLoading}
                            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-green-500/30 flex justify-center items-center"
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