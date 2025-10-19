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
import ConfirmationModal from './components/ConfirmationModal';
import { findRelatedBookings } from './utils/bookingUtils';

const App: React.FC = () => {
    const [bookings, setBookings] = useState<Bookings>({});
    const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignments>({});

    const [view, setView] = useState<View>('plano');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedBooking, setSelectedBooking] = useState<ConsolidatedBooking | null>(null);
    const [bookingToPreFill, setBookingToPreFill] = useState<ConsolidatedBooking | null>(null);
    
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        action: 'delete' | 'edit' | null;
        booking: ConsolidatedBooking | null;
        relatedBookings: { date: string, keys: string[] }[];
    }>({ isOpen: false, action: null, booking: null, relatedBookings: [] });

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
    
    const handleMoveBooking = useCallback(async (
        originalKeys: string[],
        newKeys: string[],
        bookingDetails: BookingDetails
    ): Promise<boolean> => {
        if (newKeys.length === 0 || originalKeys.length === 0) {
            return false;
        }

        try {
            await runTransaction(db, async (transaction) => {
                const newBookingDocsRefs = newKeys.map(key => doc(db, 'bookings', key));
                
                const newBookingDocsSnapshots = await Promise.all(newBookingDocsRefs.map(ref => transaction.get(ref)));

                for (const docSnapshot of newBookingDocsSnapshots) {
                    if (docSnapshot.exists()) {
                         throw new Error("Conflicto de reserva: El nuevo horario ya está ocupado.");
                    }
                }
                
                originalKeys.forEach(key => {
                    transaction.delete(doc(db, 'bookings', key));
                });

                newKeys.forEach(key => {
                    transaction.set(doc(db, 'bookings', key), bookingDetails);
                });
            });
            return true;
        } catch (e: any) {
            console.error("Error al mover la reserva:", e);
            alert(e.message || "No se pudo mover la reserva.");
            return false;
        }
    }, []);

    const handleSelectBooking = (booking: ConsolidatedBooking) => {
        setSelectedBooking(booking);
        setView('detalles');
    };

    const triggerDeleteProcess = useCallback(async (booking: ConsolidatedBooking) => {
        const related = findRelatedBookings(booking, bookings);
        const futureEvents = related.filter(b => b.date > booking.date);
    
        if (futureEvents.length > 0) {
            setModalState({
                isOpen: true,
                action: 'delete',
                booking: booking,
                relatedBookings: related
            });
        } else {
            if (window.confirm('¿Está seguro de que desea eliminar esta reserva?')) {
                try {
                    const batch = writeBatch(db);
                    booking.keys.forEach(key => {
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
        }
    }, [bookings]);
    
    const triggerEditProcess = useCallback((booking: ConsolidatedBooking) => {
        const related = findRelatedBookings(booking, bookings);
        const futureEvents = related.filter(b => b.date >= booking.date);
    
        if (futureEvents.length > 1) { // If there's more than just the current event
            setModalState({
                isOpen: true,
                action: 'edit',
                booking: booking,
                relatedBookings: related
            });
        } else {
            if (window.confirm('La reserva actual se eliminará para que pueda crear una nueva con los datos precargados. ¿Desea continuar?')) {
                const batch = writeBatch(db);
                booking.keys.forEach(key => {
                    batch.delete(doc(db, 'bookings', key));
                });
                batch.commit().catch(err => console.error("Error en la eliminación en segundo plano:", err));
                
                setBookingToPreFill(booking);
                setView('plano');
            }
        }
    }, [bookings]);

    const handleModalConfirmation = useCallback(async (choice: 'single' | 'future') => {
        const { action, booking, relatedBookings } = modalState;
        if (!action || !booking) return;
    
        let keysToModify: string[] = [];
    
        if (choice === 'single') {
            keysToModify = booking.keys;
        } else { // 'future'
            const futureBookings = relatedBookings.filter(b => b.date >= booking.date);
            keysToModify = futureBookings.flatMap(b => b.keys);
        }
        
        const closeAndResetModal = () => {
             setModalState({ isOpen: false, action: null, booking: null, relatedBookings: [] });
        }
        
        if (action === 'delete') {
            try {
                const batch = writeBatch(db);
                keysToModify.forEach(key => {
                    batch.delete(doc(db, 'bookings', key));
                });
                await batch.commit();
                setSelectedBooking(null);
                setView('agenda');
            } catch (error) {
                console.error("Error al eliminar reservas:", error);
                alert("Ocurrió un error al eliminar las reservas.");
            } finally {
                closeAndResetModal();
            }
        } else if (action === 'edit') {
            try {
                const batch = writeBatch(db);
                keysToModify.forEach(key => {
                    batch.delete(doc(db, 'bookings', key));
                });
                await batch.commit();
                
                setBookingToPreFill(booking);
                setView('plano');
            } catch (error) {
                 console.error("Error al eliminar reservas para editar:", error);
                 alert("Ocurrió un error al preparar la edición.");
            } finally {
                closeAndResetModal();
            }
        } else {
           closeAndResetModal();
        }
    }, [modalState]);
    
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
                return <CalendarView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} setView={setView} shiftAssignments={shiftAssignments} onMoveBooking={handleMoveBooking} />;
            case 'agenda':
                return <AgendaView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} onSelectBooking={handleSelectBooking} setView={setView} shiftAssignments={shiftAssignments} onAddBooking={handleAddBooking} />;
            case 'detalles':
                 if (selectedBooking) {
                    return <BookingDetailsView booking={selectedBooking} onBack={() => setView('agenda')} onDelete={triggerDeleteProcess} onEdit={() => triggerEditProcess(selectedBooking)} />;
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
             <ConfirmationModal
                isOpen={modalState.isOpen}
                title={modalState.action === 'delete' ? 'Eliminar Reserva Recurrente' : 'Editar Reserva Recurrente'}
                message="Esta reserva parece ser parte de una serie. ¿Cómo desea proceder?"
                onConfirmSingle={() => handleModalConfirmation('single')}
                onConfirmFuture={() => handleModalConfirmation('future')}
                onClose={handleModalClose}
            />
            <footer className="text-center p-4 text-xs text-gray-400 bg-black/20 flex justify-center items-baseline gap-2" style={{ fontFamily: 'Arial, sans-serif' }}>
                <span>Gestión THE EMBASSY © {new Date().getFullYear()}</span>
                <span className="text-orange-400" style={{ fontFamily: 'Caveat, cursive', fontSize: '1.25rem', fontWeight: 'bold' }}>by Manu</span>
            </footer>
        </div>
    );
};

export default App;