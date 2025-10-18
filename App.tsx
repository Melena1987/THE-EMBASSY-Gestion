import React, { useState, useCallback, useEffect } from 'react';
import type { View, Bookings, BookingDetails, ConsolidatedBooking, ShiftAssignments, ShiftAssignment } from './types';
import Header from './components/Header';
import FloorPlanView from './components/FloorPlanView';
import CalendarView from './components/CalendarView';
import AgendaView from './components/AgendaView';
import BookingDetailsView from './components/BookingDetailsView';
import ShiftsView from './components/ShiftsView';
import { WORKERS } from './constants';


const App: React.FC = () => {
    const [view, setView] = useState<View>('plano');
    const [bookings, setBookings] = useState<Bookings>({});
    const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignments>({});
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedBooking, setSelectedBooking] = useState<ConsolidatedBooking | null>(null);
    const [bookingToPreFill, setBookingToPreFill] = useState<ConsolidatedBooking | null>(null);

    const handleToggleBooking = useCallback((bookingKeys: string[], bookingDetails: BookingDetails): Promise<boolean> => {
        return new Promise((resolve) => {
            if (bookingKeys.length === 0) {
                resolve(false);
                return;
            }

            setBookings(prev => {
                const newBookings = { ...prev };
                const isAdding = !newBookings[bookingKeys[0]];

                if (isAdding) {
                    if (!bookingDetails.name.trim()) {
                        alert("El nombre de la reserva no puede estar vacío.");
                        resolve(false);
                        return prev;
                    }
                    const conflict = bookingKeys.some(key => prev[key]);
                    if (conflict) {
                        alert("Conflicto de reserva: Uno o más de los horarios seleccionados ya están ocupados en las fechas indicadas.");
                        resolve(false);
                        return prev;
                    }
                    bookingKeys.forEach(key => {
                        newBookings[key] = bookingDetails;
                    });
                    resolve(true);
                } else {
                    bookingKeys.forEach(key => {
                        delete newBookings[key];
                    });
                    resolve(true);
                }
                return newBookings;
            });
        });
    }, []);
    
    const handleSelectBooking = (booking: ConsolidatedBooking) => {
        setSelectedBooking(booking);
        setView('detalles');
    };

    const handleDeleteBooking = (keys: string[]) => {
        if (window.confirm('¿Está seguro de que desea eliminar esta reserva?')) {
            setBookings(prev => {
                const newBookings = { ...prev };
                keys.forEach(key => {
                    delete newBookings[key];
                });
                return newBookings;
            });
            setSelectedBooking(null);
            setView('agenda');
        }
    };

    const handleStartEdit = (booking: ConsolidatedBooking) => {
        if (window.confirm('La reserva actual se eliminará para que pueda crear una nueva con los datos precargados. ¿Desea continuar?')) {
            // 1. Delete the old booking
            setBookings(prev => {
                const newBookings = { ...prev };
                booking.keys.forEach(key => {
                    delete newBookings[key];
                });
                return newBookings;
            });
            
            // 2. Set data for the next view and navigate directly.
            // React will batch these state updates for a single, consistent render.
            setBookingToPreFill(booking);
            setView('plano');
        }
    };
    
    const onPreFillComplete = useCallback(() => {
        setBookingToPreFill(null);
    }, []);
    
    useEffect(() => {
        if (view === 'detalles' && !selectedBooking) {
            setView('agenda');
        }
    }, [view, selectedBooking]);

    const handleUpdateShifts = useCallback((weekId: string, newShifts: ShiftAssignment) => {
        setShiftAssignments(prev => ({
            ...prev,
            [weekId]: newShifts
        }));
    }, []);

    const handleResetWeekShifts = useCallback((weekId: string) => {
        setShiftAssignments(prev => {
            const newAssignments = { ...prev };
            delete newAssignments[weekId];
            return newAssignments;
        });
    }, []);


    const renderView = () => {
        switch (view) {
            case 'plano':
                return <FloorPlanView bookings={bookings} onToggleBooking={handleToggleBooking} selectedDate={selectedDate} onDateChange={setSelectedDate} bookingToPreFill={bookingToPreFill} onPreFillComplete={onPreFillComplete} />;
            case 'calendario':
                return <CalendarView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} setView={setView} shiftAssignments={shiftAssignments} />;
            case 'agenda':
                return <AgendaView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} onSelectBooking={handleSelectBooking} setView={setView} shiftAssignments={shiftAssignments} />;
            case 'detalles':
                 if (selectedBooking) {
                    return <BookingDetailsView booking={selectedBooking} onBack={() => setView('agenda')} onDelete={handleDeleteBooking} onEdit={() => handleStartEdit(selectedBooking)} />;
                }
                // Fallback if no booking is selected, let the effect handle navigation.
                return null;
            case 'turnos':
                 return <ShiftsView 
                    shiftAssignments={shiftAssignments} 
                    selectedDate={selectedDate} 
                    onDateChange={setSelectedDate} 
                    onUpdateShifts={handleUpdateShifts}
                    onResetWeekShifts={handleResetWeekShifts}
                />;
            default:
                return <FloorPlanView bookings={bookings} onToggleBooking={handleToggleBooking} selectedDate={selectedDate} onDateChange={setSelectedDate} bookingToPreFill={bookingToPreFill} onPreFillComplete={onPreFillComplete} />;
        }
    };

    return (
        <div className="min-h-screen text-gray-100 flex flex-col">
            <Header currentView={view} setView={setView} />
            <main className="flex-grow p-4 sm:p-6 md:p-8">
                {renderView()}
            </main>
            <footer className="text-center p-4 text-xs text-gray-400 bg-black/20 flex justify-center items-baseline gap-2" style={{ fontFamily: 'Arial, sans-serif' }}>
                <span>Gestión THE EMBASSY © {new Date().getFullYear()}</span>
                <span className="text-orange-400" style={{ fontFamily: 'Caveat, cursive', fontSize: '1.25rem', fontWeight: 'bold' }}>by Manu</span>
            </footer>
        </div>
    );
};

export default App;