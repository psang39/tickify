import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

export default function MainLayout() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            {/* Thẻ <main> này sẽ tự động co giãn nhờ flex-1. 
        Mọi trang nội dung (như trang chủ, trang đặt vé) sẽ được "bơm" vào vị trí của <Outlet />
      */}
            <main className="flex-1 w-full bg-white">
                <Outlet />
            </main>

            <Footer />
        </div>
    );
}