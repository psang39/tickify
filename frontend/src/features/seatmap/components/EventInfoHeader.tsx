import { Ticket, Calendar, MapPin, Check } from 'lucide-react';
import { CheckoutCountdown } from './CheckoutCountdown';

interface EventInfoHeaderProps {
    showInfo: any;
    isLoadingShow: boolean;
    currentStep: number;
    showId: string;
    orderData: any;
    onBack: () => void;
}

export const EventInfoHeader = ({ showInfo, isLoadingShow, currentStep, showId, orderData }: EventInfoHeaderProps) => {
    const startDate = showInfo?.start_time ? new Date(showInfo.start_time) : null;
    const day = startDate ? startDate.getDate().toString().padStart(2, '0') : '--';

    const month = startDate ? startDate.toLocaleString('vi-VN', { month: 'short' }) : '---';
    const year = startDate ? startDate.getFullYear() : '----';

    const timeString = startDate
        ? startDate.toLocaleString('vi-VN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
        : '--:--';

    return (
        <div className="flex w-full bg-white rounded-2xl border border-slate-200 overflow-hidden mt-8 mb-6">

            <div className="bg-[#2d3092] text-white w-32 shrink-0 flex flex-col items-center justify-center py-8 gap-1">
                <span className="text-4xl font-bold">{day}</span>
                <span className="text-xl font-medium capitalize">{month}</span>
                <span className="text-xl font-medium">{year}</span>
                <div className="mt-3 w-7 h-7 bg-emerald-400 rounded-full flex items-center justify-center shadow-md">
                    <Check size={18} strokeWidth={3} className="text-[#2d3092]" />
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row justify-between items-start md:items-center p-6 lg:px-8 gap-6 bg-white">

                <div className="flex flex-col gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">
                        {isLoadingShow ? "Đang tải sự kiện..." : showInfo?.name}
                    </h1>

                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-3 text-slate-600">
                            <Ticket size={20} className="text-slate-400" />
                            <span className="font-medium text-sm">
                                Trạng thái: <span className="text-emerald-500 font-semibold">Đang mở bán</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600">
                            <Calendar size={20} className="text-slate-400" />
                            <span className="font-medium text-sm">{timeString}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600">
                            <MapPin size={20} className="text-slate-400" />
                            <span className="font-medium text-sm">{showInfo?.venue_id?.name || "Đang cập nhật địa điểm"}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-6 self-stretch justify-between">

                    {currentStep < 5 && (
                        <div className="text-right">
                            <CheckoutCountdown
                                showId={showId as string}
                                cancellationDeadline={currentStep >= 3 ? orderData?.cancellation_deadline : undefined}
                                serverNow={orderData?.server_now}
                            />
                        </div>
                    )}

                    
                </div>
            </div>
        </div>
    );
};
