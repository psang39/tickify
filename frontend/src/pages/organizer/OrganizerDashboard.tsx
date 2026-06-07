import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, QrCode, Ticket, Users, AlertTriangle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { api } from '@/lib/axiosClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
const formatDateTime = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '-';

const CHART_COLORS = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

const resultLabel: Record<string, string> = {
    SUCCESS: 'Thành công',
    DUPLICATE: 'Trùng vé',
    INVALID: 'Không hợp lệ',
    EXPIRED: 'QR hết hạn',
    NOT_FOUND: 'Không tìm thấy',
    CONFLICT: 'Xung đột',
    ERROR: 'Lỗi',
};

function MetricCard({ title, value, icon, hint }: { title: string; value: string | number; icon: ReactNode; hint?: string }) {
    return (
        <Card className="border-slate-200 dark:border-white/10 rounded-2xl shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</CardTitle>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-primary">{icon}</div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</div>
                {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
            </CardContent>
        </Card>
    );
}

export default function OrganizerDashboard() {
    const [showId, setShowId] = useState('');

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['organizer-analytics-dashboard', showId],
        queryFn: async () => {
            const res = await api.get('/organizer/dashboard', { params: showId ? { show_id: showId } : {} });
            return res.data?.data;
        },
    });

    const overview = data?.overview || {};
    const showOptions = data?.showOptions || [];
    const revenueByShow = data?.revenueByShow || [];
    const ticketTypeBreakdown = data?.ticketTypeBreakdown || [];
    const recentCheckIns = data?.recentCheckIns || [];


    const checkInChartData = useMemo(() => Object.entries((data?.checkIns || {}) as Record<string, number>)
        .filter(([, count]) => Number(count) > 0)
        .map(([name, value]) => ({ name: resultLabel[name] || name, value })), [data]);

    if (isLoading) {
        return <div className="min-h-[50vh] flex items-center justify-center font-medium text-slate-500 dark:text-slate-400 animate-pulse">Đang tải dashboard thống kê...</div>;
    }

    if (isError) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-center">
                <p className="font-bold text-rose-600">Không thể tải dữ liệu dashboard.</p>
                <Button onClick={() => refetch()} variant="outline">Thử lại</Button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Dashboard thống kê event/show</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        Theo dõi doanh thu, số vé bán ra, tỷ lệ check-in và tình trạng vận hành theo từng show.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={showId}
                        onChange={(e) => setShowId(e.target.value)}
                        className="min-w-[260px] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900/90 focus:outline-primary"
                    >
                        <option value="">Tất cả show</option>
                        {showOptions.map((show: any) => (
                            <option key={show._id} value={show._id}>{show.name}</option>
                        ))}
                    </select>
                    <Button variant="outline" onClick={() => setShowId('')}>Xóa lọc</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard title="Doanh thu xác nhận" value={formatCurrency(overview.totalRevenue)} icon={<DollarSign size={20} />} hint={`${overview.totalOrders || 0} đơn hàng đã xác nhận`} />
                <MetricCard title="Vé đã phát hành" value={overview.totalTickets || 0} icon={<Ticket size={20} />} hint={`${overview.validTickets || 0} còn hiệu lực, ${overview.usedTickets || 0} đã check-in`} />
                <MetricCard title="Tỷ lệ check-in" value={`${overview.checkInRate || 0}%`} icon={<QrCode size={20} />} hint="Tính trên tổng vé đã phát hành" />
                <MetricCard title="Nhân viên scanner" value={overview.totalStaffs || 0} icon={<Users size={20} />} hint={`${overview.totalShows || 0} show đang quản lý`} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="xl:col-span-2 border-slate-200 dark:border-white/10 rounded-2xl shadow-none">
                    <CardHeader>
                        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Doanh thu theo show</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[340px]">
                        {revenueByShow.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-sm text-slate-400">Chưa có dữ liệu doanh thu.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueByShow} margin={{ top: 10, right: 20, bottom: 60, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.22)" />
                                    <XAxis dataKey="show_name" angle={-20} textAnchor="end" interval={0} height={80} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                    <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000000)}tr`} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                    <Tooltip
                                        formatter={(value: any) => formatCurrency(Number(value))}
                                        contentStyle={{ borderRadius: 12, borderColor: 'rgba(148, 163, 184, 0.25)' }}
                                    />
                                    <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                                        {revenueByShow.map((item: any, index: number) => (
                                            <Cell key={`revenue-${item.show_id || item.show_name || index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-white/10 rounded-2xl shadow-none">
                    <CardHeader>
                        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Kết quả check-in</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[340px]">
                        {checkInChartData.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-sm text-slate-400">Chưa có lượt check-in nào.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie dataKey="value" nameKey="name" data={checkInChartData} outerRadius={105} label>
                                        {checkInChartData.map((item, index) => (
                                            <Cell key={`checkin-${item.name}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: 'rgba(148, 163, 184, 0.25)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="border-slate-200 dark:border-white/10 rounded-2xl shadow-none">
                    <CardHeader>
                        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Cơ cấu vé theo hạng vé</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase text-slate-400 border-b">
                                    <tr>
                                        <th className="text-left py-3">Hạng vé</th>
                                        <th className="text-right py-3">Số vé</th>
                                        <th className="text-right py-3">Doanh thu ước tính</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                                    {ticketTypeBreakdown.length === 0 ? (
                                        <tr><td colSpan={3} className="py-8 text-center text-slate-400">Chưa có dữ liệu vé.</td></tr>
                                    ) : ticketTypeBreakdown.map((item: any) => (
                                        <tr key={item.ticket_type}>
                                            <td className="py-3 font-semibold text-slate-700 dark:text-slate-200">{item.ticket_type}</td>
                                            <td className="py-3 text-right">{item.tickets}</td>
                                            <td className="py-3 text-right font-medium">{formatCurrency(item.revenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-white/10 rounded-2xl shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Lịch sử check-in gần đây</CardTitle>
                        <AlertTriangle size={18} className="text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 max-h-[380px] overflow-auto pr-1">
                            {recentCheckIns.length === 0 ? (
                                <div className="py-8 text-center text-sm text-slate-400">Chưa có lịch sử check-in.</div>
                            ) : recentCheckIns.map((log: any) => (
                                <div key={log._id} className="border border-slate-100 dark:border-white/10 rounded-xl p-3 bg-slate-950/70/50">
                                    <div className="flex justify-between gap-3">
                                        <div>
                                            <div className="font-bold text-slate-800 dark:text-slate-100">{resultLabel[log.result] || log.result}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{log.show_id?.name || 'Show'} • {formatDateTime(log.scanned_at)}</div>
                                        </div>
                                        <span className="text-[11px] px-2 py-1 rounded-full bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 h-fit font-bold text-slate-600 dark:text-slate-300">{log.mode}</span>
                                    </div>
                                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        Staff: {log.staff_id ? `${log.staff_id.first_name || ''} ${log.staff_id.last_name || ''}` : 'N/A'}
                                        {log.seat_id && <> • Ghế: {log.seat_id.seat_number || `${log.seat_id.row || ''}${log.seat_id.col_index || ''}`}</>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
