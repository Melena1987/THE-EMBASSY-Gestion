import React, { useState, useCallback, useEffect, useMemo } from 'react';
// FIX: Added QuerySnapshot to imports to explicitly type snapshot objects from Firestore.
import { collection, onSnapshot, doc, runTransaction, writeBatch, deleteDoc, setDoc, getDoc, DocumentReference, QuerySnapshot } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { ref, deleteObject } from 'firebase/storage';
import { db, auth, storage } from './firebase';
import type { View, Bookings, BookingDetails, ConsolidatedBooking, ShiftAssignments, ShiftAssignment, CleaningAssignments, UserRole, CleaningObservations, SpecialEvents, SpecialEvent, Task, Sponsors, Sponsor, AggregatedTask, TaskSourceCollection } from './types';
import { TIME_SLOTS, SPACES, WORKERS, USER_EMAIL_MAP } from './constants';
import Header from './components/Header';
import FloorPlanView from './components/FloorPlanView';
import CalendarView from './components/CalendarView';
import AgendaView from './components/AgendaView';
import BookingDetailsView from './components/BookingDetailsView';
import ShiftsView from './components/ShiftsView';
import ExternalServicesView from './components/ExternalServicesView';
import SpecialEventView from './components/SpecialEventView';
import SpecialEventDetailsView from './components/SpecialEventDetailsView';
import SponsorsView from './components/SponsorsView';
import ConfirmationModal from './components/ConfirmationModal';
import Login from './components/Login';
import WifiModal from './components/WifiModal';
import WifiIcon from './components/icons/WifiIcon';
import { findRelatedBookings } from './utils/bookingUtils';
import { formatDateForBookingKey } from './utils/dateUtils';
import { getDefaultDailyShift } from './utils/shiftUtils';

const App: React.FC = () => {
    const [bookings, setBookings] = useState<Bookings>({});
    const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignments>({});
    const [cleaningAssignments, setCleaningAssignments] = useState<CleaningAssignments>({});
    const [cleaningObservations, setCleaningObservations] = useState<CleaningObservations>({});
    const [specialEvents, setSpecialEvents] = useState<SpecialEvents>({});
    const [sponsors, setSponsors] = useState<Sponsors>({});
    
    const [user, setUser] = useState<User | null>(null);
    const [userRole, setUserRole] = useState<UserRole>(null);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [isInitialSetupDone, setIsInitialSetupDone] = useState(false);

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
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setIsLoadingAuth(true);
            if (currentUser && currentUser.email) {
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    // FIX: Explicitly cast the returned user data to a typed object to safely access the 'role' property.
                    const role = (userDocSnap.data() as { role: UserRole }).role;
                    setUserRole(role);
                    setCurrentUserName(USER_EMAIL_MAP[currentUser.email.toLowerCase()] || null);
                    setUser(currentUser);

                    if (!isInitialSetupDone) {
                        if (role === 'ADMIN' || role === 'EVENTOS') {
                            const cleardentRef = doc(db, 'sponsors', 'cleardent');
                            const cleardentSnap = await getDoc(cleardentRef);
                            if (!cleardentSnap.exists()) {
                                const defaultCleardentTasks: Task[] = [
                                    { id: 'cl-1', text: 'Presencia del logo y banner de Clínicas Cleardent en la web oficial de THE EMBASSY TEAM 3X3', assignedTo: [], completed: false },
                                    { id: 'cl-2', text: 'Presencia del logo de Clínicas Cleardent en ropa OFICIAL DEL CLUB PROFESIONAL (Masc. y femen.) SUPERBASKET y ACADEMIA 3x3 (Cantera)', assignedTo: [], completed: false },
                                    { id: 'cl-3', text: 'Logo de Clínicas Cleardent en photocall, carteles, vídeos, etc de todos los eventos 3X3 organizados por THE EMBASSY', assignedTo: [], completed: false },
                                    { id: 'cl-4', text: 'Espacio reservado para la instalación de stand exclusivo de Clínicas Cleardent en la Fan Zone de eventos 3x3 organizados por THE EMBASSY.', assignedTo: [], completed: false },
                                    { id: 'cl-5', text: 'Presencia física de un representante de Clínicas Cleardent en todos los eventos organizados por el Universo The Embassy (Pro y Social)', assignedTo: [], completed: false }
                                ];
                                await setDoc(cleardentRef, { name: 'Cleardent', tasks: defaultCleardentTasks });
                            }
                        }
                        setIsInitialSetupDone(true);
                    }

                } else {
                    console.error("No role document found for user:", currentUser.uid);
                    setUserRole(null);
                    setCurrentUserName(null);
                    setUser(null);
                    await signOut(auth); // Sign out user if no role is found
                }
            } else {
                setUser(null);
                setCurrentUserName(null);
                setUserRole(null);
            }
            setIsLoadingAuth(false);
        });
        return () => unsubscribe();
    }, [isInitialSetupDone]);

    useEffect(() => {
        if (!user) return;
        const bookingsCol = collection(db, 'bookings');
        // FIX: Explicitly type 'snapshot' as QuerySnapshot to resolve incorrect type inference and allow use of the 'forEach' method.
        const unsubscribeBookings = onSnapshot(bookingsCol, (snapshot: QuerySnapshot) => {
            const newBookings: Bookings = {};
            snapshot.forEach((doc) => {
                newBookings[doc.id] = doc.data() as BookingDetails;
            });
            setBookings(newBookings);
        });

        const shiftsCol = collection(db, 'shiftAssignments');
        // FIX: Explicitly type 'snapshot' as QuerySnapshot to resolve incorrect type inference and allow use of the 'forEach' method.
        const unsubscribeShifts = onSnapshot(shiftsCol, (snapshot: QuerySnapshot) => {
            const newShiftAssignments: ShiftAssignments = {};
            snapshot.forEach((doc) => {
                newShiftAssignments[doc.id] = doc.data() as ShiftAssignment;
            });
            setShiftAssignments(newShiftAssignments);
        });
        
        const cleaningCol = collection(db, 'cleaningAssignments');
        // FIX: Explicitly type 'snapshot' as QuerySnapshot to resolve incorrect type inference and allow use of the 'forEach' method.
        const unsubscribeCleaning = onSnapshot(cleaningCol, (snapshot: QuerySnapshot) => {
            const newAssignments: CleaningAssignments = {};
            snapshot.forEach((doc) => {
                newAssignments[doc.id] = doc.data() as { startTime: string };
            });
            setCleaningAssignments(newAssignments);
        });

        const cleaningObsCol = collection(db, 'cleaningObservations');
        // FIX: Explicitly type 'snapshot' as QuerySnapshot to resolve incorrect type inference and allow use of the 'forEach' method.
        const unsubscribeCleaningObs = onSnapshot(cleaningObsCol, (snapshot: QuerySnapshot) => {
            const newObservations: CleaningObservations = {};
            snapshot.forEach((doc) => {
                newObservations[doc.id] = doc.data() as { observations: string };
            });
            setCleaningObservations(newObservations);
        });

        const specialEventsCol = collection(db, 'specialEvents');
        // FIX: Explicitly type 'snapshot' as QuerySnapshot to resolve incorrect type inference and allow use of the 'forEach' method.
        const unsubscribeSpecialEvents = onSnapshot(specialEventsCol, (snapshot: QuerySnapshot) => {
            const newEvents: SpecialEvents = {};
            snapshot.forEach((doc) => {
                newEvents[doc.id] = { ...doc.data(), id: doc.id } as SpecialEvent;
            });
            setSpecialEvents(newEvents);
        });

        const sponsorsCol = collection(db, 'sponsors');
        // FIX: Explicitly type 'snapshot' as QuerySnapshot to resolve incorrect type inference and allow use of the 'forEach' method.
        const unsubscribeSponsors = onSnapshot(sponsorsCol, (snapshot: QuerySnapshot) => {
            const newSponsors: Sponsors = {};
            snapshot.forEach((doc) => {
                newSponsors[doc.id] = { ...doc.data(), id: doc.id } as Sponsor;
            });
            setSponsors(newSponsors);
        });

        return () => {
            unsubscribeBookings();
            unsubscribeShifts();
            unsubscribeCleaning();
            unsubscribeCleaningObs();
            unsubscribeSpecialEvents();
            unsubscribeSponsors();
        };
    }, [user]);

    const myPendingTasks = useMemo((): AggregatedTask[] => {
        if (!currentUserName) return [];

        const allTasks: AggregatedTask[] = [];

        // Shift Tasks
        for (const [weekId, assignment] of Object.entries(shiftAssignments) as [string, ShiftAssignment][]) {
            if (assignment.tasks) {
                assignment.tasks.forEach(task => {
                    if (task.completed) return;

                    const isAssignedToMe = task.assignedTo.some(assignee => {
                        if (assignee === currentUserName) {
                            return true;
                        }

                        if (assignee === 'Mañana' || assignee === 'Tarde') {
                            if (!task.date) return false;

                            const taskDate = new Date(task.date + 'T00:00:00');
                            const dayIndex = taskDate.getDay() === 0 ? 6 : taskDate.getDay() - 1;
                            
                            const dailyOverride = assignment.dailyOverrides?.[dayIndex];
                            const isMorningTask = assignee === 'Mañana';

                            let workerForShift: string;
                            let isShiftActive: boolean;

                            if (dailyOverride) {
                                workerForShift = isMorningTask ? dailyOverride.morning.worker : dailyOverride.evening.worker;
                                isShiftActive = isMorningTask ? dailyOverride.morning.active : dailyOverride.evening.active;
                            } else {
                                const defaultShiftForDay = getDefaultDailyShift(dayIndex, assignment.morning, assignment.evening);
                                workerForShift = isMorningTask ? defaultShiftForDay.morning.worker : defaultShiftForDay.evening.worker;
                                isShiftActive = isMorningTask ? defaultShiftForDay.morning.active : defaultShiftForDay.evening.active;
                            }

                            return isShiftActive && workerForShift === currentUserName;
                        }
                        
                        return false;
                    });

                    if (isAssignedToMe) {
                        allTasks.push({ ...task, sourceCollection: 'shiftAssignments', sourceId: weekId, sourceName: `Turnos (Semana ${weekId.split('-')[1]})` });
                    }
                });
            }
        }

        // Special Event Tasks
        for (const event of Object.values(specialEvents) as SpecialEvent[]) {
            if (event.tasks) {
                event.tasks.forEach(task => {
                    if (!task.completed && task.assignedTo.includes(currentUserName)) {
                        allTasks.push({ ...task, sourceCollection: 'specialEvents', sourceId: event.id, sourceName: `Evento: ${event.name}` });
                    }
                });
            }
        }

        // Sponsor Tasks
        for (const sponsor of Object.values(sponsors) as Sponsor[]) {
            if (sponsor.tasks) {
                sponsor.tasks.forEach(task => {
                    if (!task.completed && task.assignedTo.includes(currentUserName)) {
                        allTasks.push({ ...task, sourceCollection: 'sponsors', sourceId: sponsor.id, sourceName: `Patrocinador: ${sponsor.name}` });
                    }
                });
            }
        }

        return allTasks;
    }, [currentUserName, shiftAssignments, specialEvents, sponsors]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const handleAddBooking = useCallback(async (bookingKeys: string[], bookingDetails: BookingDetails): Promise<boolean> => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS') {
            alert("Acción no permitida para su rol.");
            return false;
        }
        if (bookingKeys.length === 0) return false;
        if (!bookingDetails.name.trim()) {
            alert("El nombre de la reserva no puede estar vacío.");
            return false;
        }
    
        const CHUNK_SIZE = 100; // Process 100 booking keys at a time
    
        try {
            for (let i = 0; i < bookingKeys.length; i += CHUNK_SIZE) {
                const chunk = bookingKeys.slice(i, i + CHUNK_SIZE);
                await runTransaction(db, async (transaction) => {
                    const bookingDocsRefs = chunk.map(key => doc(db, 'bookings', key));
                    const bookingDocsSnapshots = await Promise.all(bookingDocsRefs.map(ref => transaction.get(ref)));
    
                    for (const docSnapshot of bookingDocsSnapshots) {
                        if (docSnapshot.exists()) {
                            throw new Error(`Conflicto de reserva: El horario en ${docSnapshot.id.split('-').slice(0, -4).join('-')} para el ${docSnapshot.id.split('-').slice(-4, -1).join('-')} ya está ocupado.`);
                        }
                    }
                    chunk.forEach(key => transaction.set(doc(db, 'bookings', key), bookingDetails));
                });
            }
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
    
    const handleAddRecurringTasks = useCallback(async (tasksByWeek: Record<string, Task[]>) => {
        if (userRole !== 'ADMIN') {
            alert("Acción no permitida para su rol.");
            return false;
        }
        try {
            const batch = writeBatch(db);
            const weekIds = Object.keys(tasksByWeek);
    
            const docRefs = weekIds.map(weekId => doc(db, 'shiftAssignments', weekId));
            const docSnaps = await Promise.all(docRefs.map(ref => getDoc(ref)));
    
            docSnaps.forEach((docSnap, index) => {
                const weekId = weekIds[index];
                const tasksToAdd = tasksByWeek[weekId];
                const docRef = docRefs[index];
                
                if (docSnap.exists()) {
                    const existingTasks = docSnap.data().tasks || [];
                    batch.update(docRef, { tasks: [...existingTasks, ...tasksToAdd] });
                } else {
                    const [year, week] = weekId.split('-').map(Number);
                    const isEvenWeek = week % 2 === 0;
                    const morning = isEvenWeek ? WORKERS[1] : WORKERS[0];
                    const evening = morning === WORKERS[0] ? WORKERS[1] : WORKERS[0];
                    batch.set(docRef, { morning, evening, tasks: tasksToAdd });
                }
            });
            
            await batch.commit();
            return true;
        } catch (error) {
            console.error("Error al añadir tareas recurrentes:", error);
            alert("No se pudieron guardar las tareas.");
            return false;
        }
    }, [userRole]);

    const handleToggleTask = useCallback(async (sourceId: string, taskId: string, collectionName: TaskSourceCollection) => {
        if (!user) return;
        const docRef = doc(db, collectionName, sourceId);
        try {
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) {
                    throw new Error("No se encontró el documento para actualizar la tarea.");
                }
                const currentData = docSnap.data() as (ShiftAssignment | SpecialEvent | Sponsor);
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
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS' && userRole !== 'TRABAJADOR') {
            alert("Acción no permitida para su rol.");
            return;
        }
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
    }, [userRole]);

    const handleUpdateCleaningObservations = useCallback(async (weekId: string, observations: string) => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS' && userRole !== 'TRABAJADOR') {
            alert("Acción no permitida para su rol.");
            return;
        }
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
    }, [userRole]);
    
    const handleSaveSpecialEvent = useCallback(async (eventData: SpecialEvent, originalEvent: SpecialEvent | null): Promise<boolean> => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS') {
            alert("Acción no permitida para su rol.");
            return false;
        }
        
        try {
            await runTransaction(db, async (transaction) => {
                const eventDocRef = doc(db, 'specialEvents', eventData.id);

                // 1. Delete old bookings if event scope changes
                if (originalEvent) {
                    if (originalEvent.startTime && originalEvent.endTime && originalEvent.spaceIds) {
                        const oldTimeSlots = TIME_SLOTS.filter(t => t >= originalEvent.startTime! && t < originalEvent.endTime!);
                        for (let d = new Date(originalEvent.startDate + 'T00:00:00'); d <= new Date(originalEvent.endDate + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
                            const dateStr = formatDateForBookingKey(d);
                            originalEvent.spaceIds!.forEach(spaceId => {
                                oldTimeSlots.forEach(time => {
                                    transaction.delete(doc(db, 'bookings', `${spaceId}-${dateStr}-${time}`));
                                });
                            });
                        }
                    }
                }

                // 2. Prepare new bookings and check for conflicts
                const newKeysToCreate: string[] = [];
                if (eventData.startTime && eventData.endTime && eventData.spaceIds) {
                    const newTimeSlots = TIME_SLOTS.filter(t => t >= eventData.startTime! && t < eventData.endTime!);
                    for (let d = new Date(eventData.startDate + 'T00:00:00'); d <= new Date(eventData.endDate + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
                        const dateStr = formatDateForBookingKey(d);
                        eventData.spaceIds!.forEach(spaceId => {
                            newTimeSlots.forEach(time => {
                                newKeysToCreate.push(`${spaceId}-${dateStr}-${time}`);
                            });
                        });
                    }
                }

                const cancellationTasks: Task[] = [];
                const conflictingBookingRefsToDelete: DocumentReference[] = [];
                
                if (newKeysToCreate.length > 0) {
                    const bookingDocsRefs = newKeysToCreate.map(key => doc(db, 'bookings', key));
                    const bookingDocsSnapshots = await Promise.all(bookingDocsRefs.map(ref => transaction.get(ref)));
                    const processedBookingsForTasks = new Set<string>();

                    for (const docSnap of bookingDocsSnapshots) {
                        if (docSnap.exists()) {
                            conflictingBookingRefsToDelete.push(docSnap.ref);
                            const bookingDetails = docSnap.data() as BookingDetails;
                            const key = docSnap.id;
                            
                            const compositeKey = `${bookingDetails.name}-${key.split('-').slice(1,4).join('-')}`;
                            if (!processedBookingsForTasks.has(compositeKey)) {
                                processedBookingsForTasks.add(compositeKey);
                                const keyParts = key.split('-');
                                const dateStr = keyParts.slice(-4, -1).join('-');
                                const spaceName = SPACES.find(s => s.id === keyParts.slice(0, -4).join('-'))?.name || 'Espacio Desconocido';
                                
                                cancellationTasks.push({
                                    id: `cancel-${Date.now()}-${cancellationTasks.length}`,
                                    text: `URGENTE: Cancelar y notificar reserva "${bookingDetails.name}" en ${spaceName} el ${dateStr} por evento especial.`,
                                    assignedTo: ['Manu'],
                                    completed: false,
                                });
                            }
                        }
                    }
                }
                
                conflictingBookingRefsToDelete.forEach(ref => transaction.delete(ref));
                
                const eventBookingDetails: BookingDetails = { name: `EVENTO: ${eventData.name}` };
                newKeysToCreate.forEach(key => transaction.set(doc(db, 'bookings', key), eventBookingDetails));
                
                const finalTasks = [...(eventData.tasks || []), ...cancellationTasks];
                const eventToSave: Omit<SpecialEvent, 'id'> = { 
                    name: eventData.name, 
                    startDate: eventData.startDate, 
                    endDate: eventData.endDate,
                    observations: eventData.observations, 
                    tasks: finalTasks.length > 0 ? finalTasks : undefined, 
                    startTime: eventData.startTime, 
                    endTime: eventData.endTime, 
                    spaceIds: eventData.spaceIds, 
                    posterUrl: eventData.posterUrl 
                };
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
            if (eventToDelete.startTime && eventToDelete.endTime && eventToDelete.spaceIds) {
                const timeSlots = TIME_SLOTS.filter(t => t >= eventToDelete.startTime! && t < eventToDelete.endTime!);
                for (let d = new Date(eventToDelete.startDate + 'T00:00:00'); d <= new Date(eventToDelete.endDate + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
                    const dateStr = formatDateForBookingKey(d);
                    eventToDelete.spaceIds.forEach(spaceId => {
                        timeSlots.forEach(time => {
                            batch.delete(doc(db, 'bookings', `${spaceId}-${dateStr}-${time}`));
                        });
                    });
                }
            }

            if (eventToDelete.posterUrl) {
                try {
                    const posterRef = ref(storage, eventToDelete.posterUrl);
                    await deleteObject(posterRef);
                } catch (storageError) {
                     console.warn(`Failed to delete poster for event ${eventToDelete.id}. The event will be deleted, but the file may remain in storage.`, storageError);
                }
            }

            batch.delete(doc(db, 'specialEvents', eventToDelete.id));
            await batch.commit();

            setSelectedSpecialEvent(null);
            setView('agenda');

        } catch(e) {
            console.error("Error eliminando evento especial:", e);
            alert("No se pudo eliminar el evento.");
        }
    }, [userRole]);

    const handleUpdateSponsor = useCallback(async (sponsorId: string, newSponsorData: Sponsor) => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS') {
            alert("Acción no permitida para su rol.");
            return;
        }
        try {
            const { id, ...dataToSave } = newSponsorData;
            await setDoc(doc(db, 'sponsors', sponsorId), dataToSave, { merge: true });
        } catch (error) {
            console.error("Error al actualizar el patrocinador:", error);
            alert("No se pudieron guardar los cambios del patrocinador.");
        }
    }, [userRole]);
    
    const handleAddSponsor = useCallback(async (sponsorName: string): Promise<string | null> => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS') {
            alert("Acción no permitida para su rol.");
            return null;
        }
        if (!sponsorName.trim()) {
            alert("El nombre del patrocinador no puede estar vacío.");
            return null;
        }
        try {
            const sponsorId = sponsorName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const sponsorRef = doc(db, 'sponsors', sponsorId);
            
            const docSnap = await getDoc(sponsorRef);
            if (docSnap.exists()) {
                alert("Ya existe un patrocinador con un nombre similar. Elija otro nombre.");
                return null;
            }

            await setDoc(sponsorRef, { name: sponsorName.trim(), tasks: [], allianceDate: formatDateForBookingKey(new Date()) });
            return sponsorId;
        } catch (error) {
            console.error("Error al añadir patrocinador:", error);
            alert("No se pudo añadir el patrocinador.");
            return null;
        }
    }, [userRole]);
    
    if (isLoadingAuth) {
        return <div className="min-h-screen flex items-center justify-center text-white text-xl">Cargando...</div>;
    }
    
    if (!user || !userRole) {
        return <Login />;
    }

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
                return <AgendaView bookings={bookings} selectedDate={selectedDate} onDateChange={setSelectedDate} onSelectBooking={handleSelectBooking} setView={setView} shiftAssignments={shiftAssignments} specialEvents={specialEvents} onAddBooking={handleAddBooking} onToggleTask={handleToggleTask} onSelectSpecialEvent={handleSelectSpecialEvent} isReadOnly={!canEditBookings} />;
            case 'detalles':
                 if (selectedBooking) {
                    return <BookingDetailsView booking={selectedBooking} onBack={() => setView('agenda')} onDelete={triggerDeleteProcess} onEdit={() => triggerEditProcess(selectedBooking)} isReadOnly={!canEditBookings} />;
                }
                return null;
            case 'turnos':
                 return <ShiftsView 
                    shiftAssignments={shiftAssignments} 
                    specialEvents={specialEvents}
                    selectedDate={selectedDate} 
                    onDateChange={setSelectedDate} 
                    onUpdateShifts={handleUpdateShifts}
                    onToggleTask={handleToggleTask}
                    onResetWeekShifts={handleResetWeekShifts}
                    onAddRecurringTasks={handleAddRecurringTasks}
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
                    isReadOnly={!canEditServices}
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
                    const currentEventData = specialEvents[selectedSpecialEvent.id];
                    if (currentEventData) {
                        return <SpecialEventDetailsView
                            event={currentEventData}
                            onBack={() => { setView('agenda'); setSelectedSpecialEvent(null); }}
                            onEdit={() => setView('eventos')}
                            onDelete={handleDeleteSpecialEvent}
                            onToggleTask={handleToggleTask}
                            canEdit={canEditSpecialEvents}
                        />;
                    }
                }
                return null;
            case 'sponsors':
                 return <SponsorsView
                    sponsors={sponsors}
                    onUpdateSponsor={handleUpdateSponsor}
                    onAddSponsor={handleAddSponsor}
                    onToggleTask={handleToggleTask}
                    isReadOnly={!canManageSponsors}
                 />;
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
             <ConfirmationModal
                isOpen={modalState.isOpen}
                title={modalState.action === 'delete' ? 'Eliminar Reserva Recurrente' : 'Editar Reserva Recurrente'}
                message="Esta reserva parece ser parte de una serie. ¿Cómo desea proceder?"
                onConfirmSingle={() => handleModalConfirmation('single')}
                onConfirmFuture={() => handleModalConfirmation('future')}
                onClose={handleModalClose}
            />
            <WifiModal isOpen={isWifiModalOpen} onClose={() => setIsWifiModalOpen(false)} />
            <footer className="flex items-baseline justify-center gap-2 p-4 text-xs text-gray-400 bg-black/20" style={{ fontFamily: 'Arial, sans-serif' }}>
                <span>Gestión THE EMBASSY © 2025 </span>
                <span className="text-orange-400" style={{ fontFamily: 'Caveat, cursive', fontSize: '1.25rem', fontWeight: 'bold' }}>by Manu</span>
                <button
                    onClick={() => setIsWifiModalOpen(true)}
                    className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-orange-400 rounded-full hover:bg-white/10 transition-colors"
                    title="Conectar al WiFi"
                    aria-label="Conectar al WiFi"
                >
                    <WifiIcon className="w-5 h-5" />
                </button>
            </footer>
        </div>
    );
};

export default App;