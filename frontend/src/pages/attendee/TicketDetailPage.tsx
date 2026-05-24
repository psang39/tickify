import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import * as OTPAuth from 'otpauth';
import { api } from '@/lib/axiosClient';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldAlert, Calendar, MapPin, Armchair } from 'lucide-react';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { ErrorModal } from '@/components/shared/ErrorModal';

interface TicketDetail {
    _id: string;
    order_id: string;
    ticket_secret: string;
    signature: string;
    event_id: { _id: string; name: string; poster_url?: string; banner_url?: string };
    show_id: { _id: string; name: string; start_time: string };
    zone_id: { _id: string; name: string };
    seat_id: { _id: string; row: string; seat_number: string };
    ticket_type_id: { _id: string; name: string; price: number };
}

export default function TicketDetailPage() {
    const { ticketId } = useParams();
    const navigate = useNavigate();

    const [totpCode, setTotpCode] = useState<string>('');
    const [qrPayload, setQrPayload] = useState<string>('');
    const [timeLeft, setTimeLeft] = useState<number>(30);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);


    const { data: ticketDetail, isLoading, isError } = useQuery<TicketDetail>({
        queryKey: ['ticket-detail', ticketId],
        queryFn: async () => {
            const res = await api.get(`/tickets/${ticketId}`);
            return res.data?.data || res.data;
        },
        enabled: !!ticketId,
        refetchOnWindowFocus: false
    });


    useEffect(() => {
        if (isError) {
            setErrorMessage("Không thể kết nối dữ liệu vé điện tử. Vui lòng thử lại.");
        }
    }, [isError]);


    useEffect(() => {
        if (!ticketDetail?.ticket_secret) return;

        const totp = new OTPAuth.TOTP({
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(ticketDetail.ticket_secret),
        });

        const updateQRCode = () => {
            const currentToken = totp.generate();
            setTotpCode(currentToken);


            const payload = `${ticketDetail._id}|${ticketDetail.ticket_secret}|${currentToken}|${ticketDetail.signature}`;
            setQrPayload(payload);

            const epochSeconds = Math.floor(Date.now() / 1000);
            const remainingSeconds = 30 - (epochSeconds % 30);
            setTimeLeft(remainingSeconds);
        };

        updateQRCode();
        const interval = setInterval(updateQRCode, 1000);

        return () => clearInterval(interval);
    }, [ticketDetail]);


    const formatCurrency = (amount?: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return "Chưa cập nhật ngày";
        return new Intl.DateTimeFormat('vi-VN', {
            weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(new Date(dateString));
    };

    if (isLoading) return <LoadingOverlay isVisible={true} />;
    if (isError || !ticketDetail) return <ErrorModal message={errorMessage || "Lỗi tải vé"} onClose={() => navigate('/orders')} />;


    const ticketImage = ticketDetail.event_id?.banner_url || ticketDetail.event_id?.poster_url || "";
    const progressWidth = `${(timeLeft / 30) * 100}%`;

    return (
        <div className="min-h-screen font-sans text-slate-900  flex flex-col items-center justify-center">
            <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />

            {/* THANH ĐIỀU HƯỚNG QUAY LẠI ĐƠN HÀNG */}
            <div className="w-full max-w-4xl flex justify-start mb-6">
                <Button
                    variant="ghost"
                    onClick={() => navigate(`/orders/detail?order_id=${ticketDetail.order_id}`)}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary transition-colors group"
                >
                    <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Quay lại chi tiết đơn hàng
                </Button>
            </div>

            {/* TẤM VÉ HAI PHẦN ĐỈNH CAO (MÔ PHỎNG THEO IMAGE_26F1EA.JPG) */}
            <div className="w-full max-w-4xl bg-white rounded-[24px] border border-slate-200 overflow-hidden flex flex-col md:flex-row relative shadow-none">

                {/* ------------------- PHẦN 1: MAIN STUB (THÂN VÉ CHÍNH - CHIẾM 2/3) ------------------- */}
                <div className="flex-1 p-8 relative flex flex-col justify-between min-h-[340px] overflow-hidden bg-slate-900">
                    {/* Ảnh nền mờ nghệ thuật lấy từ sự kiện (Poster/Banner) */}
                    <div
                        className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-30 transform scale-105"
                        style={{ backgroundImage: `url(${ticketImage})` }}
                    />
                    {/* Lớp phủ dải màu hồng chuyển động đặc trưng của Tickify */}
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-600/90 via-rose-500/80 to-slate-950/95 pointer-events-none" />

                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6 w-full">
                        {/* Chi tiết thông tin Đêm nhạc */}
                        <div className="space-y-4 text-white flex-1">
                            <span className="bg-white/20 text-white font-black text-[10px] tracking-widest uppercase px-3 py-1 rounded-full border border-white/10">
                                VÉ VÀO CỔNG CHÍNH
                            </span>
                            <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight uppercase drop-shadow-sm">
                                {ticketDetail.event_id?.name}
                            </h2>
                            <div className="space-y-1.5 text-white/90 text-sm font-semibold">
                                <p className="flex items-center gap-2"><Calendar size={15} className="opacity-80" /> {formatDate(ticketDetail.show_id?.start_time)}</p>
                                <p className="flex items-center gap-2"><Armchair size={15} className="opacity-80" /> Khu vực: {ticketDetail.zone_id?.name || 'N/A'}</p>
                            </div>
                        </div>

                        {/* KHU VỰC CỤM MÃ QR ĐỘNG XOAY VÒNG */}
                        <div className="bg-white p-4 rounded-2xl flex flex-col items-center shrink-0 mx-auto md:mx-0">
                            <div className="p-1 bg-white relative">
                                <QRCodeSVG value={qrPayload} size={150} level="M" includeMargin={false} />
                            </div>

                            {/* Thanh đếm ngược thông báo đổi mã trực quan ngay dưới QR */}
                            <div className="w-full mt-3">
                                <div className="flex justify-between text-[10px] font-black text-slate-400 mb-1">
                                    <span>MÃ ĐỔI MỚI:</span>
                                    <span className={timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-primary'}>
                                        {timeLeft} GIÂY
                                    </span>
                                </div>
                                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-1000 ease-linear rounded-full ${timeLeft <= 5 ? 'bg-red-500' : 'bg-primary'}`}
                                        style={{ width: progressWidth }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Vị trí số ghế định vị lớn chân vé */}
                    <div className="relative z-10 pt-6 border-t border-white/10 mt-6 flex gap-6 text-white text-xs font-bold uppercase tracking-wider">
                        <div><p className="text-white/50 text-[10px] font-medium mb-0.5">HÀNG GHẾ</p><p className="text-sm font-black text-white">{ticketDetail.seat_id?.row || '---'}</p></div>
                        <div><p className="text-white/50 text-[10px] font-medium mb-0.5">SỐ GHẾ</p><p className="text-sm font-black text-white">{ticketDetail.seat_id?.seat_number || '---'}</p></div>
                        <div><p className="text-white/50 text-[10px] font-medium mb-0.5">LOẠI VÉ</p><p className="text-sm font-black text-pink-300">{ticketDetail.ticket_type_id?.name || 'Standard'}</p></div>
                    </div>

                    {/* Hiệu ứng đục lỗ cắt góc vé răng cưa tại điểm nối */}
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#F8F9FA] rounded-full border border-slate-200 hidden md:block z-20"></div>
                </div>

                {/* ĐƯỜNG RÃNH XÉ VÉ NÉT ĐỨT PHÂN TÁCH */}
                <div className="hidden md:block absolute left-2/3 top-0 bottom-0 border-l-2 border-dashed border-slate-200/40 z-10 pointer-events-none" />

                {/* ------------------- PHẦN 2: TICKET STUB (CUỐNG VÉ KIỂM SOÁT - CHIẾM 1/3) ------------------- */}
                <div className="w-full md:w-1/3 bg-gradient-to-br from-blue-700 to-indigo-900 p-8 text-white flex flex-col justify-between min-h-[300px] md:min-h-auto relative">

                    {/* Đục lỗ đối xứng cuống vé bên phải */}
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#F8F9FA] rounded-full border border-slate-200 hidden md:block z-20"></div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black tracking-widest text-blue-200 uppercase">CUỐNG VÉ SOÁT RE-CHECK</span>
                            {/* Huy hiệu Badge Giá tiền hiển thị sang xịn mịn y mẫu */}
                            <span className="bg-white/10 text-white font-bold text-xs px-2.5 py-1 rounded-md border border-white/10 font-mono">
                                {formatCurrency(ticketDetail.ticket_type_id?.price)}
                            </span>
                        </div>
                        <div>
                            <h3 className="font-black text-base line-clamp-2 uppercase tracking-wide text-white/95">
                                {ticketDetail.event_id?.name}
                            </h3>
                            <p className="text-xs text-blue-200/80 font-semibold mt-1">{formatDate(ticketDetail.show_id?.start_time)}</p>
                        </div>
                    </div>

                    {/* Tái hiển thị thông số ghế ở cuống vé phục vụ đối chiếu tại chỗ ngồi */}
                    <div className="pt-6 border-t border-white/10 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-blue-100">
                            <div><p className="text-blue-300 text-[10px] font-medium uppercase">Khu vực</p><p className="font-bold text-white text-sm">{ticketDetail.zone_id?.name || 'N/A'}</p></div>
                            <div><p className="text-blue-300 text-[10px] font-medium uppercase">Mã Token</p><p className="font-mono text-white font-bold text-sm tracking-wider">{totpCode}</p></div>
                        </div>
                        <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex justify-between items-center text-xs font-bold">
                            <span>VỊ TRÍ: HÀNG {ticketDetail.seat_id?.row}, GHẾ {ticketDetail.seat_id?.seat_number}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* KHỐI THÔNG BÁO QUY ĐỊNH BẢO MẬT PHÍA DƯỚI TẤM VÉ */}
            <div className="w-full max-w-4xl mt-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 items-start text-xs text-amber-800 font-medium">
                <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="font-bold">KHUYẾN CÁO BẢO MẬT AN TOÀN VÉ ĐIỆN TỬ DYNAMIC QR:</p>
                    <p className="text-amber-700/90 leading-relaxed">
                        Mã QR Code trên là mã bảo mật thông minh **tự động xoay vòng làm mới sau mỗi 30 giây**. Hành vi chụp ảnh màn hình điện thoại hoặc in vé ra giấy sẽ khiến mã QR bị hết hạn sau 30 giây và **không thể quét để qua cổng kiểm soát**. Vui lòng mở trực tiếp giao diện trang này trên thiết bị di động tại quầy soát vé.
                    </p>
                </div>
            </div>
        </div>
    );
}