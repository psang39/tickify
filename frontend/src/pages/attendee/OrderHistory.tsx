import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { api } from '@/lib/axiosClient';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { ErrorModal } from '@/components/shared/ErrorModal';
import { Calendar, MapPin, DollarSign, MoreVertical } from 'lucide-react';

interface OrderItem {
    _id: string;
    total_price: number;
    event_id: { _id: string; name: string; poster_url?: string };
    show_id: {
        _id: string;
        name: string;
        start_time?: string;
        venue_id?: { name: string }
    };
    createdAt: string;
}

export default function OrderHistoryPage() {
    const navigate = useNavigate();
    const { userData } = useOutletContext<{ userData: any }>();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Gọi API lấy danh sách đơn đặt vé cá nhân của Attendee
    const { data: orderData, isLoading, isError } = useQuery({
        queryKey: ['myOrders'],
        queryFn: async () => {
            const response = await api.get('/orders');
            return response.data?.data || response.data;
        }
    });

    useEffect(() => {
        if (isError) {
            setErrorMessage("Đã xảy ra lỗi khi tải danh sách lịch sử đặt vé. Vui lòng thử lại sau.");
        }
    }, [isError]);

    const orders: OrderItem[] = orderData?.orders || [];
    console.log("Danh sách Đơn hàng sau khi giải nén:", orders);

    // Phân loại mốc thời gian sự kiện dựa vào thời gian thực thi của Đêm nhạc (Show)
    const { activeOrders, pastOrders } = useMemo(() => {
        const now = new Date();
        const active: OrderItem[] = [];
        const past: OrderItem[] = [];

        orders.forEach(order => {
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
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return "Chưa cập nhật ngày";
        return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateString));
    };

    return (
        <div className="w-full max-w-4xl animate-in fade-in duration-300">
            <LoadingOverlay isVisible={isLoading} />
            <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />

            <header className="mb-10">
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Xin chào {userData?.first_name || 'bạn'},</h1>
                <p className="text-slate-500 text-sm">Dưới đây là toàn bộ lịch sử đơn đặt vé và sơ đồ quản lý chỗ ngồi cá nhân của bạn.</p>
            </header>

            {/* SỰ KIỆN SẮP DIỄN RA */}
            <section className="mb-12">
                <h3 className="text-base font-bold text-primary uppercase tracking-wider mb-4">Sự kiện sắp diễn ra</h3>
                {activeOrders.length === 0 ? (
                    <p className="text-slate-400 text-sm italic py-6 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50">
                        Bạn hiện không có lịch trình sự kiện âm nhạc nào sắp diễn ra.
                    </p>
                ) : (
                    <div className="space-y-3" >
                        {activeOrders.map(order => (
                            <OrderRow key={order._id} order={order} formatCurrency={formatCurrency} formatDate={formatDate} onClick={() => navigate(`/orders/detail?order_id=${order._id}`)} />
                        ))}
                    </div>
                )}
            </section>

            {/* SỰ KIỆN ĐÃ QUA */}
            <section>
                <h3 className="text-base font-bold text-slate-400 uppercase tracking-wider mb-4">Sự kiện đã tham gia</h3>
                {pastOrders.length === 0 ? (
                    <p className="text-slate-400 text-sm italic py-6 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50">
                        Bạn chưa có lịch sử tham gia các đêm nhạc trước đây.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {pastOrders.map(order => (
                            <OrderRow key={order._id} order={order} formatCurrency={formatCurrency} formatDate={formatDate} onClick={() => navigate(`/orders/detail?order_id=${order._id}`)} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function OrderRow({ order, formatCurrency, formatDate, onClick }: { order: OrderItem, formatCurrency: Function, formatDate: Function, onClick?: () => void }) {
    const eventName = order.event_id?.name || 'Sự kiện không xác định';
    const showDate = order.show_id?.start_time || order.createdAt;

    // Đọc trường dữ liệu đã qua xử lý Deep Populate lồng nhau từ phía Backend
    const venueName = order.show_id?.venue_id?.name || 'Địa điểm đang cập nhật';
    const shortOrderId = order._id.substring(order._id.length - 8).toUpperCase();

    return (
        <div onClick={onClick}
            className="flex flex-col lg:flex-row items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-primary/40 hover:bg-slate-50/30 transition-all gap-4 shadow-none ">
            {/* Ảnh đại diện & Tên sự kiện */}
            <div className="flex items-center gap-4 w-full lg:w-[240px] shrink-0">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                    <img
                        src={order.event_id?.poster_url || `https://api.dicebear.com/7.x/initials/svg?seed=${eventName}&backgroundColor=FF4B91`}
                        alt={eventName}
                        className="w-full h-full object-cover"
                    />
                </div>
                <span className="font-bold text-sm text-slate-800 line-clamp-1">{eventName}</span>
            </div>

            {/* Mã ID giao dịch */}
            <div className="w-full lg:w-[130px] text-xs font-semibold text-slate-400 shrink-0">
                Mã đơn: #{shortOrderId}
            </div>

            {/* Thời gian tổ chức */}
            <div className="w-full lg:w-[160px] flex items-center gap-2 text-xs font-medium text-slate-500 shrink-0">
                <Calendar size={14} className="text-slate-400 shrink-0" />
                <span>{formatDate(showDate)}</span>
            </div>

            {/* Tên địa điểm (Deep Populated) */}
            <div className="w-full lg:flex-1 flex items-center gap-2 text-xs font-medium text-slate-500 line-clamp-1">
                <MapPin size={14} className="text-slate-400 shrink-0" />
                <span>{venueName}</span>
            </div>

            {/* Thành tiền khối & Tùy chọn */}
            <div className="w-full lg:w-auto flex items-center justify-between lg:justify-end gap-5 shrink-0">
                <div className="flex items-center gap-1 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200">
                    <DollarSign size={13} className="text-slate-400" />
                    <span className="font-bold text-sm text-slate-800">{formatCurrency(order.total_price)}</span>
                </div>

                <button type="button" className="text-slate-400 hover:text-primary transition-colors p-1">
                    <MoreVertical size={18} />
                </button>
            </div>
        </div>
    );
}