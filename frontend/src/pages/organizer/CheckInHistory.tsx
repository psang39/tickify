import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { api } from '@/lib/axiosClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const resultLabel: Record<string, string> = {
    SUCCESS: 'Thành công',
    DUPLICATE: 'Trùng vé',
    INVALID: 'Không hợp lệ',
    EXPIRED: 'QR hết hạn',
    NOT_FOUND: 'Không tìm thấy',
    CONFLICT: 'Xung đột',
    ERROR: 'Lỗi',
};

const resultClass: Record<string, string> = {
    SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    DUPLICATE: 'bg-amber-50 text-amber-700 border-amber-100',
    INVALID: 'bg-rose-50 text-rose-700 border-rose-100',
    EXPIRED: 'bg-orange-50 text-orange-700 border-orange-100',
    NOT_FOUND: 'bg-slate-100 dark:bg-slate-800/80 text-slate-200 dark:text-slate-200 border-white/10 dark:border-white/10',
    CONFLICT: 'bg-purple-50 text-purple-700 border-purple-100',
    ERROR: 'bg-rose-50 text-rose-700 border-rose-100',
};

const formatDateTime = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '-';

export default function CheckInHistory() {
    const [page, setPage] = useState(1);
    const [result, setResult] = useState('');

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['organizer-check-in-history', page, result],
        queryFn: async () => {
            const res = await api.get('/organizer/check-ins', { params: { page, limit: 15, ...(result ? { result } : {}) } });
            return res.data;
        },
    });

    const logs = data?.docs || [];
    const totalPages = data?.totalPages || 1;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-50 dark:text-slate-50">Lịch sử check-in</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        Ghi nhận các lượt quét vé online/offline, gồm cả trường hợp trùng vé, QR hết hạn hoặc xung đột đồng bộ.
                    </p>
                </div>
                <div className="flex gap-2">
                    <select
                        value={result}
                        onChange={(e) => { setResult(e.target.value); setPage(1); }}
                        className="border border-white/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900/90 focus:outline-primary"
                    >
                        <option value="">Tất cả kết quả</option>
                        {Object.entries(resultLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <Button variant="outline" onClick={() => refetch()} className="gap-2"><RefreshCw size={16} /> Tải lại</Button>
                </div>
            </div>

            <Card className="border-white/10 dark:border-white/10 rounded-2xl shadow-none overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/10">
                    <CardTitle className="text-base font-bold text-slate-100 dark:text-slate-100 flex items-center gap-2"><Search size={18} /> Nhật ký quét vé</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] text-sm">
                            <thead className="bg-slate-950/70 dark:bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/10">
                                <tr>
                                    <th className="text-left px-6 py-4">Thời gian quét</th>
                                    <th className="text-left px-6 py-4">Show</th>
                                    <th className="text-left px-6 py-4">Nhân viên</th>
                                    <th className="text-left px-6 py-4">Ghế / Hạng vé</th>
                                    <th className="text-left px-6 py-4">Chế độ</th>
                                    <th className="text-left px-6 py-4">Kết quả</th>
                                    <th className="text-left px-6 py-4">Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                                {isLoading ? (
                                    <tr><td colSpan={7} className="py-10 text-center text-slate-400">Đang tải lịch sử...</td></tr>
                                ) : isError ? (
                                    <tr><td colSpan={7} className="py-10 text-center text-rose-600 font-semibold">Không thể tải lịch sử check-in.</td></tr>
                                ) : logs.length === 0 ? (
                                    <tr><td colSpan={7} className="py-10 text-center text-slate-400">Chưa có dữ liệu check-in.</td></tr>
                                ) : logs.map((log: any) => (
                                    <tr key={log._id} className="hover:bg-slate-950/70/70">
                                        <td className="px-6 py-4 font-medium text-slate-200 dark:text-slate-200">{formatDateTime(log.scanned_at)}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-100 dark:text-slate-100">{log.show_id?.name || 'Không xác định'}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{log.event_id?.name || ''}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-200 dark:text-slate-200">{log.staff_id ? `${log.staff_id.first_name || ''} ${log.staff_id.last_name || ''}` : 'N/A'}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{log.staff_id?.email || ''}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {log.seat_id ? (log.seat_id.seat_number || `${log.seat_id.row || ''}${log.seat_id.col_index || ''}`) : '-'}
                                            <div className="text-xs text-slate-400">{log.ticket_type_id?.name || ''}</div>
                                        </td>
                                        <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-200 dark:text-slate-200 text-xs font-bold">{log.mode}</span></td>
                                        <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${resultClass[log.result] || resultClass.ERROR}`}>{resultLabel[log.result] || log.result}</span></td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-[260px] truncate" title={log.note}>{log.note || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-2 p-4 border-t border-slate-100 dark:border-white/10">
                        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>Trước</Button>
                        <div className="px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400">Trang {page} / {totalPages}</div>
                        <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>Sau</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
