import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useQuery, useMutation } from '@tanstack/react-query';
// Đảm bảo đường dẫn này khớp với project của bạn
import { api } from '../../lib/axiosClient';



type RoomPhase = 'LOADING' | 'COUNTDOWN' | 'IN_QUEUE' | 'REDIRECTING' | 'ERROR';

export const WaitingRoomPage = () => {
    const { showId } = useParams<{ showId: string }>();
    const navigate = useNavigate();

    const [phase, setPhase] = useState<RoomPhase>('LOADING');
    const [errorMessage, setErrorMessage] = useState('');

    const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
    const [currentPosition, setCurrentPosition] = useState<number>(0);
    const [initialPosition, setInitialPosition] = useState<number>(0);
    const [estimatedWait, setEstimatedWait] = useState<string>('Đang tính toán...');

    const countdownIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);    // =========================================================================
    // 1. MUTATION: XIN VÀO PHÒNG CHỜ
    // =========================================================================
    const joinMutation = useMutation({
        mutationFn: async () => {
            // axiosClient đã tự gán baseURL từ biến VITE_API_URL và đính kèm Token (nếu có cấu hình)
            const response = await api.post(`/waiting-room/${showId}/join`);
            return response.data;
        },
        onSuccess: (data) => {
            // Trạng thái 200: Vào hàng đợi thành công
            setCurrentPosition(data.position);
            setInitialPosition(data.position);
            setPhase('IN_QUEUE');
        },
        onError: (error: any) => {
            // Axios tự động quăng lỗi nếu status code là 4xx, 5xx
            const status = error.response?.status;
            const data = error.response?.data;

            if (status === 403 && data?.time_remaining_ms) {
                // Chưa tới giờ -> Chuyển sang màn hình đếm ngược
                setTimeLeftMs(data.time_remaining_ms);
                setPhase('COUNTDOWN');
            } else {
                setPhase('ERROR');
                setErrorMessage(data?.error || data?.message || "Không thể tham gia phòng chờ");
            }
        }
    });

    // =========================================================================
    // 2. QUERY: POLLING KIỂM TRA LƯỢT (Chỉ chạy khi đang IN_QUEUE)
    // =========================================================================
    const { data: statusData } = useQuery({
        queryKey: ['waitingRoomStatus', showId],
        queryFn: async () => {
            const response = await api.get(`/waiting-room/${showId}/status`);
            return response.data;
        },
        // Chỉ kích hoạt query này khi user đã vào hàng đợi
        enabled: phase === 'IN_QUEUE',
        // Tự động gọi lại sau mỗi 5 giây, dừng lại ngay khi tới lượt
        refetchInterval: (query) => {
            return query.state.data?.status === 'WAITING' ? 5000 : false;
        }
    });

    // =========================================================================
    // 3. EFFECTS & LOGIC
    // =========================================================================

    // Khởi chạy việc xin vào phòng chờ ngay khi component mount
    useEffect(() => {
        joinMutation.mutate();
        return () => {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        };
    }, [showId]);

    // Lắng nghe dữ liệu Polling trả về
    useEffect(() => {
        if (!statusData) return;

        if (statusData.status === 'YOUR_TURN') {
            setPhase('REDIRECTING');
            localStorage.setItem(`checkoutToken_${showId}`, statusData.checkoutToken);
            setTimeout(() => {
                navigate(`/shows/${showId}/booking`);
            }, 1500);
        } else if (statusData.status === 'WAITING') {
            setCurrentPosition(statusData.position);
            if (statusData.estimatedWaitTime) setEstimatedWait(statusData.estimatedWaitTime);
        }
    }, [statusData, navigate, showId]);

    // Xử lý đếm ngược (Vẫn dùng setInterval local vì đây là UI tick, không gọi API)
    useEffect(() => {
        if (phase === 'COUNTDOWN' && timeLeftMs > 0) {
            countdownIntervalRef.current = setInterval(() => {
                setTimeLeftMs((prev) => {
                    if (prev <= 1000) {
                        clearInterval(countdownIntervalRef.current!);
                        joinMutation.mutate(); // Hết giờ tự động xin vào hàng đợi
                        return 0;
                    }
                    return prev - 1000;
                });
            }, 1000);
        }
        return () => {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        };
    }, [phase, timeLeftMs]);

    // Format thời gian đếm ngược
    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
        return `${minutes} phút ${seconds} giây`;
    };

    const progressPercent = initialPosition > 0
        ? Math.max(5, 100 - (currentPosition / initialPosition) * 100)
        : 5;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 text-center border border-slate-100">

                {phase === 'LOADING' && (
                    <div className="flex flex-col items-center animate-pulse">
                        <div className="w-16 h-16 border-4 border-slate-200 border-t-pink-500 rounded-full animate-spin mb-4"></div>
                        <h2 className="text-xl font-bold text-slate-800">Đang kết nối hệ thống...</h2>
                    </div>
                )}

                {phase === 'COUNTDOWN' && (
                    <div className="flex flex-col items-center">
                        <div className="bg-slate-100 p-4 rounded-full mb-6">
                            <span className="text-4xl">⏳</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 mb-2">Phòng chờ sắp mở</h2>
                        <p className="text-slate-500 mb-6">Hệ thống sẽ tự động đưa bạn vào hàng đợi khi đồng hồ điểm 0.</p>
                        <div className="text-5xl font-mono font-bold text-pink-600 bg-pink-50 py-4 px-8 rounded-xl border border-pink-100 shadow-inner">
                            {formatTime(timeLeftMs)}
                        </div>
                    </div>
                )}

                {phase === 'IN_QUEUE' && (
                    <div className="flex flex-col items-center">
                        <h2 className="text-2xl font-black text-slate-800 mb-2">Bạn đang trong hàng đợi</h2>
                        <p className="text-sm text-slate-500 mb-8 px-4">
                            Vui lòng không tải lại trang. Hệ thống sẽ tự động chuyển hướng khi đến lượt bạn.
                        </p>

                        <div className="w-full bg-slate-100 h-4 rounded-full mb-4 overflow-hidden shadow-inner">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-1000 ease-out rounded-full"
                                style={{ width: `${progressPercent}%` }}
                            ></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full mb-6">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Số thứ tự của bạn</p>
                                <p className="text-3xl font-black text-slate-800">{currentPosition}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Thời gian chờ</p>
                                <p className="text-lg font-bold text-slate-700 mt-2">{estimatedWait}</p>
                            </div>
                        </div>
                    </div>
                )}

                {phase === 'REDIRECTING' && (
                    <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                            <span className="text-4xl"></span>
                        </div>
                        <h2 className="text-2xl font-black text-emerald-600 mb-2">Đã đến lượt bạn!</h2>
                        <p className="text-slate-500">Đang đưa bạn đến sơ đồ ghế...</p>
                    </div>
                )}

                {phase === 'ERROR' && (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-500 text-3xl font-bold">!</div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Đã có lỗi xảy ra</h2>
                        <p className="text-slate-500 mb-6">{errorMessage}</p>
                        <button
                            onClick={() => joinMutation.mutate()}
                            className="bg-slate-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-700 transition-colors w-full"
                        >
                            Thử lại
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};