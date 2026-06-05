import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

export default function MainLayout() {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors">
            <Header />

            
            <main className="flex-1 w-full bg-background text-foreground transition-colors">
                <Outlet />
            </main>

            <Footer />
        </div>
    );
}
