import React, { useState, useCallback, useEffect } from 'react';
import { collection, onSnapshot, doc, runTransaction, writeBatch, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { View, Bookings, BookingDetails, ConsolidatedBooking, ShiftAssignments, ShiftAssignment } from './types';
import Header from './components/Header';
import FloorPlanView from './components/FloorPlanView';
import CalendarView from './components/CalendarView';
import AgendaView from './components/AgendaView';
import BookingDetailsView from './components/BookingDetailsView';
import ShiftsView from './components/ShiftsView';

const App: React.FC = () => {
    const [bookings, setBookings] = useState<Bookings>({});
    const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignments>({});

    const [view, setView] = useState<View>('plano');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedBooking, setSelectedBooking] = useState<ConsolidatedBooking | null>(null);
    const [bookingToPreFill, setBookingToPreFill] = useState<ConsolidatedBooking | null>(null);

    useEffect(() => {
        // Listener para las reservas
        const bookingsCol = collection(db, 'bookings');
        const unsubscribeBookings = onSnapshot(bookingsCol, (snapshot) => {
            const newBookings: Bookings = {};
            snapshot.forEach((doc) => {
                newBookings[doc.id] = doc.data() as BookingDetails;
            });
            setBookings(newBookings);
        });

        // Listener para los turnos
        const shiftsCol = collection(db, 'shiftAssignments');
        const unsubscribeShifts = onSnapshot(shiftsCol, (snapshot) => {
            const newShiftAssignments: ShiftAssignments = {};
            snapshot.forEach((doc) => {
                newShiftAssignments[doc.id] = doc.data() as ShiftAssignment;
            });
            setShiftAssignments(newShiftAssignments);
        });

        // Limpieza de listeners al desmontar el componente
        return () => {
            unsubscribeBookings();
            unsubscribeShifts();
        };
    }, []);

    const handleAddBooking = useCallback(async (bookingKeys: string[], bookingDetails: BookingDetails): Promise<boolean> => {
        if (bookingKeys.length === 0) {
            return false;
        }
        if (!bookingDetails.name.trim()) {
            alert("El nombre de la reserva no puede estar vacío.");
            return false;
        }

        try {
            await runTransaction(db, async (transaction) => {
                const bookingDocsRefs = bookingKeys.map(key => doc(db, 'bookings', key));
                
                // Firestore get all documents in a single request is more efficient
                const bookingDocsSnapshots = await Promise.all(bookingDocsRefs.map(ref => transaction.get(ref)));

                for (const docSnapshot of bookingDocsSnapshots) {
                    if (docSnapshot.exists()) {
                         throw new Error("Conflicto de reserva: Uno o más de los horarios seleccionados ya están ocupados en las fechas indicadas.");
                    }
                }

                bookingKeys.forEach(key => {
                    transaction.set(doc(db, 'bookings', key), bookingDetails);
                });
            });
            return true;
        } catch (e: any) {
            console.error("Error en la transacción de reserva:", e);
            alert(e.message || "No se pudo crear la reserva. Compruebe los datos e inténtelo de nuevo.");
            return false;
        }
    }, []);
    
    const handleSelectBooking = (booking: ConsolidatedBooking) => {
        setSelectedBooking(booking);
        setView('detalles');
    };

    const handleDeleteBooking = async (keys: string[]) => {
        if (window.confirm('¿Está seguro de que desea eliminar esta reserva?')) {
            try {
                const batch = writeBatch(db);
                keys.forEach(key => {
                    batch.delete(doc(db, 'bookings', key));
                });
                await batch.commit();
                setSelectedBooking(null);
                setView('agenda');
            } catch (error) {
                console.error("Error al eliminar la reserva:", error);
                alert("Ocurrió un error al eliminar la reserva.");
            }
        }
    };

    const handleStartEdit = (booking: ConsolidatedBooking) => {
        if (window.confirm('La reserva actual se eliminará para que pueda crear una nueva con los datos precargados. ¿Desea continuar?')) {
            const batch = writeBatch(db);
            booking.keys.forEach(key => {
                batch.delete(doc(db, 'bookings', key));
            });
            // Ejecutar la eliminación en segundo plano para una respuesta de UI inmediata
            batch.commit().catch(err => console.error("Error en la eliminación en segundo plano:", err));
            
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

    const handleUpdateShifts = useCallback(async (weekId: string, newShifts: ShiftAssignment) => {
        try {
            await setDoc(doc(db, 'shiftAssignments', weekId), newShifts);
        } catch (error) {
            console.error("Error al actualizar los turnos:", error);
            alert("No se pudieron guardar los cambios en los turnos.");
        }
    }, []);

    const handleResetWeekShifts = useCallback(async (weekId: string) => {
        try {
            await deleteDoc(doc(db, 'shiftAssignments', weekId));
        } catch (error) {
            console.error("Error al resetear los turnos de la semana:", error);
            alert("No se pudo resetear la semana.");
        }
    }, []);


    const renderView = () => {
        switch (view) {
            case 'plano':
                return <FloorPlanView bookings={bookings} onAddBooking={handleAddBooking} selectedDate={selectedDate} onDateChange={setSelectedDate} bookingToPreFill={bookingToPreFill} onPreFillComplete={onPreFillComplete} />;
            case 'calendario':
                return <CalendarView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} setView={setView} shiftAssignments={shiftAssignments} />;
            case 'agenda':
                return <AgendaView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} onSelectBooking={handleSelectBooking} setView={setView} shiftAssignments={shiftAssignments} />;
            case 'detalles':
                 if (selectedBooking) {
                    return <BookingDetailsView booking={selectedBooking} onBack={() => setView('agenda')} onDelete={handleDeleteBooking} onEdit={() => handleStartEdit(selectedBooking)} />;
                }
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
                return <FloorPlanView bookings={bookings} onAddBooking={handleAddBooking} selectedDate={selectedDate} onDateChange={setSelectedDate} bookingToPreFill={bookingToPreFill} onPreFillComplete={onPreFillComplete} />;
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
