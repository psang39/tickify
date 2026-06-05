import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import AdminLayout from '@/components/layout/AdminLayout';
import AttendeeLayout from '@/components/layout/AttendeeLayout';
import MainLayout from '@/components/layout/MainLayout';
import OrganizerLayout from '@/components/layout/OrganizerLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import ManageUsersPage from '@/pages/admin/ManageUsersPage';
import LoginPage from '@/pages/attendee/LoginPage';
import RegisterPage from '@/pages/attendee/RegisterPage';
import HomePage from '@/pages/attendee/HomePage';
import EventDetailPage from '@/pages/attendee/EventDetailPage';
import MockGatewayPage from '@/pages/attendee/MockGatewayPage';
import OrderDetailPage from '@/pages/attendee/OrderDetailPage';
import OrderHistory from '@/pages/attendee/OrderHistory';
import ProfilePage from '@/pages/attendee/ProfilePage';
import TicketBookingPage from '@/pages/attendee/TicketBookingPage';
import TicketDetailPage from '@/pages/attendee/TicketDetailPage';
import { WaitingRoomPage } from '@/pages/attendee/WaitingRoomPage';
import CreateEvent from '@/pages/organizer/CreateEvent';
import EventDetail from '@/pages/organizer/EventDetail';
import EventManagement from '@/pages/organizer/EventManagement';
import OrganizerDashboard from '@/pages/organizer/OrganizerDashboard';
import OrganizerStaff from '@/pages/organizer/OrganizerStaff';
import CheckInHistory from '@/pages/organizer/CheckInHistory';
import ShowDetail from '@/pages/organizer/ShowDetail';
import PaymentResultPage from '@/pages/attendee/PaymentResultPage';
import SearchPage from '@/pages/attendee/SearchPage';
import { useAuthStore } from '@/store/useAuthStore';
import { FeedbackModalHost } from '@/components/shared/FeedbackModalHost';

import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ATTENDEE_ROLES = ['attendee', 'organizer', 'admin', 'Attendee', 'Organizer', 'Admin'];
const ORGANIZER_ROLES = ['Organizer', 'Admin', 'organizer', 'admin'];
const ADMIN_ROLES = ['admin', 'Admin'];

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FeedbackModalHost />
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={ADMIN_ROLES} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<ManageUsersPage />} />
            </Route>
          </Route>

          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/events/:eventId" element={<EventDetailPage />} />

            <Route element={<ProtectedRoute allowedRoles={ATTENDEE_ROLES} />}>
              <Route element={<AttendeeLayout />}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/orders" element={<OrderHistory />} />
                <Route path="/orders/detail" element={<OrderDetailPage />} />
                <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={ORGANIZER_ROLES}
              requireVerifiedOrganizer
            />}>
              <Route element={<OrganizerLayout />}>
                <Route path="/organizer/dashboard" element={<OrganizerDashboard />} />
                <Route path="/organizer/staff" element={<OrganizerStaff />} />
                <Route path="/organizer/check-ins" element={<CheckInHistory />} />
                <Route path="/organizer/events" element={<EventManagement />} />
                <Route path="/organizer/events/create" element={<CreateEvent />} />
                <Route path="/organizer/events/:eventId" element={<EventDetail />} />
                <Route path="/organizer/events/:eventId/shows/:showId" element={<ShowDetail />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={ATTENDEE_ROLES} />}>
              <Route path="/queue/:showId" element={<WaitingRoomPage />} />
              <Route path="/shows/:showId/booking" element={<TicketBookingPage />} />
              <Route path="/mock-gateway" element={<MockGatewayPage />} />
              <Route path="/payment/result" element={<PaymentResultPage />} />
            </Route>
          </Route>

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="*" element={<div className="p-10 text-center">404 - Không tìm thấy trang</div>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
