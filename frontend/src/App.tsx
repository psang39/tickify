import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import AdminLayout from '@/components/layout/AdminLayout';
import AttendeeLayout from '@/components/layout/AttendeeLayout';
import MainLayout from '@/components/layout/MainLayout';
import OrganizerLayout from '@/components/layout/OrganizerLayout';
import { useAuthStore } from '@/store/useAuthStore';
import { FeedbackModalHost } from '@/components/shared/FeedbackModalHost';

import './App.css';

const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const ManageUsersPage = lazy(() => import('@/pages/admin/ManageUsersPage'));
const LoginPage = lazy(() => import('@/pages/attendee/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/attendee/RegisterPage'));
const HomePage = lazy(() => import('@/pages/attendee/HomePage'));
const EventDetailPage = lazy(() => import('@/pages/attendee/EventDetailPage'));
const MockGatewayPage = lazy(() => import('@/pages/attendee/MockGatewayPage'));
const OrderDetailPage = lazy(() => import('@/pages/attendee/OrderDetailPage'));
const OrderHistory = lazy(() => import('@/pages/attendee/OrderHistory'));
const ProfilePage = lazy(() => import('@/pages/attendee/ProfilePage'));
const TicketBookingPage = lazy(() => import('@/pages/attendee/TicketBookingPage'));
const TicketDetailPage = lazy(() => import('@/pages/attendee/TicketDetailPage'));
const WaitingRoomPage = lazy(() => import('@/pages/attendee/WaitingRoomPage').then(module => ({ default: module.WaitingRoomPage })));
const CreateEvent = lazy(() => import('@/pages/organizer/CreateEvent'));
const EventDetail = lazy(() => import('@/pages/organizer/EventDetail'));
const EventManagement = lazy(() => import('@/pages/organizer/EventManagement'));
const OrganizerDashboard = lazy(() => import('@/pages/organizer/OrganizerDashboard'));
const OrganizerStaff = lazy(() => import('@/pages/organizer/OrganizerStaff'));
const CheckInHistory = lazy(() => import('@/pages/organizer/CheckInHistory'));
const ShowDetail = lazy(() => import('@/pages/organizer/ShowDetail'));
const PaymentResultPage = lazy(() => import('@/pages/attendee/PaymentResultPage'));
const SearchPage = lazy(() => import('@/pages/attendee/SearchPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const ATTENDEE_ROLES = ['attendee', 'organizer', 'admin', 'Attendee', 'Organizer', 'Admin'];
const ORGANIZER_ROLES = ['Organizer', 'Admin', 'organizer', 'admin'];
const ADMIN_ROLES = ['admin', 'Admin'];

const PageFallback = () => (
  <div className="min-h-[55vh] bg-white px-6 py-10">
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="h-6 w-48 animate-pulse rounded-full bg-slate-200" />
      <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  </div>
);

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FeedbackModalHost />
        <Suspense fallback={<PageFallback />}>
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

              <Route element={<ProtectedRoute allowedRoles={ORGANIZER_ROLES} requireVerifiedOrganizer />}>
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
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
