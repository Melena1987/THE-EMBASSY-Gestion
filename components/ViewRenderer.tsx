import React from 'react';
import type { View, ConsolidatedBooking, SpecialEvent, User, UserRole } from '../types';
import { useAppStore } from '../hooks/useAppStore';
import FloorPlanView from './views/FloorPlanView';
import CalendarView from './views/CalendarView';
import AgendaView from './views/AgendaView';
import BookingDetailsView from './views/BookingDetailsView';
import ShiftsView from './views/ShiftsView';
import ExternalServicesView from './views/ExternalServicesView';
import SpecialEventView from './views/SpecialEventView';
import SpecialEventDetailsView from './views/SpecialEventDetailsView';
import SponsorsView from './views/SponsorsView';

interface ViewRendererProps {
    view: View;
    setView: (view: View) => void;
    store: ReturnType<typeof useAppStore>;
    auth: {
        user: User;
        userRole: UserRole;
        currentUserName: string | null;
    };
    // UI State from AppLayout
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    selectedBooking: ConsolidatedBooking | null;
    selectedSpecialEvent: SpecialEvent | null;
    setSelectedSpecialEvent: (event: SpecialEvent | null) => void;
    bookingToPreFill: ConsolidatedBooking | null;
    onPreFillComplete: () => void;
    // Handlers from AppLayout
    triggerDeleteProcess: (booking: ConsolidatedBooking) => void;
    triggerEditProcess: (booking: ConsolidatedBooking) => void;
    handleSelectBooking: (booking: ConsolidatedBooking) => void;
    handleSelectSpecialEvent: (event: SpecialEvent) => void;
    // Permissions from AppLayout
    canEditBookings: boolean;
    canEditShifts: boolean;
    canEditSpecialEvents: boolean;
    canEditServices: boolean;
    canManageSponsors: boolean;
}

const ViewRenderer: React.FC<ViewRendererProps> = (props) => {
    const {
        view,
        setView,
        store,
        auth,
        selectedDate,
        setSelectedDate,
        selectedBooking,
        selectedSpecialEvent,
        setSelectedSpecialEvent,
        bookingToPreFill,
        onPreFillComplete,
        triggerDeleteProcess,
        triggerEditProcess,
        handleSelectBooking,
        handleSelectSpecialEvent,
        canEditBookings,
        canEditShifts,
        canEditSpecialEvents,
        canEditServices,
        canManageSponsors,
    } = props;

    const {
        bookings,
        shiftAssignments,
        cleaningAssignments,
        cleaningObservations,
        specialEvents,
        sponsors,
        vacations,
        handleAddBooking,
        handleToggleTask,
        handleUpdateShifts,
        handleResetWeekShifts,
        handleAddRecurringTask,
        handleUpdateVacations,
        handleUpdateCleaningTime,
        handleUpdateCleaningObservations,
        handleSaveSpecialEvent,
        handleDeleteSpecialEvent,
        handleUpdateSponsor,
        handleAddSponsor,
    } = store;

    const { userRole, currentUserName } = auth;

    switch (view) {
        case 'plano':
            return <FloorPlanView bookings={bookings} onAddBooking={handleAddBooking} selectedDate={selectedDate} onDateChange={setSelectedDate} bookingToPreFill={bookingToPreFill} onPreFillComplete={onPreFillComplete} isReadOnly={!canEditBookings} onSelectBooking={handleSelectBooking} />;
        case 'calendario':
            return <CalendarView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} setView={setView} shiftAssignments={shiftAssignments} specialEvents={specialEvents} onAddBooking={handleAddBooking} onSelectSpecialEvent={handleSelectSpecialEvent} isReadOnly={!canEditBookings} vacations={vacations} />;
        case 'agenda':
            return <AgendaView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} onSelectBooking={handleSelectBooking} setView={setView} shiftAssignments={shiftAssignments} specialEvents={specialEvents} onAddBooking={handleAddBooking} onToggleTask={handleToggleTask} onSelectSpecialEvent={handleSelectSpecialEvent} isReadOnly={!canEditBookings} onUpdateShifts={handleUpdateShifts} currentUserName={currentUserName} userRole={userRole} vacations={vacations} />;
        case 'detalles':
            if (selectedBooking) {
                return <BookingDetailsView booking={selectedBooking} onBack={() => setView('agenda')} onDelete={triggerDeleteProcess} onEdit={() => triggerEditProcess(selectedBooking)} isReadOnly={!canEditBookings} />;
            }
            return null;
        case 'turnos':
            return <ShiftsView shiftAssignments={shiftAssignments} specialEvents={specialEvents} selectedDate={selectedDate} onDateChange={setSelectedDate} onUpdateShifts={handleUpdateShifts} onAddRecurringTask={handleAddRecurringTask} onToggleTask={handleToggleTask} onResetWeekShifts={handleResetWeekShifts} isReadOnly={!canEditShifts} vacations={vacations} handleUpdateVacations={handleUpdateVacations} currentUserName={currentUserName} userRole={userRole} />;
        case 'servicios':
            return <ExternalServicesView cleaningAssignments={cleaningAssignments} cleaningObservations={cleaningObservations} selectedDate={selectedDate} onDateChange={setSelectedDate} onUpdateCleaningTime={handleUpdateCleaningTime} onUpdateCleaningObservations={handleUpdateCleaningObservations} isReadOnly={!canEditServices} />;
        case 'eventos':
            return <SpecialEventView bookings={bookings} onSaveEvent={handleSaveSpecialEvent} onBack={() => setView('agenda')} eventToEdit={selectedSpecialEvent} onEditDone={() => setSelectedSpecialEvent(null)} isReadOnly={!canEditSpecialEvents} onSelectSpecialEvent={handleSelectSpecialEvent} />;
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
            return <AgendaView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} onSelectBooking={handleSelectBooking} setView={setView} shiftAssignments={shiftAssignments} specialEvents={specialEvents} onAddBooking={handleAddBooking} onToggleTask={handleToggleTask} onSelectSpecialEvent={handleSelectSpecialEvent} isReadOnly={!canEditBookings} onUpdateShifts={handleUpdateShifts} currentUserName={currentUserName} userRole={userRole} vacations={vacations} />;
    }
};

export default ViewRenderer;