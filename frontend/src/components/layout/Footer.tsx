import React from 'react';
import { Disc, Play, Apple } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="w-full bg-[#27272A] text-white py-16 px-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-6 mb-12">
                    <div className="lg:col-span-2 space-y-6">
                        <div>
                            <h3 className="font-bold text-xl mb-2">Let's keep in touch</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Stay updated with Tickify's latest<br />news and exclusive offers!
                            </p>
                        </div>

                        <div className="relative max-w-sm">
                            <input
                                type="email"
                                placeholder="Enter your email address"
                                className="w-full rounded-full py-3.5 px-5 text-gray-900 outline-none text-sm pr-36"
                            />
                            <button className="absolute right-1 top-1 bottom-1 bg-[#FF0082] hover:bg-pink-700 text-white font-bold rounded-full px-6 text-sm transition-colors shadow-md">
                                Subscribe Now
                            </button>
                        </div>

                        <p className="text-[11px] text-gray-500">
                            By subscribing, you agree to our terms & conditions & Privacy Policy
                        </p>

                        <div className="flex gap-3 pt-2">
                            <button className="bg-white text-black flex items-center gap-2 rounded-full px-4 py-2 hover:bg-gray-100 transition-colors">
                                <Play size={20} className="text-[#FF0082]" />
                                <div className="text-left flex flex-col">
                                    <span className="text-[10px] leading-none text-gray-600">Download on the</span>
                                    <span className="text-xs font-bold leading-tight">Google Play</span>
                                </div>
                            </button>
                            <button className="bg-white text-black flex items-center gap-2 rounded-full px-4 py-2 hover:bg-gray-100 transition-colors">
                                <Apple size={20} className="text-[#FF0082]" />
                                <div className="text-left flex flex-col">
                                    <span className="text-[10px] leading-none text-gray-600">Download on the</span>
                                    <span className="text-xs font-bold leading-tight">App Store</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-lg mb-6 text-gray-100">Tickify Hub</h4>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li><a href="#" className="hover:text-white transition-colors">About us</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Press</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Event organizers</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Getting there</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Privacy policy</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Terms & conditions</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-lg mb-6 text-gray-100">Looking For Help</h4>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li><a href="#" className="hover:text-white transition-colors">FAQs</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Customer Service</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-lg mb-6 text-gray-100">Looking For More</h4>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li><a href="#" className="hover:text-white transition-colors">Cancelled Concerts</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Cancellation Insurance</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Rescheduled Events</a></li>
                        </ul>
                    </div>

                    {/* Cột 5: Social Icons */}
                    {/* <div className="flex flex-col items-end gap-6 justify-start">
                        <a href="#" className="text-gray-400 hover:text-white transition-colors"><Instagram size={24} /></a>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors"><Youtube size={24} /></a>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors"><Twitter size={24} /></a>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors"><Disc size={24} /></a>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors"><Facebook size={24} /></a>
                    </div> */}

                </div>

                <div className="pt-8 border-t border-gray-700/50 flex flex-col md:flex-row items-center justify-center gap-2 text-sm text-gray-400">
                    <span className="border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">C</span>
                    <span>Tickify All Rights Reserved</span>
                </div>

            </div>
        </footer>
    );
}