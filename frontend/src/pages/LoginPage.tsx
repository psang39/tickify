import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from "@/components/ui/button";

export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuthStore(); // Lấy hàm login từ Store

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // 1. Gọi API Đăng nhập
            const response = await axios.post('http://localhost:3000/api/v1/auth/login', formData);

            // 2. Lấy token từ cục JSON Backend trả về
            const token = response.data.token;

            // 3. Giải mã token để lấy thông tin User (id, role) mà Backend đã giấu bên trong
            // const decodedToken: any = jwtDecode(token);

            // 4. Đóng gói thông tin User để cất vào Store
            const userData = response.data.user;

            // 5. Cất token và user vào localStorage + Zustand
            login(userData, token);

            alert("Đăng nhập thành công!");

            // 6. Điều hướng dựa theo Role
            if (userData.role === 'organizer') {
                navigate('/organizer/dashboard'); // Nếu là Ban tổ chức -> Vô trang quản lý
            } else {
                navigate('/'); // Nếu là Khách hàng -> Vô trang chủ mua vé
            }

        } catch (err: any) {
            // Bắt lỗi từ Backend (sai pass, không tìm thấy user...)
            setError(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-secondary">
                    Tickify
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Đăng nhập để quản lý sự kiện và mua vé
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Địa chỉ Email
                            </label>
                            <div className="mt-1">
                                <input
                                    type="email"
                                    required
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
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
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                                    placeholder="••••••••"
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Hiển thị lỗi nếu có */}
                        {error && (
                            <div className="text-red-500 text-sm font-medium text-center bg-red-50 py-2 rounded">
                                {error}
                            </div>
                        )}

                        <div>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                            >
                                {isLoading ? "Đang xử lý..." : "Đăng nhập"}
                            </Button>
                        </div>
                    </form>

                    <div className="mt-6 text-center">
                        <span className="text-sm text-gray-500">Chưa có tài khoản? </span>
                        <a href="#" className="text-sm font-medium text-primary hover:text-pink-700">
                            Đăng ký ngay
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}