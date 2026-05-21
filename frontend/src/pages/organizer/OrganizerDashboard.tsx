import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, DollarSign, Radio, CalendarDays, BarChart3, LayoutDashboard } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

export default function OrganizerDashboard() {
    const navigate = useNavigate();
    const location = useLocation();

    // 1. State lưu dữ liệu tĩnh (Đã bỏ users và pending events)
    const [stats, setStats] = useState({
        totalActiveEvents: 0,
        totalSystemRevenue: 0
    });

    // 2. State lưu dữ liệu thời gian thực
    const [liveData, setLiveData] = useState({
        activeUsers: 0,
        ticketsSoldLastMinute: 0,
        status: 'Đang kết nối...'
    });

    useEffect(() => {
        // ---- PHẦN 1: GỌI API REST LẤY DỮ LIỆU TỔNG QUAN ----
        const fetchDashboardData = async () => {
            try {
                const res = await axios.get('http://localhost:3000/api/admin/dashboard');
                if (res.data && res.data.data) {
                    setStats(res.data.data);
                }
            } catch (error) {
                console.error("Lỗi lấy dữ liệu dashboard:", error);
            }
        };
        fetchDashboardData();

        // ---- PHẦN 2: KẾT NỐI SSE (SERVER-SENT EVENTS) LẤY DATA TỪ REDIS ----
        const showIdToTrack = "SHOW_123";
        const eventSource = new EventSource(`http://localhost:3000/api/admin/sse/dashboard/${showIdToTrack}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setLiveData({
                    activeUsers: data.active_viewers || 0,
                    ticketsSoldLastMinute: data.tickets_sold || 0,
                    status: 'Live 🔴'
                });
            } catch (error) {
                console.error("Lỗi parse SSE data", error);
            }
        };

        eventSource.onerror = () => {
            setLiveData(prev => ({ ...prev, status: 'Mất kết nối ⚪' }));
        };

        return () => {
            eventSource.close();
        };
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    // Cấu hình menu cho Side Panel
    const menuItems = [
        { title: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/organizer/dashboard' },
        { title: 'Sự kiện của tôi', icon: <CalendarDays size={20} />, path: '/organizer/events' },
        { title: 'Doanh thu', icon: <BarChart3 size={20} />, path: '/organizer/revenue' }, // Bạn có thể tạo route này sau
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Tổng quan hoạt động</h1>
                    <p className="text-slate-500 mt-1 font-medium">Theo dõi hiệu suất và doanh thu sự kiện của bạn</p>
                </div>
                <div className="flex items-center gap-2 bg-pink-50 px-4 py-2 rounded-full border border-pink-100 shadow-sm">
                    <Radio size={16} className={liveData.status.includes('Live') ? "text-pink-600 animate-pulse" : "text-slate-400"} />
                    <span className="text-sm font-bold text-pink-600">{liveData.status}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Doanh thu của tôi</CardTitle>
                        <div className="p-2 bg-emerald-50 rounded-lg"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-800">{formatCurrency(stats.totalSystemRevenue)}</div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Sự kiện Đang chạy</CardTitle>
                        <div className="p-2 bg-blue-50 rounded-lg"><Activity className="h-5 w-5 text-blue-600" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-800">{stats.totalActiveEvents}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="pt-6">
                <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-3 mb-6">Live Monitor (Show ID: 123)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-slate-800 text-white border-none shadow-lg">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-300">Người dùng đang truy cập</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-5xl font-mono font-bold tracking-tight">{liveData.activeUsers}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-white shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-pink-600">Vé bán được / Phút</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-5xl font-mono font-bold tracking-tight text-pink-600">+{liveData.ticketsSoldLastMinute}</div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}