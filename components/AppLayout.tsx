import React, { useState, useCallback, useEffect } from 'react';
import type { View, ConsolidatedBooking, SpecialEvent, User, UserRole, AppNotification } from '../types';
import Header from './layout/Header';
import Footer from './layout/Footer';
import ConfirmationModal from './ui/ConfirmationModal';
import WifiModal from './ui/WifiModal';
import ViewRenderer from './ViewRenderer';
import { findRelatedBookings } from '../utils/bookingUtils';
import { useAppStore } from '../hooks/useAppStore';

interface AppLayoutProps {
    store: ReturnType<typeof useAppStore>;
    auth: {
        user: User;
        userRole: UserRole;
        currentUserName: string | null;
        handleLogout: () => void;
    };
}

const AppLayout: React.FC<AppLayoutProps> = ({ store, auth }) => {
    const {
        bookings, myPendingTasks, handleDeleteBookingKeys, handleToggleTask,
        myUnreadNotifications, handleMarkNotificationAsRead, specialEvents,
    } = store;

    const { user, userRole, handleLogout } = auth;

    // UI State
    const [view, setView] = useState<View>('agenda');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedBooking, setSelectedBooking] = useState<ConsolidatedBooking | null>(null);
    const [selectedSpecialEvent, setSelectedSpecialEvent] = useState<SpecialEvent | null>(null);
    const [bookingToPreFill, setBookingToPreFill] = useState<ConsolidatedBooking | null>(null);
    const [isWifiModalOpen, setIsWifiModalOpen] = useState(false);
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        action: 'delete' | 'edit' | null;
        booking: ConsolidatedBooking | null;
        relatedBookings: { date: string, keys: string[] }[];
    }>({ isOpen: false, action: null, booking: null, relatedBookings: [] });


    // UI Logic and Handlers that combine store actions and UI state changes
    const handleSelectBooking = (booking: ConsolidatedBooking) => {
        setSelectedBooking(booking);
        setView('detalles');
    };

    const handleSelectSpecialEvent = (event: SpecialEvent) => {
        setSelectedSpecialEvent(event);
        setView('detalles_evento');
    };

    const handleNotificationClick = useCallback((notification: AppNotification) => {
        handleMarkNotificationAsRead(notification.id);
        const event = specialEvents[notification.link.entityId];
        if (event) {
            setSelectedSpecialEvent(event as SpecialEvent);
            setView(notification.link.view);
        }
    }, [handleMarkNotificationAsRead, specialEvents, setSelectedSpecialEvent, setView]);

    const triggerDeleteProcess = useCallback(async (booking: ConsolidatedBooking) => {
        const related = findRelatedBookings(booking, bookings);
        const futureEvents = related.filter(b => b.date > booking.date);

        if (futureEvents.length > 0) {
            setModalState({ isOpen: true, action: 'delete', booking: booking, relatedBookings: related });
        } else {
            if (window.confirm('¿Está seguro de que desea eliminar esta reserva?')) {
                const success = await handleDeleteBookingKeys(booking.keys);
                if (success) {
                    setSelectedBooking(null);
                    setView('agenda');
                }
            }
        }
    }, [bookings, handleDeleteBookingKeys]);

    const triggerEditProcess = useCallback((booking: ConsolidatedBooking) => {
        const related = findRelatedBookings(booking, bookings);
        const futureEvents = related.filter(b => b.date >= booking.date);

        if (futureEvents.length > 1) {
            setModalState({ isOpen: true, action: 'edit', booking: booking, relatedBookings: related });
        } else {
            if (window.confirm('La reserva actual se eliminará para que pueda crear una nueva con los datos precargados. ¿Desea continuar?')) {
                handleDeleteBookingKeys(booking.keys).catch(err => console.error("Error en la eliminación en segundo plano:", err));
                setBookingToPreFill(booking);
                setView('plano');
            }
        }
    }, [bookings, handleDeleteBookingKeys]);

    const handleModalConfirmation = useCallback(async (choice: 'single' | 'future') => {
        const { action, booking, relatedBookings } = modalState;
        if (!action || !booking) return;

        let keysToModify: string[] = [];
        if (choice === 'single') {
            keysToModify = booking.keys;
        } else {
            const futureBookings = relatedBookings.filter(b => b.date >= booking.date);
            keysToModify = futureBookings.flatMap(b => b.keys);
        }

        const closeAndResetModal = () => setModalState({ isOpen: false, action: null, booking: null, relatedBookings: [] });
        
        const success = await handleDeleteBookingKeys(keysToModify);
        
        if(success) {
            if (action === 'delete') {
                setSelectedBooking(null);
                setView('agenda');
            } else if (action === 'edit') {
                setBookingToPreFill(booking);
                setView('plano');
            }
        }
        closeAndResetModal();

    }, [modalState, handleDeleteBookingKeys]);

    const handleModalClose = useCallback(() => {
        setModalState({ isOpen: false, action: null, booking: null, relatedBookings: [] });
    }, []);

    const onPreFillComplete = useCallback(() => {
        setBookingToPreFill(null);
    }, []);

    useEffect(() => {
        if (view === 'detalles' && !selectedBooking) {
            setView('agenda');
        }
        if (view === 'detalles_evento' && !selectedSpecialEvent) {
            setView('agenda');
        }
    }, [view, selectedBooking, selectedSpecialEvent]);

    const canEditBookings = userRole === 'ADMIN' || userRole === 'EVENTOS';
    const canEditShifts = userRole === 'ADMIN';
    const canEditSpecialEvents = userRole === 'ADMIN' || userRole === 'EVENTOS';
    const canEditServices = userRole === 'ADMIN' || userRole === 'EVENTOS' || userRole === 'TRABAJADOR';
    const canManageSponsors = userRole === 'ADMIN' || userRole === 'EVENTOS';

    return (
        <div className="min-h-screen text-gray-100 flex flex-col">
            <Header
                currentView={view}
                setView={setView}
                userEmail={user.email}
                userRole={userRole}
                onLogout={handleLogout}
                pendingTasks={myPendingTasks}
                unreadNotifications={myUnreadNotifications}
                onToggleTask={handleToggleTask}
                onNotificationClick={handleNotificationClick}
            />
            <main className="flex-grow p-4 sm:p-6 md:p-8">
                <ViewRenderer
                    view={view}
                    setView={setView}
                    store={store}
                    auth={auth}
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    selectedBooking={selectedBooking}
                    selectedSpecialEvent={selectedSpecialEvent}
                    setSelectedSpecialEvent={setSelectedSpecialEvent}
                    bookingToPreFill={bookingToPreFill}
                    onPreFillComplete={onPreFillComplete}
                    triggerDeleteProcess={triggerDeleteProcess}
                    triggerEditProcess={triggerEditProcess}
                    handleSelectBooking={handleSelectBooking}
                    handleSelectSpecialEvent={handleSelectSpecialEvent}
                    canEditBookings={canEditBookings}
                    canEditShifts={canEditShifts}
                    canEditSpecialEvents={canEditSpecialEvents}
                    canEditServices={canEditServices}
                    canManageSponsors={canManageSponsors}
                />
            </main>
            <Footer onWifiClick={() => setIsWifiModalOpen(true)} />
            <ConfirmationModal
                isOpen={modalState.isOpen}
                title={modalState.action === 'delete' ? 'Eliminar Reserva Recurrente' : 'Editar Reserva Recurrente'}
                message="Esta reserva parece ser parte de una serie. ¿Cómo desea proceder?"
                onConfirmSingle={() => handleModalConfirmation('single')}
                onConfirmFuture={() => handleModalConfirmation('future')}
                onClose={handleModalClose}
            />
            <WifiModal isOpen={isWifiModalOpen} onClose={() => setIsWifiModalOpen(false)} />
        </div>
    );
};

export default AppLayout;