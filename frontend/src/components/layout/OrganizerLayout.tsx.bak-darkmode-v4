import { Outlet } from 'react-router-dom';
import OrganizerSidebar from './OrganizerSidebar';

export default function OrganizerLayout() {
    return (
        <div className="flex min-h-screen bg-slate-50 text-foreground font-sans w-full">
            <OrganizerSidebar />

            <main className="flex-1 p-8 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
}