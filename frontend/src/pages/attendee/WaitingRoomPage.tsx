import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/axiosClient';

type RoomPhase = 'LOADING' | 'COUNTDOWN' | 'WAITING_ROOM' | 'IN_QUEUE' | 'REDIRECTING' | 'ERROR';

type WaitingRoomResponse = {
    message?: string;
    status?: 'WAITING_ROOM' | 'WAITING' | 'YOUR_TURN';
    position?: number;
    estimatedWaitTime?: number;
    checkoutToken?: string;
    sale_started?: boolean;
    sale_start_in_ms?: number;
};

const formatTime = (ms: number) => {
    const safeMs = Math.max(0, ms);
    const totalSeconds = Math.floor(safeMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes} phút ${seconds} giây`;
};

export const WaitingRoomPage = () => {
    const { showId } = useParams<{ showId: string }>();
    const navigate = useNavigate();

    const [phase, setPhase] = useState<RoomPhase>('LOADING');
    const [errorMessage, setErrorMessage] = useState('');
    const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
    const [currentPosition, setCurrentPosition] = useState<number>(0);
    const [initialPosition, setInitialPosition] = useState<number>(0);
    const [estimatedWait, setEstimatedWait] = useState<string>('Đang tính toán...');

    const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const redirectToBooking = (checkoutToken?: string) => {
        setPhase('REDIRECTING');
        if (checkoutToken) {
            localStorage.setItem(`checkoutToken_${showId}`, checkoutToken);
        }

        if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = setTimeout(() => {
            navigate(`/shows/${showId}/booking`, { replace: true });
        }, 800);
    };

    const statusQuery = useQuery<WaitingRoomResponse>({
        queryKey: ['waitingRoomStatus', showId],
        queryFn: async () => {
            const response = await api.get(`/waiting-room/${showId}/status`);
            return response.data;
        },
        enabled: phase === 'WAITING_ROOM' || phase === 'IN_QUEUE',
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === 'WAITING_ROOM' || status === 'WAITING' ? 5000 : false;
        },
    });

    const joinMutation = useMutation<WaitingRoomResponse>({
        mutationFn: async () => {
            const response = await api.post(`/waiting-room/${showId}/join`);
            return response.data;
        },
        onSuccess: (data) => {
            setErrorMessage('');

            if (data.status === 'YOUR_TURN') {
                redirectToBooking(data.checkoutToken);
                return;
            }

            if (data.status === 'WAITING_ROOM' || data.sale_started === false) {
                setTimeLeftMs(data.sale_start_in_ms || 0);
                setCurrentPosition(0);
                setInitialPosition(0);
                setEstimatedWait(data.sale_start_in_ms ? `Mở bán sau ${formatTime(data.sale_start_in_ms)}` : 'Đang chờ mở bán');
                setPhase('WAITING_ROOM');
                return;
            }

            setCurrentPosition(data.position || 0);
            setInitialPosition(data.position || 0);
            setEstimatedWait('Đang tính toán...');
            setPhase('IN_QUEUE');
        },
        onError: (error: any) => {
            const status = error.response?.status;
            const data = error.response?.data;

            if (status === 403 && data?.time_remaining_ms) {
                setTimeLeftMs(data.time_remaining_ms);
                setPhase('COUNTDOWN');
            } else {
                setPhase('ERROR');
                setErrorMessage(data?.error || data?.message || 'Không thể tham gia phòng chờ');
            }
        },
    });

    useEffect(() => {
        joinMutation.mutate();
        return () => {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showId]);

    useEffect(() => {
        const statusData = statusQuery.data;
        if (!statusData) return;

        if (statusData.status === 'YOUR_TURN') {
            redirectToBooking(statusData.checkoutToken);
            return;
        }

        if (statusData.status === 'WAITING_ROOM') {
            const nextTimeLeft = statusData.sale_start_in_ms || 0;

            // Khi countdown vừa về 0, có thể request đầu tiên vẫn nhận snapshot WAITING_ROOM.
            // Không đứng yên ở màn hình phòng chờ; refetch lại để backend finalize/random sang queue.
            if (nextTimeLeft <= 0) {
                setPhase('LOADING');
                setTimeout(() => statusQuery.refetch(), 700);
                return;
            }

            setPhase('WAITING_ROOM');
            setCurrentPosition(0);
            setInitialPosition(0);
            setTimeLeftMs(nextTimeLeft);
            setEstimatedWait(`Mở bán sau ${formatTime(nextTimeLeft)}`);
            return;
        }

        if (statusData.status === 'WAITING') {
            const nextPosition = statusData.position || 0;
            setPhase('IN_QUEUE');
            setCurrentPosition(nextPosition);
            setInitialPosition((prev) => prev || nextPosition);
            setTimeLeftMs(0);

            if (statusData.estimatedWaitTime) {
                setEstimatedWait(`Khoảng ${statusData.estimatedWaitTime} phút`);
            } else {
                setEstimatedWait('Đang tính toán...');
            }
        }
    }, [statusQuery.data, showId]);

    useEffect(() => {
        if (!['COUNTDOWN', 'WAITING_ROOM'].includes(phase) || timeLeftMs <= 0) return;

        countdownIntervalRef.current = setInterval(() => {
            setTimeLeftMs((prev) => {
                if (prev <= 1000) {
                    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

                    if (phase === 'COUNTDOWN') {
                        joinMutation.mutate();
                    } else if (phase === 'WAITING_ROOM') {
                        statusQuery.refetch();
                    }

                    return 0;
                }

                return prev - 1000;
            });
        }, 1000);

        return () => {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, timeLeftMs]);

    const progressPercent = initialPosition > 0
        ? Math.max(5, 100 - (currentPosition / initialPosition) * 100)
        : 5;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80 flex flex-col items-center justify-center p-4 font-sans">
            <div className="max-w-md w-full bg-white dark:bg-slate-900/90 rounded-2xl shadow-xl overflow-hidden p-8 text-center border border-slate-100 dark:border-white/10">
                {phase === 'LOADING' && (
                    <div className="flex flex-col items-center animate-pulse">
                        <div className="w-16 h-16 border-4 border-slate-200 dark:border-white/10 border-t-pink-500 rounded-full animate-spin mb-4"></div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Đang kết nối hệ thống...</h2>
                    </div>
                )}

                {phase === 'COUNTDOWN' && (
                    <div className="flex flex-col items-center">
                        <div className="bg-slate-100 dark:bg-slate-800/80 p-4 rounded-full mb-6">
                            <span className="text-4xl"></span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Phòng chờ sắp mở</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">Hệ thống sẽ tự động đưa bạn vào phòng chờ khi đồng hồ điểm 0.</p>
                        <div className="text-5xl font-mono font-bold text-pink-600 bg-pink-50 dark:bg-pink-950/30 py-4 px-8 rounded-xl border border-pink-100 dark:border-pink-500/20 shadow-inner">
                            {formatTime(timeLeftMs)}
                        </div>
                    </div>
                )}

                {phase === 'WAITING_ROOM' && (
                    <div className="flex flex-col items-center">
                        <div className="bg-pink-50 dark:bg-pink-950/30 p-4 rounded-full mb-6">
                            <span className="text-4xl"></span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Bạn đang ở phòng chờ</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 px-4">
                            Đây chưa phải hàng đợi nên bạn chưa có số thứ tự. Khi mở bán, hệ thống sẽ random số thứ tự và chuyển bạn sang queue.
                        </p>
                        <div className="w-full rounded-2xl border border-pink-100 dark:border-pink-500/20 bg-pink-50 dark:bg-pink-950/30 p-5 mb-6">
                            <p className="text-xs text-pink-500 dark:text-pink-300 font-bold uppercase tracking-wider mb-2">Thời gian đến lúc mở bán</p>
                            <p className="text-4xl font-mono font-black text-pink-600 dark:text-pink-300">{formatTime(timeLeftMs)}</p>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Vui lòng giữ trang này mở. Hệ thống sẽ tự cập nhật khi queue bắt đầu.</p>
                    </div>
                )}

                {phase === 'IN_QUEUE' && (
                    <div className="flex flex-col items-center">
                        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Bạn đang trong hàng đợi</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 px-4">
                            Vui lòng không tải lại trang. Hệ thống sẽ tự động chuyển hướng khi đến lượt bạn.
                        </p>

                        <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-4 rounded-full mb-4 overflow-hidden shadow-inner">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-1000 ease-out rounded-full"
                                style={{ width: `${progressPercent}%` }}
                            ></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full mb-6">
                            <div className="bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-100 dark:border-white/10">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Số thứ tự của bạn</p>
                                <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{currentPosition}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-100 dark:border-white/10">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Thời gian chờ</p>
                                <p className="text-lg font-bold text-slate-700 dark:text-slate-200 mt-2">{estimatedWait}</p>
                            </div>
                        </div>
                    </div>
                )}

                {phase === 'REDIRECTING' && (
                    <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mb-6">
                            <span className="text-4xl"></span>
                        </div>
                        <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-300 mb-2">Đã đến lượt bạn!</h2>
                        <p className="text-slate-500 dark:text-slate-400">Đang đưa bạn đến sơ đồ ghế...</p>
                    </div>
                )}

                {phase === 'ERROR' && (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/40 rounded-full flex items-center justify-center mb-6 text-red-500 text-3xl font-bold">!</div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Đã có lỗi xảy ra</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">{errorMessage}</p>
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
