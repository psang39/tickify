import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Ticket, DollarSign, Users, Radio } from 'lucide-react';
import axios from 'axios';

export default function OrganizerDashboard() {
    // 1. State lưu dữ liệu tĩnh (từ admin.controller.ts)
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalActiveEvents: 0,
        totalPendingEvents: 0,
        totalSystemRevenue: 0
    });

    // 2. State lưu dữ liệu thời gian thực (từ adminSseController.ts - Redis)
    const [liveData, setLiveData] = useState({
        activeUsers: 0,
        ticketsSoldLastMinute: 0,
        status: 'Đang kết nối...'
    });

    useEffect(() => {
        // ---- PHẦN 1: GỌI API REST LẤY DỮ LIỆU TỔNG QUAN ----
        const fetchDashboardData = async () => {
            try {
                // Lưu ý: Đảm bảo bạn đã bọc axios interceptor để gửi kèm token
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
        // Giả sử bạn đang muốn theo dõi Show có ID là "SHOW_123"
        const showIdToTrack = "SHOW_123";

        // Khởi tạo luồng kết nối liên tục với Backend
        const eventSource = new EventSource(`http://localhost:3000/api/admin/sse/dashboard/${showIdToTrack}`);

        // Lắng nghe dữ liệu đẩy về từ Redis
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setLiveData({
                    activeUsers: data.active_viewers || 0, // Tùy vào schema dữ liệu bạn push vào Redis
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

        // Dọn dẹp kết nối khi người dùng rời khỏi trang Dashboard (Rất quan trọng để tránh tràn RAM)
        return () => {
            eventSource.close();
        };
    }, []);

    // Format tiền tệ
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 bg-background min-h-screen text-foreground">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-secondary">Dashboard Quản Trị</h1>
                    <p className="text-gray-500 mt-1">Dữ liệu tổng quan và theo dõi thời gian thực</p>
                </div>

                {/* Chỉ báo trạng thái Real-time */}
                <div className="flex items-center gap-2 bg-pink-50 px-4 py-2 rounded-full border border-pink-100">
                    <Radio size={16} className={liveData.status.includes('Live') ? "text-primary animate-pulse" : "text-gray-400"} />
                    <span className="text-sm font-bold text-primary">{liveData.status}</span>
                </div>
            </div>

            {/* KHU VỰC 1: DỮ LIỆU TĨNH TỪ MONGODB */}
            <h2 className="text-xl font-bold border-b pb-2">Tổng quan Hệ thống</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Tổng doanh thu</CardTitle>
                        <DollarSign className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{formatCurrency(stats.totalSystemRevenue)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Người dùng (Users)</CardTitle>
                        <Users className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalUsers}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Sự kiện Đang chạy</CardTitle>
                        <Activity className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.totalActiveEvents}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Sự kiện Chờ duyệt</CardTitle>
                        <Ticket className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">{stats.totalPendingEvents}</div>
                    </CardContent>
                </Card>
            </div>

            {/* KHU VỰC 2: DỮ LIỆU THỜI GIAN THỰC TỪ REDIS (SSE) */}
            <h2 className="text-xl font-bold border-b pb-2 mt-10">Live Monitor (Show ID: 123)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-secondary text-white border-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium opacity-80">Người dùng đang chọn ghế</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-5xl font-mono font-bold tracking-tight">
                            {liveData.activeUsers}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-primary/20 bg-pink-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-primary">Vé bán được / Phút</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-5xl font-mono font-bold tracking-tight text-primary">
                            +{liveData.ticketsSoldLastMinute}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}