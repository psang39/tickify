import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { api } from '@/lib/axiosClient';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { ErrorModal } from '@/components/shared/ErrorModal';
import { Calendar, MapPin, ReceiptText, ChevronRight } from 'lucide-react';

interface OrderItemDetail {
    seat_id?: string;
    ticket_type_id?: string;
    price?: number;
    quantity?: number;
}

interface OrderItem {
    _id: string;
    status?: 'pending' | 'paid' | 'confirmed' | 'cancelled' | 'failed' | string;
    total_price: number;
    items?: OrderItemDetail[];
    event_id: { _id: string; name: string; poster_url?: string };
    show_id: {
        _id: string;
        name?: string;
        start_time?: string;
        venue_id?: { _id?: string; name: string };
    };
    createdAt: string;
    updatedAt?: string;
}

export default function OrderHistoryPage() {
    const navigate = useNavigate();
    const { userData } = useOutletContext<{ userData: any }>();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const { data: orderData, isLoading, isError } = useQuery({
        queryKey: ['myOrders'],
        queryFn: async () => {
            const response = await api.get('/orders');
            return response.data?.data || response.data;
        }
    });

    useEffect(() => {
        if (isError) {
            setErrorMessage('Đã xảy ra lỗi khi tải danh sách lịch sử đặt vé. Vui lòng thử lại sau.');
        }
    }, [isError]);

    const orders: OrderItem[] = orderData?.orders || [];

    const { activeOrders, pastOrders } = useMemo(() => {
        const now = new Date();
        const active: OrderItem[] = [];
        const past: OrderItem[] = [];

        orders.forEach((order) => {
            const eventDate = order.show_id?.start_time ? new Date(order.show_id.start_time) : new Date(order.createdAt);

            if (eventDate >= now) {
                active.push(order);
            } else {
                past.push(order);
            }
        });

        return { activeOrders: active, pastOrders: past };
    }, [orders]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Chưa cập nhật ngày';
        return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateString));
    };

    const formatTime = (dateString?: string) => {
        if (!dateString) return 'Chưa cập nhật giờ';
        return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
    };

    return (
        <div className="w-full max-w-4xl animate-in fade-in duration-300">
            <LoadingOverlay isVisible={isLoading} />
            <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />

            <header className="mb-10">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Xin chào {userData?.first_name || 'bạn'},</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Dưới đây là toàn bộ lịch sử đơn đặt vé và trạng thái thanh toán của bạn.</p>
            </header>

            <section className="mb-12">
                <h3 className="text-base font-bold text-primary uppercase tracking-wider mb-4">Sự kiện sắp diễn ra</h3>
                {activeOrders.length === 0 ? (
                    <p className="text-slate-400 text-sm italic py-6 border border-dashed border-slate-200 dark:border-white/10 rounded-xl text-center bg-slate-50/50">
                        Bạn hiện không có lịch trình sự kiện âm nhạc nào sắp diễn ra.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {activeOrders.map((order) => (
                            <OrderCard
                                key={order._id}
                                order={order}
                                formatCurrency={formatCurrency}
                                formatDate={formatDate}
                                formatTime={formatTime}
                                onClick={() => navigate(`/orders/detail?order_id=${order._id}`)}
                            />
                        ))}
                    </div>
                )}
            </section>

            <section>
                <h3 className="text-base font-bold text-slate-400 uppercase tracking-wider mb-4">Sự kiện đã tham gia</h3>
                {pastOrders.length === 0 ? (
                    <p className="text-slate-400 text-sm italic py-6 border border-dashed border-slate-200 dark:border-white/10 rounded-xl text-center bg-slate-50/50">
                        Bạn chưa có lịch sử tham gia các đêm nhạc trước đây.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {pastOrders.map((order) => (
                            <OrderCard
                                key={order._id}
                                order={order}
                                formatCurrency={formatCurrency}
                                formatDate={formatDate}
                                formatTime={formatTime}
                                onClick={() => navigate(`/orders/detail?order_id=${order._id}`)}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function getOrderStatusMeta(status?: string) {
    switch ((status || '').toLowerCase()) {
        case 'paid':
        case 'confirmed':
        case 'success':
        case 'completed':
            return {
                label: 'Thanh toán thành công',
                description: 'Vé đã được phát hành',
                className: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200'
            };
        case 'cancelled':
        case 'failed':
        case 'expired':
            return {
                label: 'Thanh toán thất bại',
                description: 'Không có vé được phát hành',
                className: 'bg-rose-50 text-rose-700 border-rose-100 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200'
            };
        case 'pending':
            return {
                label: 'Đang chờ thanh toán',
                description: 'Đơn chưa hoàn tất',
                className: 'bg-amber-50 text-amber-700 border-amber-100 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200'
            };
        default:
            return {
                label: 'Chưa xác định',
                description: 'Đang cập nhật trạng thái',
                className: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 border-slate-200 dark:border-white/10 dark:border-slate-500/30 dark:bg-slate-800/70 dark:text-slate-300'
            };
    }
}

function OrderCard({
    order,
    formatCurrency,
    formatDate,
    formatTime,
    onClick
}: {
    order: OrderItem;
    formatCurrency: (amount: number) => string;
    formatDate: (dateString?: string) => string;
    formatTime: (dateString?: string) => string;
    onClick?: () => void;
}) {
    const eventName = order.event_id?.name || 'Sự kiện không xác định';
    const showName = order.show_id?.name || 'Suất diễn';
    const showDate = order.show_id?.start_time || order.createdAt;
    const venueName = order.show_id?.venue_id?.name || 'Địa điểm đang cập nhật';
    const shortOrderId = order._id.substring(order._id.length - 8).toUpperCase();
    const ticketCount = order.items?.length || 0;
    const statusMeta = getOrderStatusMeta(order.status);

    return (
        <article
            onClick={onClick}
            className="group rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 p-5 shadow-none transition-all hover:border-primary/40 hover:bg-slate-50/40 cursor-pointer"
        >
            <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800/80 shrink-0 border border-slate-100 dark:border-white/10">
                    <img
                        src={order.event_id?.poster_url || `https://api.dicebear.com/7.x/initials/svg?seed=${eventName}&backgroundColor=FF4B91`}
                        alt={eventName}
                        className="w-full h-full object-cover"
                    />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0">
                            <h4 className="font-black text-base text-slate-800 dark:text-slate-100 leading-snug break-words">{eventName}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1 break-words">{showName}</p>
                        </div>

                        <div className={`w-fit px-3 py-1.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${statusMeta.className}`}>
                            {statusMeta.label}
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <InfoPill icon={<ReceiptText size={14} />} label="Mã đơn" value={`#${shortOrderId}`} />
                        <InfoPill icon={<Calendar size={14} />} label="Thời gian" value={`${formatDate(showDate)} • ${formatTime(showDate)}`} />
                        <InfoPill icon={<MapPin size={14} />} label="Địa điểm" value={venueName} className="sm:col-span-2" />
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <span className="rounded-full bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5">
                                {ticketCount > 0 ? `${ticketCount} vé` : 'Chưa có vé'}
                            </span>
                            <span className="rounded-full bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5">{statusMeta.description}</span>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3">
                            <span className="font-black text-base text-slate-900 dark:text-slate-50">{formatCurrency(order.total_price)}</span>
                            <ChevronRight size={18} className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}

function InfoPill({ icon, label, value, className = '' }: { icon: ReactNode; label: string; value: string; className?: string }) {
    return (
        <div className={`rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/80 px-3 py-2.5 ${className}`}>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                <span className="text-slate-400">{icon}</span>
                <span>{label}</span>
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 break-words leading-snug">{value}</p>
        </div>
    );
}
