import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import * as OTPAuth from 'otpauth';
import { api } from '@/lib/axiosClient';
import { Button } from '@/components/ui/button';

export default function TicketDetailPage() {
    const { ticketId } = useParams();
    const navigate = useNavigate();

    const [totpCode, setTotpCode] = useState<string>('');
    const [qrPayload, setQrPayload] = useState<string>('');
    const [timeLeft, setTimeLeft] = useState<number>(30);

    // 1. FETCH DỮ LIỆU VÉ (Gồm Secret và Chữ ký RSA)
    const { data: ticketDetail, isLoading, isError } = useQuery({
        queryKey: ['ticket-detail', ticketId],
        queryFn: async () => {
            const res = await api.get(`/tickets/${ticketId}`);
            // Đảm bảo trỏ đúng cấu trúc backend: res.status(200).json({ data: { ... } })
            return res.data?.data;
        },
        enabled: !!ticketId,
        refetchOnWindowFocus: false // Không cần fetch lại liên tục vì QR tự chạy offline
    });

    // 2. VÒNG LẶP CẬP NHẬT TOTP VÀ QR CODE ĐỘNG
    useEffect(() => {
        if (!ticketDetail?.ticket_secret) return;

        // Khởi tạo bộ máy sinh TOTP bằng chuẩn SHA1, 6 số, 30 giây
        const totp = new OTPAuth.TOTP({
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            // Thư viện yêu cầu truyền vào Base32 Secret
            secret: OTPAuth.Secret.fromBase32(ticketDetail.ticket_secret),
        });

        const updateQRCode = () => {
            // Lấy mã TOTP hiện tại
            const currentToken = totp.generate();
            setTotpCode(currentToken);

            // Ráp đúng format Backend yêu cầu: [0]TicketId | [1]Secret | [2]TOTP | [3]Signature
            const payload = `${ticketDetail.ticket_id}|${ticketDetail.ticket_secret}|${currentToken}|${ticketDetail.signature}`;
            setQrPayload(payload);

            // Tính số giây còn lại của chu kỳ 30s để làm thanh Progress Bar
            const epochSeconds = Math.floor(Date.now() / 1000);
            const remainingSeconds = 30 - (epochSeconds % 30);
            setTimeLeft(remainingSeconds);
        };

        // Chạy ngay lần đầu
        updateQRCode();

        // Chạy lặp lại mỗi 1 giây để cập nhật thanh tiến trình và đổi QR
        const interval = setInterval(updateQRCode, 1000);

        return () => clearInterval(interval);
    }, [ticketDetail]);

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center">Đang tải vé...</div>;
    }

    if (isError || !ticketDetail) {
        return <div className="min-h-screen flex items-center justify-center text-red-500">Lỗi không thể tải vé!</div>;
    }

    // Tính toán độ dài thanh Progress Bar (0% -> 100%)
    const progressWidth = `${(timeLeft / 30) * 100}%`;

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center py-12 px-4 font-sans">

            {/* Thanh điều hướng */}
            <div className="w-full max-w-md flex justify-between items-center mb-8">
                <Button variant="ghost" onClick={() => navigate('/my-tickets')} className="text-white hover:bg-slate-800">
                    ← Quay lại
                </Button>
                <h1 className="text-xl font-bold text-white">Vé điện tử</h1>
                <div className="w-16"></div> {/* Cân bằng flexbox */}
            </div>

            {/* Tấm vé (Ticket UI) */}
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative">

                {/* Header Vé */}
                <div className="bg-primary p-6 text-center text-white relative">
                    <h2 className="text-2xl font-bold uppercase tracking-wider mb-1">DỀ DÊ CONCERT</h2>
                    <p className="text-primary-foreground/80 text-sm">Quét mã này tại cổng kiểm soát</p>

                    {/* Hiệu ứng đục lỗ của vé */}
                    <div className="absolute -bottom-4 left-[-16px] w-8 h-8 bg-slate-900 rounded-full"></div>
                    <div className="absolute -bottom-4 right-[-16px] w-8 h-8 bg-slate-900 rounded-full"></div>
                </div>

                {/* Đường gạch ngang nét đứt */}
                <div className="border-b-2 border-dashed border-gray-300 w-full relative"></div>

                {/* Khu vực QR Code */}
                <div className="p-8 flex flex-col items-center bg-white">

                    {/* Thanh đếm ngược (Tiến trình mãnh liệt) */}
                    <div className="w-full max-w-[200px] mb-6">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                            <span>Mã đổi sau:</span>
                            <span className={timeLeft <= 5 ? 'text-red-500' : 'text-blue-500'}>
                                {timeLeft} giây
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ease-linear rounded-full ${timeLeft <= 5 ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{ width: progressWidth }}
                            ></div>
                        </div>
                    </div>

                    {/* QR Code Động */}
                    <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm relative">
                        {/* Hiển thị lớp phủ mờ khi mã đang thay đổi (1s cuối) để UX tốt hơn */}
                        <div className={`transition-opacity duration-300 ${timeLeft === 30 ? 'opacity-50' : 'opacity-100'}`}>
                            <QRCodeSVG
                                value={qrPayload}
                                size={220}
                                level="M" // Mức độ sửa lỗi Medium (tốt cho QR phức tạp)
                                includeMargin={false}
                            />
                        </div>
                    </div>

                    <p className="mt-6 text-sm text-center text-slate-500">
                        Mã QR chứa chữ ký bảo mật và tự động xoay vòng.<br />
                        <strong className="text-red-500">Tuyệt đối không chụp màn hình.</strong>
                    </p>
                </div>

                {/* Thông tin chỗ ngồi */}
                <div className="bg-slate-50 p-6 flex justify-between text-center border-t border-slate-100">
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Khu vực</p>
                        <p className="text-lg font-bold text-slate-800">{ticketDetail.zone_id || '---'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Ghế</p>
                        <p className="text-lg font-bold text-slate-800">{ticketDetail.seat_id || '---'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Mã bảo mật</p>
                        <p className="text-lg font-mono font-bold text-slate-800 tracking-widest">{totpCode}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}