import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient'; // Sử dụng axiosClient phẳng đã bật với Credentials
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from "@/components/ui/button";

export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuthStore(); // Hàm login từ Zustand Store (bản mới chỉ nhận userData)

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [customError, setCustomError] = useState('');

    // ==========================================
    // TANSTACK QUERY - MUTATION XỬ LÝ ĐĂNG NHẬP
    // ==========================================
    const loginMutation = useMutation({
        mutationFn: async (loginData: typeof formData) => {
            // Gọi qua axiosClient, Backend tự động gán cookie SessionID vào trình duyệt
            const response = await api.post('/auth/login', loginData);
            return response.data;
        },
        onSuccess: (data) => {
            const userData = data.user;

            // Cập nhật thông tin user vào Zustand Store (Cookie đã được trình duyệt tự quản lý)
            login(userData);

            alert("Đăng nhập thành công!");

            // Điều hướng chuẩn xác dựa theo Role bảo mật
            if (userData.role === 'organizer') {
                navigate('/organizer/dashboard');
            } else {
                navigate('/');
            }
        },
        onError: (err: any) => {
            // Trích xuất thông báo lỗi trả về từ tầng Backend Validation
            setCustomError(err.response?.data?.message || err.response?.data?.error || 'Đăng nhập thất bại. Vui lòng thử lại.');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setCustomError('');
        loginMutation.mutate(formData); // Kích hoạt Mutation
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-800">
                    Tickify
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Đăng nhập để quản lý sự kiện và mua vé
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                {/* CARD ĐĂNG NHẬP PHẲNG - ĐÃ GỠ TRƯỜNG SHADOW */}
                <div className="bg-white py-8 px-4 sm:rounded-lg sm:px-10 border border-gray-200">

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Địa chỉ Email
                            </label>
                            <div className="mt-1">
                                <input
                                    type="email"
                                    required
                                    disabled={loginMutation.isPending}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm disabled:opacity-60"
                                    placeholder="admin@tickify.com"
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Mật khẩu
                            </label>
                            <div className="mt-1">
                                <input
                                    type="password"
                                    required
                                    disabled={loginMutation.isPending}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm disabled:opacity-60"
                                    placeholder="••••••••"
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* HIỂN THỊ THÔNG BÁO LỖI TẬP TRUNG */}
                        {customError && (
                            <div className="text-red-500 text-sm font-medium text-center bg-red-50 py-2 rounded border border-red-100">
                                {customError}
                            </div>
                        )}

                        <div>
                            <Button
                                type="submit"
                                disabled={loginMutation.isPending}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50"
                            >
                                {loginMutation.isPending ? "Đang xác thực..." : "Đăng nhập"}
                            </Button>
                        </div>
                    </form>

                    <div className="mt-6 text-center">
                        <span className="text-sm text-gray-500">Chưa có tài khoản? </span>
                        <a href="#" className="text-sm font-medium text-primary hover:opacity-80">
                            Đăng ký ngay
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}