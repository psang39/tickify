import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/axiosClient';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { ErrorModal } from '@/components/shared/ErrorModal';
import {
    ArrowLeft,
    CreditCard,
    Info,
    Ticket as TicketIcon,
    XCircle,
    Clock3,
    AlertTriangle,
    CalendarDays,
    MapPin,
    ReceiptText
} from 'lucide-react';

interface PopulatedRef {
    _id: string;
    name?: string;
    title?: string;
    start_time?: string;
    status?: string;
    venue_id?: {
        _id: string;
        name?: string;
    } | string;
}

interface OrderItem {
    seat_id?: string;
    ticket_type_id?: string;
    zone_id?: string;
    price?: number;
}

interface OrderDetail {
    _id: string;
    status?: string;
    payment_status?: string;
    total_price?: number;
    total_amount?: number;
    final_amount?: number;
    amount?: number;
    createdAt?: string;
    updatedAt?: string;
    cancellation_deadline?: string;
    event_id?: PopulatedRef | string;
    show_id?: PopulatedRef | string;
    items?: OrderItem[];
}

interface TicketDetail {
    _id: string;
    ticket_type_id?: {
        _id: string;
        name?: string;
        price?: number;
        description?: string;
    };
    seat_id?: {
        _id: string;
        row?: string;
        seat_number?: string;
        col_index?: number;
    };
    show_id?: {
        _id: string;
        name?: string;
        start_time?: string;
        status?: string;
    };
    zone_id?: {
        _id: string;
        name?: string;
    };
    event_id?: {
        _id: string;
        name?: string;
    };
}

interface OrderDetailResponse {
    order: OrderDetail;
    tickets: TicketDetail[];
}

export default function OrderDetailPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const { userData } = useOutletContext<{ userData: any }>();
    const orderId = searchParams.get('order_id');

    const {
        data,
        isLoading,
        isError
    } = useQuery<OrderDetailResponse>({
        queryKey: ['orderDetail', orderId],
        queryFn: async () => {
            if (!orderId) {
                throw new Error('Missing order id');
            }

            const response = await api.get(`/orders/${orderId}`);
            return {
                order: response.data?.order,
                tickets: response.data?.tickets || []
            };
        },
        enabled: !!orderId
    });

    useEffect(() => {
        if (isError) {
            setErrorMessage('Đã xảy ra lỗi khi tải thông tin chi tiết đơn hàng. Vui lòng thử lại.');
        }
    }, [isError]);

    const order = data?.order;
    const tickets = data?.tickets || [];
    const hasTickets = tickets.length > 0;

    const paymentStatus = getPaymentStatusMeta(order?.status || order?.payment_status);

    const firstTicket = tickets[0];
    const populatedEvent = typeof order?.event_id === 'object' ? order.event_id : undefined;
    const populatedShow = typeof order?.show_id === 'object' ? order.show_id : undefined;

    const eventName =
        populatedEvent?.name ||
        populatedEvent?.title ||
        firstTicket?.event_id?.name ||
        'Đơn hàng sự kiện';

    const showName =
        populatedShow?.name ||
        firstTicket?.show_id?.name ||
        'Suất diễn';

    const showTime =
        populatedShow?.start_time ||
        firstTicket?.show_id?.start_time;

    const venueName =
        typeof populatedShow?.venue_id === 'object'
            ? populatedShow.venue_id?.name
            : undefined;

    const totalTicketPrice = useMemo(() => {
        return tickets.reduce((sum, ticket) => sum + (ticket.ticket_type_id?.price || 0), 0);
    }, [tickets]);

    const totalOrderAmount =
        order?.total_amount ??
        order?.total_price ??
        order?.final_amount ??
        order?.amount ??
        totalTicketPrice;

    const issuedTicketCount = tickets.length;
    const orderedSeatCount = order?.items?.length || tickets.length;

    const canOpenTickets = paymentStatus.kind === 'success' && hasTickets;

    const shortOrderId = order?._id
        ? order._id.substring(order._id.length - 8).toUpperCase()
        : orderId
          ? orderId.substring(orderId.length - 8).toUpperCase()
          : '';

    const formatCurrency = (amount?: number) => {
        return `${new Intl.NumberFormat('vi-VN').format(amount || 0)} VND`;
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Chưa cập nhật thời gian';
        return new Intl.DateTimeFormat('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(dateString));
    };

    return (
        <div className="w-full max-w-4xl animate-in fade-in duration-300">
            <LoadingOverlay isVisible={isLoading} />
            <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />

            <div className="mb-5">
                <button
                    type="button"
                    onClick={() => navigate('/orders')}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-primary transition-colors group"
                >
                    <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                    <span>Quay lại lịch sử đặt vé</span>
                </button>
            </div>

            <header className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    Chi tiết đơn hàng #{shortOrderId}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Theo dõi trạng thái thanh toán, thông tin suất diễn và danh sách vé đã phát hành.
                </p>
            </header>

            {!isLoading && !order ? (
                <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center">
                    <AlertTriangle size={34} className="mx-auto text-amber-500 mb-3" />
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Không tìm thấy đơn hàng</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Đơn hàng không tồn tại hoặc bạn không có quyền xem đơn này.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-7 space-y-6">
                        <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-none">
                            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4 mb-5">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider">
                                        Thông tin đơn hàng
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1 font-mono">#{shortOrderId}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap ${paymentStatus.badgeClassName}`}>
                                    {paymentStatus.label}
                                </span>
                            </div>

                            <div className="mb-5">
                                <h4 className="font-black text-xl text-slate-800 dark:text-slate-100 leading-snug">{eventName}</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold mt-1">{showName}</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                                <InfoBox
                                    icon={<CalendarDays size={16} />}
                                    label="Thời gian diễn"
                                    value={formatDate(showTime)}
                                />
                                <InfoBox
                                    icon={<MapPin size={16} />}
                                    label="Địa điểm"
                                    value={venueName || 'Chưa cập nhật địa điểm'}
                                />
                                <InfoBox
                                    icon={<TicketIcon size={16} />}
                                    label="Số vé đặt"
                                    value={`${orderedSeatCount} vé`}
                                />
                                <InfoBox
                                    icon={<ReceiptText size={16} />}
                                    label="Vé đã phát hành"
                                    value={`${issuedTicketCount} vé`}
                                />
                            </div>

                            <div className="space-y-2 border-b border-slate-200 dark:border-white/10 pb-4 mb-4">
                                {hasTickets ? (
                                    tickets.map((ticket) => (
                                        <div
                                            key={ticket._id}
                                            className="flex justify-between items-center gap-4 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/90 border border-slate-100 dark:border-white/10 rounded-xl px-3 py-2.5"
                                        >
                                            <span className="min-w-0">
                                                <span className="font-bold text-slate-800 dark:text-slate-100">
                                                    {ticket.ticket_type_id?.name || 'Vé sự kiện'}
                                                </span>
                                                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                    Khu {ticket.zone_id?.name || 'N/A'} — Hàng {ticket.seat_id?.row || 'N/A'}, Ghế {ticket.seat_id?.seat_number || 'N/A'}
                                                </span>
                                            </span>
                                            <span className="font-mono text-slate-700 dark:text-slate-200 shrink-0">
                                                {formatCurrency(ticket.ticket_type_id?.price || 0)}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-white dark:bg-slate-900/90 border border-dashed border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm text-slate-500 dark:text-slate-400">
                                        {paymentStatus.kind === 'failed'
                                            ? 'Đơn hàng thanh toán thất bại nên hệ thống không phát hành vé.'
                                            : paymentStatus.kind === 'pending'
                                              ? 'Đơn hàng đang chờ thanh toán, vé sẽ được phát hành sau khi thanh toán thành công.'
                                              : 'Chưa có vé nào được phát hành cho đơn hàng này.'}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-slate-800 dark:text-slate-100 font-bold pt-2 border-t border-slate-100 dark:border-white/10 text-base">
                                    <span>Tổng cộng</span>
                                    <span className="font-mono text-primary">{formatCurrency(totalOrderAmount)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-none">
                            <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-3 border-b border-slate-200 dark:border-white/10 pb-2">
                                Thông tin khách hàng
                            </h3>
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-200 space-y-1">
                                <p className="font-bold text-slate-800 dark:text-slate-100">{`${userData?.first_name || ''} ${userData?.last_name || ''}`}</p>
                                <p className="text-slate-500 dark:text-slate-400">{userData?.email}</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex gap-3 items-start text-xs text-slate-500 dark:text-slate-400 shadow-none">
                            <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
                            <span>
                                {paymentStatus.kind === 'success'
                                    ? 'Vé điện tử sử dụng mã QR duy nhất để check-in tại cổng kiểm soát. Vui lòng mở từng vé khi đến sự kiện.'
                                    : paymentStatus.kind === 'pending'
                                      ? 'Đơn hàng hiện đang chờ thanh toán. Vé điện tử chỉ được phát hành sau khi thanh toán thành công.'
                                      : 'Đơn hàng không phát hành vé do thanh toán thất bại hoặc đã bị hủy.'}
                            </span>
                        </div>
                    </div>

                    <div className="md:col-span-5 space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-none">
                            <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
                                Trạng thái thanh toán
                            </h3>

                            <div className={`${paymentStatus.cardClassName} rounded-xl p-4 flex items-center justify-between mb-6`}>
                                <div className="flex items-center gap-3">
                                    {paymentStatus.icon}
                                    <span className={`text-xs font-bold ${paymentStatus.textClassName}`}>{paymentStatus.label}</span>
                                </div>
                                <span className={`text-xs font-mono font-black ${paymentStatus.amountClassName}`}>
                                    {formatCurrency(totalOrderAmount)}
                                </span>
                            </div>

                            <div className="space-y-2.5">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                                    Danh sách vé thuộc đơn ({tickets.length} vé)
                                </p>

                                {!hasTickets ? (
                                    <p className="text-xs text-slate-400 italic text-center py-3">
                                        Không có vé khả dụng cho đơn hàng này.
                                    </p>
                                ) : (
                                    tickets.map((ticket, index) => (
                                        <button
                                            key={ticket._id}
                                            type="button"
                                            onClick={() => canOpenTickets && navigate(`/tickets/${ticket._id}`)}
                                            disabled={!canOpenTickets}
                                            className={`w-full font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-between transition-all active:scale-[0.99] group shadow-none ${
                                                canOpenTickets
                                                    ? 'bg-primary hover:bg-primary/90 text-white'
                                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <TicketIcon size={16} className="opacity-90" />
                                                <span>{canOpenTickets ? `Xem Vé Điện Tử ${index + 1}` : `Vé chưa khả dụng ${index + 1}`}</span>
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
            )}
        </div>
    );
}

function InfoBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="bg-white dark:bg-slate-900/90 border border-slate-100 dark:border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
                {icon}
                <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-snug">{value}</p>
        </div>
    );
}

function getPaymentStatusMeta(status?: string) {
    const normalizedStatus = (status || '').toLowerCase();

    if (['cancelled', 'canceled', 'failed', 'expired', 'payment_failed'].includes(normalizedStatus)) {
        return {
            kind: 'failed',
            label: 'Thanh toán thất bại',
            icon: <XCircle size={18} className="text-rose-600" />,
            cardClassName: 'bg-rose-50 border border-rose-100',
            textClassName: 'text-rose-800',
            amountClassName: 'text-rose-700',
            badgeClassName: 'bg-rose-50 text-rose-700 border-rose-100'
        };
    }

    if (['pending', 'processing', 'awaiting_payment'].includes(normalizedStatus)) {
        return {
            kind: 'pending',
            label: 'Đang chờ thanh toán',
            icon: <Clock3 size={18} className="text-amber-600" />,
            cardClassName: 'bg-amber-50 border border-amber-100',
            textClassName: 'text-amber-800',
            amountClassName: 'text-amber-700',
            badgeClassName: 'bg-amber-50 text-amber-700 border-amber-100'
        };
    }

    if (!normalizedStatus) {
        return {
            kind: 'unknown',
            label: 'Chưa xác định',
            icon: <AlertTriangle size={18} className="text-slate-500 dark:text-slate-400" />,
            cardClassName: 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10',
            textClassName: 'text-slate-700 dark:text-slate-200',
            amountClassName: 'text-slate-700 dark:text-slate-200',
            badgeClassName: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
        };
    }

    return {
        kind: 'success',
        label: 'Đã thanh toán thành công',
        icon: <CreditCard size={18} className="text-emerald-600" />,
        cardClassName: 'bg-emerald-50 border border-emerald-100',
        textClassName: 'text-emerald-800',
        amountClassName: 'text-emerald-700',
        badgeClassName: 'bg-emerald-50 text-emerald-700 border-emerald-100'
    };
}
