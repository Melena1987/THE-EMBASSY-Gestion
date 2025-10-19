import React, { useState, useCallback, useEffect } from 'react';
import { collection, onSnapshot, doc, runTransaction, writeBatch, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { db, auth } from './firebase';
import type { View, Bookings, BookingDetails, ConsolidatedBooking, ShiftAssignments, ShiftAssignment, CleaningAssignments, UserRole, CleaningObservations, SpecialEvents, SpecialEvent } from './types';
import { TIME_SLOTS } from './constants';
import Header from './components/Header';
import FloorPlanView from './components/FloorPlanView';
import CalendarView from './components/CalendarView';
import AgendaView from './components/AgendaView';
import BookingDetailsView from './components/BookingDetailsView';
import ShiftsView from './components/ShiftsView';
import ExternalServicesView from './components/ExternalServicesView';
import SpecialEventView from './components/SpecialEventView';
import SpecialEventDetailsView from './components/SpecialEventDetailsView';
import ConfirmationModal from './components/ConfirmationModal';
import Login from './components/Login';
import { findRelatedBookings } from './utils/bookingUtils';
import { formatDateForBookingKey } from './utils/dateUtils';

const App: React.FC = () => {
    const [bookings, setBookings] = useState<Bookings>({});
    const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignments>({});
    const [cleaningAssignments, setCleaningAssignments] = useState<CleaningAssignments>({});
    const [cleaningObservations, setCleaningObservations] = useState<CleaningObservations>({});
    const [specialEvents, setSpecialEvents] = useState<SpecialEvents>({});
    
    const [user, setUser] = useState<User | null>(null);
    const [userRole, setUserRole] = useState<UserRole>(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);

    const [view, setView] = useState<View>('agenda');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedBooking, setSelectedBooking] = useState<ConsolidatedBooking | null>(null);
    const [selectedSpecialEvent, setSelectedSpecialEvent] = useState<SpecialEvent | null>(null);
    const [bookingToPreFill, setBookingToPreFill] = useState<ConsolidatedBooking | null>(null);
    
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        action: 'delete' | 'edit' | null;
        booking: ConsolidatedBooking | null;
        relatedBookings: { date: string, keys: string[] }[];
    }>({ isOpen: false, action: null, booking: null, relatedBookings: [] });
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setIsLoadingAuth(true);
            if (currentUser) {
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const role = userDocSnap.data().role as UserRole;
                    setUserRole(role);
                    setUser(currentUser);
                } else {
                    console.error("No role document found for user:", currentUser.uid);
                    setUserRole(null);
                    setUser(null);
                    await signOut(auth); // Sign out user if no role is found
                }
            } else {
                setUser(null);
                setUserRole(null);
            }
            setIsLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        const bookingsCol = collection(db, 'bookings');
        const unsubscribeBookings = onSnapshot(bookingsCol, (snapshot) => {
            const newBookings: Bookings = {};
            snapshot.forEach((doc) => {
                newBookings[doc.id] = doc.data() as BookingDetails;
            });
            setBookings(newBookings);
        });

        const shiftsCol = collection(db, 'shiftAssignments');
        const unsubscribeShifts = onSnapshot(shiftsCol, (snapshot) => {
            const newShiftAssignments: ShiftAssignments = {};
            snapshot.forEach((doc) => {
                newShiftAssignments[doc.id] = doc.data() as ShiftAssignment;
            });
            setShiftAssignments(newShiftAssignments);
        });
        
        const cleaningCol = collection(db, 'cleaningAssignments');
        const unsubscribeCleaning = onSnapshot(cleaningCol, (snapshot) => {
            const newAssignments: CleaningAssignments = {};
            snapshot.forEach((doc) => {
                newAssignments[doc.id] = doc.data() as { startTime: string };
            });
            setCleaningAssignments(newAssignments);
        });

        const cleaningObsCol = collection(db, 'cleaningObservations');
        const unsubscribeCleaningObs = onSnapshot(cleaningObsCol, (snapshot) => {
            const newObservations: CleaningObservations = {};
            snapshot.forEach((doc) => {
                newObservations[doc.id] = doc.data() as { observations: string };
            });
            setCleaningObservations(newObservations);
        });

        const specialEventsCol = collection(db, 'specialEvents');
        const unsubscribeSpecialEvents = onSnapshot(specialEventsCol, (snapshot) => {
            const newEvents: SpecialEvents = {};
            snapshot.forEach((doc) => {
                newEvents[doc.id] = doc.data() as SpecialEvent;
            });
            setSpecialEvents(newEvents);
        });

        return () => {
            unsubscribeBookings();
            unsubscribeShifts();
            unsubscribeCleaning();
            unsubscribeCleaningObs();
            unsubscribeSpecialEvents();
        };
    }, [user]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const handleAddBooking = useCallback(async (bookingKeys: string[], bookingDetails: BookingDetails): Promise<boolean> => {
        if (userRole !== 'ADMIN') {
            alert("Acción no permitida para su rol.");
            return false;
        }
        if (bookingKeys.length === 0) return false;
        if (!bookingDetails.name.trim()) {
            alert("El nombre de la reserva no puede estar vacío.");
            return false;
        }

        try {
            await runTransaction(db, async (transaction) => {
                const bookingDocsRefs = bookingKeys.map(key => doc(db, 'bookings', key));
                const bookingDocsSnapshots = await Promise.all(bookingDocsRefs.map(ref => transaction.get(ref)));

                for (const docSnapshot of bookingDocsSnapshots) {
                    if (docSnapshot.exists()) {
                         throw new Error("Conflicto de reserva: Uno o más de los horarios seleccionados ya están ocupados en las fechas indicadas.");
                    }
                }
                bookingKeys.forEach(key => transaction.set(doc(db, 'bookings', key), bookingDetails));
            });
            return true;
        } catch (e: any) {
            console.error("Error en la transacción de reserva:", e);
            alert(e.message || "No se pudo crear la reserva. Compruebe los datos e inténtelo de nuevo.");
            return false;
        }
    }, [userRole]);
    
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
                try {
                    const batch = writeBatch(db);
                    booking.keys.forEach(key => batch.delete(doc(db, 'bookings', key)));
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
            setModalState({ isOpen: true, action: 'edit', booking: booking, relatedBookings: related });
        } else {
            if (window.confirm('La reserva actual se eliminará para que pueda crear una nueva con los datos precargados. ¿Desea continuar?')) {
                const batch = writeBatch(db);
                booking.keys.forEach(key => batch.delete(doc(db, 'bookings', key)));
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
        
        const closeAndResetModal = () => setModalState({ isOpen: false, action: null, booking: null, relatedBookings: [] });
        
        if (action === 'delete') {
            try {
                const batch = writeBatch(db);
                keysToModify.forEach(key => batch.delete(doc(db, 'bookings', key)));
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
                keysToModify.forEach(key => batch.delete(doc(db, 'bookings', key)));
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
         if (view === 'detalles_evento' && !selectedSpecialEvent) {
            setView('agenda');
        }
    }, [view, selectedBooking, selectedSpecialEvent]);

    const handleUpdateShifts = useCallback(async (weekId: string, newShifts: ShiftAssignment) => {
        if (userRole !== 'ADMIN') {
            alert("Acción no permitida para su rol.");
            return;
        }
        try {
            await setDoc(doc(db, 'shiftAssignments', weekId), newShifts, { merge: true });
        } catch (error) {
            console.error("Error al actualizar los turnos:", error);
            alert("No se pudieron guardar los cambios en los turnos.");
        }
    }, [userRole]);
    
    const handleToggleTaskCompletion = useCallback(async (weekId: string, taskId: string, collectionName: 'shiftAssignments' | 'specialEvents' = 'shiftAssignments') => {
        if (!user) return;
        const docRef = doc(db, collectionName, weekId);
        try {
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) {
                    throw new Error("No se encontró el documento para actualizar la tarea.");
                }
                const currentData = docSnap.data() as (ShiftAssignment | SpecialEvent);
                const updatedTasks = currentData.tasks?.map(task => 
                    task.id === taskId ? { ...task, completed: !task.completed } : task
                );
                
                if(updatedTasks) {
                    transaction.update(docRef, { tasks: updatedTasks });
                }
            });
        } catch (error) {
            console.error("Error al actualizar la tarea:", error);
            alert(`No se pudo actualizar el estado de la tarea. ${error instanceof Error ? error.message : ''}`);
        }
    }, [user]);


    const handleResetWeekShifts = useCallback(async (weekId: string) => {
        if (userRole !== 'ADMIN') {
            alert("Acción no permitida para su rol.");
            return;
        }
        try {
            await deleteDoc(doc(db, 'shiftAssignments', weekId));
        } catch (error) {
            console.error("Error al resetear los turnos de la semana:", error);
            alert("No se pudo resetear la semana.");
        }
    }, [userRole]);

    const handleUpdateCleaningTime = useCallback(async (date: Date, startTime: string) => {
        const docId = formatDateForBookingKey(date);
        try {
            if (startTime) {
                await setDoc(doc(db, 'cleaningAssignments', docId), { startTime });
            } else {
                await deleteDoc(doc(db, 'cleaningAssignments', docId));
            }
        } catch (error) {
            console.error("Error al actualizar la hora de limpieza:", error);
            alert("No se pudo guardar la hora de limpieza.");
        }
    }, []);

    const handleUpdateCleaningObservations = useCallback(async (weekId: string, observations: string) => {
        try {
            if (observations.trim()) {
                await setDoc(doc(db, 'cleaningObservations', weekId), { observations });
            } else {
                await deleteDoc(doc(db, 'cleaningObservations', weekId));
            }
        } catch (error) {
            console.error("Error al actualizar las observaciones de limpieza:", error);
            alert("No se pudo guardar las observaciones de limpieza.");
        }
    }, []);
    
    const handleSaveSpecialEvent = useCallback(async (eventData: SpecialEvent, originalEventId?: string): Promise<boolean> => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS') {
            alert("Acción no permitida para su rol.");
            return false;
        }

        const { id: date, name, startTime, endTime, spaceIds, tasks, observations } = eventData;
        const originalEvent = originalEventId ? specialEvents[originalEventId] : null;

        try {
            await runTransaction(db, async (transaction) => {
                // If date changes, delete old event doc
                if (originalEventId && originalEventId !== date) {
                    transaction.delete(doc(db, 'specialEvents', originalEventId));
                }
                const eventDocRef = doc(db, 'specialEvents', date);

                // 1. Determine old booking keys to delete
                const oldKeysToDelete: string[] = [];
                if (originalEvent && originalEvent.startTime && originalEvent.endTime && originalEvent.spaceIds) {
                     const oldTimeSlots = TIME_SLOTS.filter(t => t >= originalEvent.startTime! && t < originalEvent.endTime!);
                     originalEvent.spaceIds.forEach(spaceId => {
                         oldTimeSlots.forEach(time => {
                             oldKeysToDelete.push(`${spaceId}-${originalEvent.id}-${time}`);
                         });
                     });
                }

                // 2. Determine new booking keys to create
                const newKeysToCreate: string[] = [];
                if (startTime && endTime && spaceIds) {
                    const newTimeSlots = TIME_SLOTS.filter(t => t >= startTime && t < endTime);
                    spaceIds.forEach(spaceId => {
                        newTimeSlots.forEach(time => {
                            newKeysToCreate.push(`${spaceId}-${date}-${time}`);
                        });
                    });
                }

                // 3. Check for conflicts
                const keysToCheck = newKeysToCreate.filter(k => !oldKeysToDelete.includes(k));
                if (keysToCheck.length > 0) {
                    const bookingDocsRefs = keysToCheck.map(key => doc(db, 'bookings', key));
                    const bookingDocsSnapshots = await Promise.all(bookingDocsRefs.map(ref => transaction.get(ref)));
                    if (bookingDocsSnapshots.some(snap => snap.exists())) {
                        throw new Error("Conflicto: Uno o más espacios ya están reservados en el nuevo horario del evento.");
                    }
                }
                
                // 4. Perform writes
                oldKeysToDelete.forEach(key => transaction.delete(doc(db, 'bookings', key)));
                const bookingDetails: BookingDetails = { name: `EVENTO: ${name}` };
                newKeysToCreate.forEach(key => transaction.set(doc(db, 'bookings', key), bookingDetails));
                
                const eventToSave: SpecialEvent = { id: date, name, tasks, observations, startTime, endTime, spaceIds };
                transaction.set(eventDocRef, eventToSave);
            });

            setSelectedSpecialEvent(null);
            setView('agenda');
            return true;

        } catch (e: any) {
            console.error("Error al guardar evento especial:", e);
            alert(e.message || "No se pudo guardar el evento especial.");
            return false;
        }
    }, [userRole, specialEvents]);

    const handleDeleteSpecialEvent = useCallback(async (eventToDelete: SpecialEvent) => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS') {
            alert("Acción no permitida para su rol.");
            return;
        }
        if (!window.confirm(`¿Está seguro de que desea eliminar el evento "${eventToDelete.name}"? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            const batch = writeBatch(db);
            // Delete associated bookings
            if (eventToDelete.startTime && eventToDelete.endTime && eventToDelete.spaceIds) {
                const timeSlots = TIME_SLOTS.filter(t => t >= eventToDelete.startTime! && t < eventToDelete.endTime!);
                eventToDelete.spaceIds.forEach(spaceId => {
                    timeSlots.forEach(time => {
                        batch.delete(doc(db, 'bookings', `${spaceId}-${eventToDelete.id}-${time}`));
                    });
                });
            }
            // Delete event document
            batch.delete(doc(db, 'specialEvents', eventToDelete.id));
            await batch.commit();

            setSelectedSpecialEvent(null);
            setView('agenda');

        } catch(e) {
            console.error("Error eliminando evento especial:", e);
            alert("No se pudo eliminar el evento.");
        }
    }, [userRole]);
    
    if (isLoadingAuth) {
        return <div className="min-h-screen flex items-center justify-center text-white text-xl">Cargando...</div>;
    }
    
    if (!user || !userRole) {
        return <Login />;
    }

    const canEditBookings = userRole === 'ADMIN';
    const canEditShifts = userRole === 'ADMIN';
    const canEditSpecialEvents = userRole === 'ADMIN' || userRole === 'EVENTOS';

    const renderView = () => {
        switch (view) {
            case 'plano':
                return <FloorPlanView bookings={bookings} onAddBooking={handleAddBooking} selectedDate={selectedDate} onDateChange={setSelectedDate} bookingToPreFill={bookingToPreFill} onPreFillComplete={onPreFillComplete} isReadOnly={!canEditBookings} />;
            case 'calendario':
                return <CalendarView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} setView={setView} shiftAssignments={shiftAssignments} specialEvents={specialEvents} onAddBooking={handleAddBooking} onSelectSpecialEvent={handleSelectSpecialEvent} isReadOnly={!canEditBookings} />;
            case 'agenda':
                return <AgendaView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} onSelectBooking={handleSelectBooking} setView={setView} shiftAssignments={shiftAssignments} specialEvents={specialEvents} onAddBooking={handleAddBooking} onToggleTask={handleToggleTaskCompletion} onSelectSpecialEvent={handleSelectSpecialEvent} isReadOnly={!canEditBookings} />;
            case 'detalles':
                 if (selectedBooking) {
                    return <BookingDetailsView booking={selectedBooking} onBack={() => setView('agenda')} onDelete={triggerDeleteProcess} onEdit={() => triggerEditProcess(selectedBooking)} isReadOnly={!canEditBookings} />;
                }
                return null;
            case 'turnos':
                 return <ShiftsView 
                    shiftAssignments={shiftAssignments} 
                    selectedDate={selectedDate} 
                    onDateChange={setSelectedDate} 
                    onUpdateShifts={handleUpdateShifts}
                    onToggleTask={handleToggleTaskCompletion}
                    onResetWeekShifts={handleResetWeekShifts}
                    isReadOnly={!canEditShifts}
                />;
            case 'servicios':
                return <ExternalServicesView
                    cleaningAssignments={cleaningAssignments}
                    cleaningObservations={cleaningObservations}
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    onUpdateCleaningTime={handleUpdateCleaningTime}
                    onUpdateCleaningObservations={handleUpdateCleaningObservations}
                />;
            case 'eventos':
                return <SpecialEventView
                    bookings={bookings}
                    onSaveEvent={handleSaveSpecialEvent}
                    onBack={() => setView('agenda')}
                    eventToEdit={selectedSpecialEvent}
                    onEditDone={() => setSelectedSpecialEvent(null)}
                    isReadOnly={!canEditSpecialEvents}
                />;
            case 'detalles_evento':
                if (selectedSpecialEvent) {
                    return <SpecialEventDetailsView
                        event={selectedSpecialEvent}
                        onBack={() => { setView('agenda'); setSelectedSpecialEvent(null); }}
                        onEdit={() => setView('eventos')}
                        onDelete={handleDeleteSpecialEvent}
                        onToggleTask={(taskId) => handleToggleTaskCompletion(selectedSpecialEvent.id, taskId, 'specialEvents')}
                        canEdit={canEditSpecialEvents}
                    />
                }
                return null;
            default:
                return <FloorPlanView bookings={bookings} onAddBooking={handleAddBooking} selectedDate={selectedDate} onDateChange={setSelectedDate} bookingToPreFill={bookingToPreFill} onPreFillComplete={onPreFillComplete} isReadOnly={!canEditBookings} />;
        }
    };

    return (
        <div className="min-h-screen text-gray-100 flex flex-col">
            <Header currentView={view} setView={setView} userEmail={user.email} userRole={userRole} onLogout={handleLogout} />
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