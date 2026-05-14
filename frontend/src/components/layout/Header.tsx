import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Phone, Ticket, ChevronDown, User } from 'lucide-react';

export default function Header() {
    return (
        <header className="w-full bg-white py-4 px-8 shadow-sm flex items-center justify-between sticky top-0 z-50">

            {/* 1. Logo (Gradient) */}
            <Link to="/" className="text-3xl font-black tracking-tight bg-gradient-to-r from-purple-700 via-pink-500 to-pink-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
                Tickify
            </Link>

            {/* 2. Thanh tìm kiếm (Search Bar) */}
            <div className="flex-1 max-w-xl mx-8 relative hidden md:block">
                <input
                    type="text"
                    placeholder="Search here"
                    className="w-full bg-gray-100/80 text-gray-700 rounded-full py-2.5 px-5 outline-none focus:bg-gray-100 focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>

            {/* 3. Navigation & Actions */}
            <div className="flex items-center gap-6">
                <Link to="/contact" className="hidden lg:flex items-center gap-2 text-gray-600 hover:text-primary font-medium transition-colors">
                    <Phone size={18} />
                    <span>Contact us</span>
                </Link>

                <Link to="/tickets" className="hidden lg:flex items-center gap-2 text-gray-600 hover:text-primary font-medium transition-colors">
                    <Ticket size={18} />
                    <span>Tickets</span>
                </Link>

                {/* Nút chọn ngôn ngữ */}
                <button className="flex items-center gap-1 border border-gray-300 rounded-full px-3 py-1.5 text-gray-700 font-medium hover:border-gray-400 transition-colors">
                    En <ChevronDown size={16} />
                </button>

                {/* Nút Profile */}
                <Link to="/profile">
                    <button className="bg-[#4C4DCC] hover:bg-[#3b3ca3] text-white flex items-center gap-2 rounded-full px-6 py-2 font-medium transition-colors shadow-sm">
                        <User size={18} />
                        <span>Profile</span>
                    </button>
                </Link>
            </div>

        </header>
    );
}