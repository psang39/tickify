import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/axiosClient';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { ErrorModal } from '@/components/shared/ErrorModal';
import { CreditCard, Ticket as TicketIcon, Mail, Info, ArrowLeft } from 'lucide-react'; // Thêm ArrowLeft

interface TicketDetail {
    _id: string;
    ticket_type_id: { _id: string; name: string; price: number; description?: string };
    seat_id: { _id: string; row: string; seat_number: string; col_index: number };
    show_id: { _id: string; name: string; start_time: string };
    zone_id: { _id: string; name: string };
    event_id: { _id: string; name: string };
}

export default function OrderDetailPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const { userData } = useOutletContext<{ userData: any }>();
    const orderId = searchParams.get('order_id');

    const { data: tickets = [], isLoading, isError } = useQuery<TicketDetail[]>({
        queryKey: ['orderTickets', orderId],
        queryFn: async () => {
            if (!orderId) return [];
            const response = await api.get(`/orders/${orderId}/tickets`);
            return response.data;
        },
        enabled: !!orderId
    });

    useEffect(() => {
        if (isError) {
            setErrorMessage("Đã xảy ra lỗi khi tải thông tin chi tiết vé. Vui lòng thử lại.");
        }
    }, [isError]);

    const firstTicket = tickets[0];
    const eventName = firstTicket?.event_id?.name || "Đang cập nhật...";
    const showTime = firstTicket?.show_id?.start_time;

    const totalTicketPrice = useMemo(() => {
        return tickets.reduce((sum, ticket) => sum + (ticket.ticket_type_id?.price || 0), 0);
    }, [tickets]);

    const transactionFee = 25000;
    const totalOrderAmount = totalTicketPrice + transactionFee;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return "Chưa cập nhật ngày";
        return new Intl.DateTimeFormat('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(dateString));
    };

    const shortOrderId = orderId ? orderId.substring(orderId.length - 8).toUpperCase() : "";

    return (
        <div className="w-full max-w-4xl animate-in fade-in duration-300">
            <LoadingOverlay isVisible={isLoading} />
            <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />

            {/* NÚT QUAY LẠI TRANG LỊCH SỬ ĐẶT VÉ */}
            <div className="mb-5">
                <button
                    type="button"
                    onClick={() => navigate('/orders')}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary transition-colors group"
                >
                    <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                    <span>Quay lại lịch sử đặt vé</span>
                </button>
            </div>

            {/* TIÊU ĐỀ TRANG */}
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800 mb-2">
                    Chào {userData?.first_name || 'bạn'},
                </h1>
                <p className="text-slate-500 text-sm">
                    Dưới đây là thông tin chi tiết và trạng thái của mã đơn hàng <span className="font-mono font-bold text-primary">#{shortOrderId}</span>
                </p>
            </header>

            {/* GRID LAYOUT CHIA LÀM HAI CỘT THEO MẪU */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">

                {/* CỘT TRÁI: THÔNG TIN ĐƠN HÀNG & KHÁCH HÀNG (8 Cột) */}
                <div className="md:col-span-7 space-y-6">

                    {/* KHỐI 1: THÔNG TIN VÉ ĐẶT (ORDER) */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-none">
                        <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                            Thông tin đơn hàng
                        </h3>
                        <div className="mb-4">
                            <h4 className="font-black text-lg text-slate-800">{eventName}</h4>
                            <p className="text-xs text-slate-500 font-medium mt-1">{formatDate(showTime)}</p>
                        </div>

                        {/* Danh sách vị trí ghế ngồi */}
                        <div className="space-y-2 border-b border-slate-200 pb-4 mb-4">
                            {tickets.map((ticket) => (
                                <div key={ticket._id} className="flex justify-between items-center text-sm font-medium text-slate-600">
                                    <span>
                                        Khu {ticket.zone_id?.name || 'N/A'} — Hàng {ticket.seat_id?.row}, Ghế {ticket.seat_id?.seat_number}
                                    </span>
                                    <span className="font-mono text-slate-700">
                                        {formatCurrency(ticket.ticket_type_id?.price || 0)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Chi tiết biểu phí tính toán tổng */}
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-slate-500 font-medium">
                                <span>Phí xử lý giao dịch</span>
                                <span className="font-mono">{formatCurrency(transactionFee)}</span>
                            </div>
                            <div className="flex justify-between text-slate-800 font-bold pt-2 border-t border-slate-100 text-base">
                                <span>Tổng cộng</span>
                                <span className="font-mono text-primary">{formatCurrency(totalOrderAmount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* KHỐI 2: THÔNG TIN KHÁCH HÀNG (CUSTOMER) */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-none">
                        <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">
                            Thông tin khách hàng
                        </h3>
                        <div className="text-sm font-medium text-slate-700 space-y-1">
                            <p className="font-bold text-slate-800">{`${userData?.first_name || ''} ${userData?.last_name || ''}`}</p>
                            <p className="text-slate-500">{userData?.email}</p>
                        </div>
                        <div className="mt-4 flex gap-2.5 items-start bg-blue-50/50 border border-blue-100 p-3 rounded-xl text-xs text-blue-700">
                            <Mail size={16} className="shrink-0 mt-0.5" />
                            <span>
                                <strong>Lưu ý:</strong> Hệ thống vé điện tử đã được gửi đồng thời về hòm thư của bạn. Vui lòng kiểm tra kỹ cả hộp thư rác (Spam) nếu không tìm thấy.
                            </span>
                        </div>
                    </div>

                    {/* KHỐI 3: BOX THÔNG TIN QUY ĐỊNH (E-TICKET) */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex gap-3 items-start text-xs text-slate-500 shadow-none">
                        <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
                        <span>
                            Vé điện tử (e-Ticket) sử dụng mã phản hồi QR Code duy nhất để check-in tại cổng kiểm soát. Vui lòng nhấn vào từng liên kết vé bên cạnh để hiển thị mã quét trên thiết bị di động khi ra vào sự kiện.
                        </span>
                    </div>
                </div>

                {/* CỘT PHẢI: TRẠNG THÁI THANH TOÁN & CLICK XEM VÉ */}
                <div className="md:col-span-5 space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-none">
                        <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                            Trạng thái thanh toán
                        </h3>

                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <CreditCard size={18} className="text-emerald-600" />
                                <span className="text-xs font-bold text-emerald-800">Đã thanh toán thành công</span>
                            </div>
                            <span className="text-xs font-mono font-black text-emerald-700">
                                {formatCurrency(totalOrderAmount)}
                            </span>
                        </div>

                        {/* ĐIỀU HƯỚNG TỪNG VÉ */}
                        <div className="space-y-2.5">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                                Danh sách vé thuộc đơn ({tickets.length} vé)
                            </p>

                            {tickets.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-2">Không tìm thấy mã vé khả dụng.</p>
                            ) : (
                                tickets.map((ticket, index) => (
                                    <button
                                        key={ticket._id}
                                        type="button"
                                        onClick={() => navigate(`/tickets/${ticket._id}`)}
                                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-between transition-all active:scale-[0.99] group shadow-none"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <TicketIcon size={16} className="opacity-90" />
                                            <span>Xem Vé Điện Tử {index + 1}</span>
                                        </div>
                                        <span className="bg-white/20 px-2.5 py-0.5 rounded-md text-xs font-mono font-bold">
                                            Ghế {ticket.seat_id?.seat_number || 'N/A'}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}