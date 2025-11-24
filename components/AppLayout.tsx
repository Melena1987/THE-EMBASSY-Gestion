import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { View, ConsolidatedBooking, SpecialEvent, User, UserRole, AppNotification } from '../types';
import Header from './layout/Header';
import Footer from './layout/Footer';
import ConfirmationModal from './ui/ConfirmationModal';
import WifiModal from './ui/WifiModal';
import ShiftConfirmationModal from './ShiftConfirmationModal';
import ViewRenderer from './ViewRenderer';
import { findRelatedBookings } from '../utils/bookingUtils';
import { useAppStore } from '../hooks/useAppStore';
import { getMondayOfWeek } from '../utils/dateUtils';
import BottomNavBar from './layout/BottomNavBar';

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
        shiftConfirmationState, confirmShiftUpdate, setShiftConfirmationState,
    } = store;

    const { user, userRole, handleLogout, currentUserName } = auth;

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
    
    // Use refs to store the previous set of IDs to accurately detect new items.
    const prevNotificationIds = useRef(new Set(myUnreadNotifications.map(n => n.id)));
    const prevTaskIds = useRef(new Set(myPendingTasks.map(t => t.id)));


    const handleNotificationClick = useCallback((notification: AppNotification) => {
        handleMarkNotificationAsRead(notification.id);
        if (notification.type === 'special_event') {
            const event = specialEvents[notification.link.entityId];
            if (event) {
                setSelectedSpecialEvent(event as SpecialEvent);
                setView(notification.link.view);
            }
        } else if (notification.type === 'shift_update') {
            const { weekId } = notification.link;
            const [yearStr, weekStr] = weekId.split('-');
            const year = parseInt(yearStr, 10);
            const week = parseInt(weekStr, 10);
            if (!isNaN(year) && !isNaN(week)) {
                const monday = getMondayOfWeek(year, week);
                setSelectedDate(monday);
                setView('agenda');
            }
        } else if (notification.type === 'vacation_update') {
            setSelectedDate(new Date(`${notification.link.date}T00:00:00`));
            setView('turnos');
        }
    }, [handleMarkNotificationAsRead, specialEvents, setSelectedSpecialEvent, setView, setSelectedDate]);

    // Effect for handling native browser notifications
    useEffect(() => {
        // 1. Request permission on component mount if not already granted/denied
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        if (Notification.permission !== 'granted') {
            return; // Don't proceed if permission is not granted
        }

        // 2. Detect and show notifications for new "AppNotification" items
        const currentNotificationIds = new Set(myUnreadNotifications.map(n => n.id));
        const newNotifications = myUnreadNotifications.filter(n => !prevNotificationIds.current.has(n.id));

        newNotifications.forEach(notification => {
            const browserNotification = new Notification('Gestión THE EMBASSY', {
                body: notification.title,
                icon: 'https://firebasestorage.googleapis.com/v0/b/galeriaoficialapp.firebasestorage.app/o/users%2FI5KZz4BuUEfxcoAvSCAWllkQtwt1%2Fphotos%2F1761110250760_logo_TE_sombra.png?alt=media&token=7aac4790-0aa2-49b9-9170-89918bc641ce',
                tag: notification.id,
            });

            browserNotification.onclick = () => {
                window.focus();
                handleNotificationClick(notification);
                browserNotification.close();
            };
        });

        // 3. Detect and show notifications for new pending tasks
        const currentTaskIds = new Set(myPendingTasks.map(t => t.id));
        const newTasks = myPendingTasks.filter(t => !prevTaskIds.current.has(t.id));

        newTasks.forEach(task => {
            const browserNotification = new Notification('Nueva Tarea Asignada', {
                body: `[${task.sourceName}] ${task.text}`,
                icon: 'https://firebasestorage.googleapis.com/v0/b/galeriaoficialapp.firebasestorage.app/o/users%2FI5KZz4BuUEfxcoAvSCAWllkQtwt1%2Fphotos%2F1761110250760_logo_TE_sombra.png?alt=media&token=7aac4790-0aa2-49b9-9170-89918bc641ce',
                tag: `task-${task.id}`, // Unique tag for the task notification
            });

            browserNotification.onclick = () => {
                window.focus(); // Just bring the app to the front
                browserNotification.close();
            };
        });
        
        // 4. Update the refs with the new sets of IDs for the next render
        prevNotificationIds.current = currentNotificationIds;
        prevTaskIds.current = currentTaskIds;

    }, [myUnreadNotifications, myPendingTasks, handleNotificationClick]);


    // UI Logic and Handlers that combine store actions and UI state changes
    const handleSelectBooking = (booking: ConsolidatedBooking) => {
        setSelectedBooking(booking);
        setView('detalles');
    };

    const handleSelectSpecialEvent = (event: SpecialEvent) => {
        setSelectedSpecialEvent(event);
        setView('detalles_evento');
    };

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

    const canEditBookings = userRole === 'ADMIN' || userRole === 'EVENTOS' || userRole === 'SALUD';
    // Shift editing restricted to ADMIN. SALUD can assign tasks but not edit shifts directly via the grid (unless we split permissions).
    // For now, strict "edit shifts" means changing workers/hours.
    const canEditShifts = userRole === 'ADMIN';
    const canEditSpecialEvents = userRole === 'ADMIN' || userRole === 'EVENTOS';
    const canEditServices = userRole === 'ADMIN' || userRole === 'EVENTOS' || userRole === 'TRABAJADOR' || userRole === 'SALUD';
    const canManageSponsors = userRole === 'ADMIN' || userRole === 'EVENTOS';

    return (
        <div className="min-h-full text-gray-100 flex flex-col w-full">
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
            <main className="flex-grow p-4 sm:p-6 md:p-8 pb-24 md:pb-8">
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
             <ShiftConfirmationModal
                isOpen={shiftConfirmationState.isOpen}
                onConfirm={confirmShiftUpdate}
                onCancel={() => setShiftConfirmationState({ isOpen: false, weekId: null, newShifts: null, oldShifts: undefined })}
            />
            <WifiModal isOpen={isWifiModalOpen} onClose={() => setIsWifiModalOpen(false)} />
            <BottomNavBar
                currentView={view}
                setView={setView}
                userRole={userRole}
            />
        </div>
    );
};

export default AppLayout;