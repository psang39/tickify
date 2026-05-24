import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';

export default function OrganizerDashboard() {
    // 1. FETCH DỮ LIỆU VĨ MÔ QUA TANSTACK QUERY (Đã sửa endpoint sang vùng quản lý của organizer)
    const { data: dashboardData, isLoading, isError } = useQuery({
        queryKey: ['organizer-macro-dashboard'],
        queryFn: async () => {
            const res = await api.get('/organizer/dashboard');
            return res.data?.data || res.data;
        }
    });

    const totalActiveEvents = dashboardData?.totalActiveEvents || 0;
    const totalSystemRevenue = dashboardData?.totalSystemRevenue || 0;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    if (isLoading) return <div className="min-h-[50vh] flex items-center justify-center font-medium text-slate-500 animate-pulse">Đang tải dữ liệu tổng quan...</div>;
    if (isError) return <div className="min-h-[50vh] flex items-center justify-center font-bold text-rose-500">Không thể tải dữ liệu dashboard.</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-8 p-4">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Tổng quan hoạt động</h1>
                    <p className="text-slate-500 mt-1 font-medium">Theo dõi hiệu suất và doanh thu sự kiện của bạn</p>
                </div>
            </div>

            {/* Các thẻ báo cáo vĩ mô - ĐÃ XÓA SHADOW VÀ CHUYỂN SANG BỌC MÀU PRIMARY */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Card Doanh Thu */}
                <Card className="border-slate-200 rounded-2xl transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Doanh thu của tôi</CardTitle>
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <DollarSign className="h-5 w-5 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-800">
                            {formatCurrency(totalSystemRevenue)}
                        </div>
                    </CardContent>
                </Card>

                {/* Card Sự Kiện */}
                <Card className="border-slate-200 rounded-2xl transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Sự kiện Đang chạy</CardTitle>
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <Activity className="h-5 w-5 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-800">
                            {totalActiveEvents}
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}