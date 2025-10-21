import React, { useState, useCallback, useEffect } from 'react';
import type { View, ConsolidatedBooking, SpecialEvent, User, UserRole, AggregatedTask, TaskSourceCollection } from '../types';
import Header from './layout/Header';
import Footer from './layout/Footer';
import FloorPlanView from './views/FloorPlanView';
import CalendarView from './views/CalendarView';
import AgendaView from './views/AgendaView';
import BookingDetailsView from './views/BookingDetailsView';
import ShiftsView from './views/ShiftsView';
import ExternalServicesView from './views/ExternalServicesView';
import SpecialEventView from './views/SpecialEventView';
import SpecialEventDetailsView from './views/SpecialEventDetailsView';
import SponsorsView from './views/SponsorsView';
import ConfirmationModal from './ui/ConfirmationModal';
import WifiModal from './ui/WifiModal';
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
        bookings, shiftAssignments, cleaningAssignments, cleaningObservations,
        specialEvents, sponsors, myPendingTasks, handleAddBooking,
        handleDeleteBookingKeys, handleUpdateShifts, handleToggleTask,
        handleResetWeekShifts, handleUpdateCleaningTime, handleUpdateCleaningObservations,
        handleSaveSpecialEvent, handleDeleteSpecialEvent, handleUpdateSponsor, handleAddSponsor,
        handleAddRecurringTask
    } = store;

    const { user, userRole, currentUserName, handleLogout } = auth;

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

    const renderView = () => {
        switch (view) {
            case 'plano':
                return <FloorPlanView bookings={bookings} onAddBooking={handleAddBooking} selectedDate={selectedDate} onDateChange={setSelectedDate} bookingToPreFill={bookingToPreFill} onPreFillComplete={onPreFillComplete} isReadOnly={!canEditBookings} />;
            case 'calendario':
                return <CalendarView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} setView={setView} shiftAssignments={shiftAssignments} specialEvents={specialEvents} onAddBooking={handleAddBooking} onSelectSpecialEvent={handleSelectSpecialEvent} isReadOnly={!canEditBookings} />;
            case 'agenda':
                return <AgendaView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} onSelectBooking={handleSelectBooking} setView={setView} shiftAssignments={shiftAssignments} specialEvents={specialEvents} onAddBooking={handleAddBooking} onToggleTask={handleToggleTask} onSelectSpecialEvent={handleSelectSpecialEvent} isReadOnly={!canEditBookings} onUpdateShifts={handleUpdateShifts} currentUserName={currentUserName} userRole={userRole} />;
            case 'detalles':
                if (selectedBooking) {
                    return <BookingDetailsView booking={selectedBooking} onBack={() => setView('agenda')} onDelete={triggerDeleteProcess} onEdit={() => triggerEditProcess(selectedBooking)} isReadOnly={!canEditBookings} />;
                }
                return null;
            case 'turnos':
                return <ShiftsView shiftAssignments={shiftAssignments} specialEvents={specialEvents} selectedDate={selectedDate} onDateChange={setSelectedDate} onUpdateShifts={handleUpdateShifts} onAddRecurringTask={handleAddRecurringTask} onToggleTask={handleToggleTask} onResetWeekShifts={handleResetWeekShifts} isReadOnly={!canEditShifts} />;
            case 'servicios':
                return <ExternalServicesView cleaningAssignments={cleaningAssignments} cleaningObservations={cleaningObservations} selectedDate={selectedDate} onDateChange={setSelectedDate} onUpdateCleaningTime={handleUpdateCleaningTime} onUpdateCleaningObservations={handleUpdateCleaningObservations} isReadOnly={!canEditServices} />;
            case 'eventos':
                return <SpecialEventView bookings={bookings} onSaveEvent={handleSaveSpecialEvent} onBack={() => setView('agenda')} eventToEdit={selectedSpecialEvent} onEditDone={() => setSelectedSpecialEvent(null)} isReadOnly={!canEditSpecialEvents} />;
            case 'detalles_evento':
                if (selectedSpecialEvent) {
                    const currentEventData = specialEvents[selectedSpecialEvent.id];
                    if (currentEventData) {
                        return <SpecialEventDetailsView event={currentEventData} onBack={() => { setView('agenda'); setSelectedSpecialEvent(null); }} onEdit={() => setView('eventos')} onDelete={handleDeleteSpecialEvent} onToggleTask={handleToggleTask} canEdit={canEditSpecialEvents} />;
                    }
                }
                return null;
            case 'sponsors':
                 return <SponsorsView sponsors={sponsors} onUpdateSponsor={handleUpdateSponsor} onAddSponsor={handleAddSponsor} onToggleTask={handleToggleTask} isReadOnly={!canManageSponsors} />;
            default:
                return <FloorPlanView bookings={bookings} onAddBooking={handleAddBooking} selectedDate={selectedDate} onDateChange={setSelectedDate} bookingToPreFill={bookingToPreFill} onPreFillComplete={onPreFillComplete} isReadOnly={!canEditBookings} />;
        }
    };

    return (
        <div className="min-h-screen text-gray-100 flex flex-col">
            <Header
                currentView={view}
                setView={setView}
                userEmail={user.email}
                userRole={userRole}
                onLogout={handleLogout}
                pendingTasks={myPendingTasks}
                onToggleTask={handleToggleTask}
            />
            <main className="flex-grow p-4 sm:p-6 md:p-8">
                {renderView()}
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