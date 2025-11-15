import { useState, useEffect, useMemo, useCallback, Dispatch, SetStateAction } from 'react';
import {
    collection,
    onSnapshot,
    doc,
    writeBatch,
    getDoc,
    deleteDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
    User,
    UserRole,
    Bookings,
    BookingDetails,
    ShiftAssignments,
    ShiftAssignment,
    CleaningAssignments,
    CleaningObservations,
    SpecialEvents,
    SpecialEvent,
    Sponsors,
    Sponsor,
    Task,
    AggregatedTask,
    TaskSourceCollection,
    Vacations,
    AppNotification,
    ShiftUpdateNotification,
    VacationYear,
    VacationUpdateNotification,
} from '../types';
import { formatDateForBookingKey, getWeekData, getMondayOfWeek } from '../utils/dateUtils';
import { TIME_SLOTS, WORKERS, SHIFT_CHANGE_DATE } from '../constants';

/**
 * Compares old and new shift assignments to find workers whose shifts have changed.
 * @param oldShifts The state of shifts before the change.
 * @param newShifts The state of shifts after the change.
 * @param defaultAssignments The default weekly shift assignments (for comparison if oldShifts is undefined).
 * @returns An array of names of affected workers.
 */
const getAffectedWorkers = (
    oldShifts: ShiftAssignment | undefined,
    newShifts: ShiftAssignment,
    defaultAssignments: { morning: string; evening: string }
): string[] => {
    const affected = new Set<string>();
    const workersToTrack = ['Olga', 'Dani', 'Adrián'];

    const oldM = oldShifts?.morning || defaultAssignments.morning;
    const oldE = oldShifts?.evening || defaultAssignments.evening;
    const newM = newShifts.morning;
    const newE = newShifts.evening;

    if (oldM !== newM) {
        if (workersToTrack.includes(oldM)) affected.add(oldM);
        if (workersToTrack.includes(newM)) affected.add(newM);
    }
    if (oldE !== newE) {
        if (workersToTrack.includes(oldE)) affected.add(oldE);
        if (workersToTrack.includes(newE)) affected.add(newE);
    }

    for (let i = 0; i < 7; i++) {
        const dayIndexStr = i.toString();
        const oldOverride = oldShifts?.dailyOverrides?.[dayIndexStr];
        const newOverride = newShifts.dailyOverrides?.[dayIndexStr];

        if (JSON.stringify(oldOverride) === JSON.stringify(newOverride)) continue;

        const oldDayMorningWorker = oldOverride?.morning.worker || oldM;
        const newDayMorningWorker = newOverride?.morning.worker || newM;
        if (oldDayMorningWorker !== newDayMorningWorker) {
            if (workersToTrack.includes(oldDayMorningWorker)) affected.add(oldDayMorningWorker);
            if (workersToTrack.includes(newDayMorningWorker)) affected.add(newDayMorningWorker);
        }

        const oldDayEveningWorker = oldOverride?.evening.worker || oldE;
        const newDayEveningWorker = newOverride?.evening.worker || newE;
        if (oldDayEveningWorker !== newDayEveningWorker) {
            if (workersToTrack.includes(oldDayEveningWorker)) affected.add(oldDayEveningWorker);
            if (workersToTrack.includes(newDayEveningWorker)) affected.add(newDayEveningWorker);
        }
    }

    return Array.from(affected);
};


// This hook centralizes all Firestore data subscriptions and write operations for the app.
export const useAppStore = (user: User | null, userRole: UserRole, currentUserName: string | null) => {
    // State for each Firestore collection
    const [bookings, setBookings] = useState<Bookings>({});
    const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignments>({});
    const [cleaningAssignments, setCleaningAssignments] = useState<CleaningAssignments>({});
    const [cleaningObservations, setCleaningObservations] = useState<CleaningObservations>({});
    const [specialEvents, setSpecialEvents] = useState<SpecialEvents>({});
    const [sponsors, setSponsors] = useState<Sponsors>({});
    const [vacations, setVacations] = useState<Vacations>({});
    const [notifications, setNotifications] = useState<Record<string, AppNotification>>({});
    
    // State for shift update confirmation flow
    const [shiftConfirmationState, setShiftConfirmationState] = useState<{
        isOpen: boolean;
        weekId: string | null;
        newShifts: ShiftAssignment | null;
        oldShifts: ShiftAssignment | undefined;
    }>({ isOpen: false, weekId: null, newShifts: null, oldShifts: undefined });


    // Effect to subscribe to data collections when a user is logged in
    useEffect(() => {
        if (!user) {
            // Clear data on logout
            setBookings({});
            setShiftAssignments({});
            setCleaningAssignments({});
            setCleaningObservations({});
            setSpecialEvents({});
            setSponsors({});
            setVacations({});
            setNotifications({});
            return;
        }

        const collections: { name: string, setter: Dispatch<SetStateAction<any>> }[] = [
            { name: 'bookings', setter: setBookings },
            { name: 'shiftAssignments', setter: setShiftAssignments },
            { name: 'cleaningAssignments', setter: setCleaningAssignments },
            { name: 'cleaningObservations', setter: setCleaningObservations },
            { name: 'specialEvents', setter: setSpecialEvents },
            { name: 'sponsors', setter: setSponsors },
            { name: 'vacations', setter: setVacations },
            { name: 'notifications', setter: setNotifications },
        ];

        const unsubscribes = collections.map(({ name, setter }) => {
            return onSnapshot(collection(db, name), (snapshot) => {
                const data: Record<string, any> = {};
                snapshot.forEach(doc => {
                    const docData = doc.data();
                    // Handle timestamp conversion for notifications
                    if (name === 'notifications' && docData.createdAt && typeof docData.createdAt.toDate === 'function') {
                        data[doc.id] = { ...docData, createdAt: docData.createdAt.toDate().getTime() };
                    } else {
                        data[doc.id] = docData;
                    }
                });
                setter(data);
            });
        });

        // Cleanup function to unsubscribe from listeners on component unmount or user change
        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [user]);

    // Derived state: memoized calculation of pending tasks for the current user
    const myPendingTasks = useMemo<AggregatedTask[]>(() => {
        if (!currentUserName) return [];

        const isUserAssignedToShiftTask = (task: Task, assignment: ShiftAssignment): boolean => {
            const taskAssignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
            for (const assignee of taskAssignees) {
                if (assignee === currentUserName) return true;
                if (assignee === 'MAÑANA' && assignment.morning === currentUserName) return true;
                if (assignee === 'TARDE' && assignment.evening === currentUserName) return true;
            }
            return false;
        };

        const getTasksFromShifts = (): AggregatedTask[] => {
            const tasks: AggregatedTask[] = [];
            Object.entries(shiftAssignments).forEach(([id, assignment]) => {
                const typedAssignment = assignment as ShiftAssignment;
                (typedAssignment.tasks || []).forEach(task => {
                    if (!task.completed && isUserAssignedToShiftTask(task, typedAssignment)) {
                        tasks.push({ ...task, sourceCollection: 'shiftAssignments', sourceId: id, sourceName: `Turnos (Semana ${id.split('-')[1]})` });
                    }
                });
            });
            return tasks;
        };
        
        const getTasksFromEvents = (): AggregatedTask[] => {
            const tasks: AggregatedTask[] = [];
            Object.entries(specialEvents).forEach(([id, event]) => {
                const typedEvent = event as SpecialEvent;
                (typedEvent.tasks || []).forEach(task => {
                    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                    if (!task.completed && assignees.includes(currentUserName)) {
                        tasks.push({ ...task, sourceCollection: 'specialEvents', sourceId: id, sourceName: typedEvent.name });
                    }
                });
            });
            return tasks;
        };

        const getTasksFromSponsors = (): AggregatedTask[] => {
            const tasks: AggregatedTask[] = [];
            Object.entries(sponsors).forEach(([id, sponsor]) => {
                const typedSponsor = sponsor as Sponsor;
                (typedSponsor.tasks || []).forEach(task => {
                    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                    if (!task.completed && assignees.includes(currentUserName)) {
                        tasks.push({ ...task, sourceCollection: 'sponsors', sourceId: id, sourceName: typedSponsor.name });
                    }
                });
            });
            return tasks;
        };

        return [
            ...getTasksFromShifts(),
            ...getTasksFromEvents(),
            ...getTasksFromSponsors(),
        ];
    }, [shiftAssignments, specialEvents, sponsors, currentUserName]);

    const myUnreadNotifications = useMemo<AppNotification[]>(() => {
        if (!user || !currentUserName) return [];
        return Object.values(notifications)
            .filter((n: any): n is AppNotification => {
                if (!n || !n.type || !n.createdAt || !Array.isArray(n.readBy) || n.readBy.includes(user.uid)) {
                    return false;
                }
                
                if (n.type === 'shift_update') {
                    return Array.isArray(n.affectedWorkers) && n.affectedWorkers.includes(currentUserName);
                }
                if (n.type === 'vacation_update') {
                    return Array.isArray(n.targetUsers) && n.targetUsers.includes(currentUserName);
                }
                if (n.type === 'special_event') {
                    return true;
                }

                return false;
            })
            .sort((a, b) => b.createdAt - a.createdAt);
    }, [notifications, user, currentUserName]);


    // --- Data Mutation Handlers ---

    const handleMarkNotificationAsRead = useCallback(async (notificationId: string) => {
        if (!user) return;
        try {
            const docRef = doc(db, 'notifications', notificationId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const readBy = (data.readBy || []) as string[];
                if (!readBy.includes(user.uid)) {
                    const newReadBy = [...readBy, user.uid];
                    await updateDoc(docRef, { readBy: newReadBy });
                }
            }
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    }, [user]);

    const handleAddBooking = useCallback(async (bookingKeys: string[], bookingDetails: BookingDetails): Promise<boolean> => {
        try {
            const batch = writeBatch(db);
            const conflictChecks = bookingKeys.map(key => getDoc(doc(db, 'bookings', key)));
            const results = await Promise.all(conflictChecks);
            
            if (results.some(docSnap => docSnap.exists())) {
                alert('Conflicto de reserva detectado. Alguien ha reservado uno de los huecos seleccionados mientras usted elegía. Por favor, revise el plano y vuelva a intentarlo.');
                return false;
            }

            bookingKeys.forEach(key => {
                const docRef = doc(db, 'bookings', key);
                batch.set(docRef, bookingDetails);
            });
            await batch.commit();
            return true;
        } catch (error) {
            console.error("Error adding booking:", error);
            alert("No se pudo añadir la reserva. Por favor, inténtelo de nuevo.");
            return false;
        }
    }, []);

    const handleDeleteBookingKeys = useCallback(async (keys: string[]): Promise<boolean> => {
        try {
            const batch = writeBatch(db);
            keys.forEach(key => {
                const docRef = doc(db, 'bookings', key);
                batch.delete(docRef);
            });
            await batch.commit();
            return true;
        } catch (error) {
            console.error("Error deleting booking:", error);
            alert("No se pudo eliminar la reserva. Por favor, inténtelo de nuevo.");
            return false;
        }
    }, []);
    
    const handleUpdateShifts = useCallback((weekId: string, newShifts: ShiftAssignment, oldShifts: ShiftAssignment | undefined) => {
        // Compare new and old shifts. Using JSON.stringify for simplicity.
        if (JSON.stringify(newShifts) !== JSON.stringify(oldShifts)) {
            // If there are changes, open the confirmation modal instead of saving directly.
            setShiftConfirmationState({
                isOpen: true,
                weekId,
                newShifts,
                oldShifts,
            });
        }
    }, []);
    
    const confirmShiftUpdate = useCallback(async () => {
        const { weekId, newShifts, oldShifts } = shiftConfirmationState;
        if (!weekId || !newShifts) return false;

        try {
            const docRef = doc(db, 'shiftAssignments', weekId);
            await setDoc(docRef, newShifts);

            // --- Notification Logic ---
            const today = new Date();
            const { year: currentYear, week: currentWeek } = getWeekData(today);
            const currentWeekId = `${currentYear}-${currentWeek.toString().padStart(2, '0')}`;
            
            const nextWeekDate = new Date();
            nextWeekDate.setDate(today.getDate() + 7);
            const { year: nextYear, week: nextWeek } = getWeekData(nextWeekDate);
            const nextWeekId = `${nextYear}-${nextWeek.toString().padStart(2, '0')}`;
            
            // Only send notifications for current or next week's changes
            if (weekId === currentWeekId || weekId === nextWeekId) {
                const [yearStr, weekStr] = weekId.split('-');
                const year = parseInt(yearStr, 10);
                const weekNum = parseInt(weekStr, 10);
                const mondayOfWeek = getMondayOfWeek(year, weekNum);

                let defaultAssignments: { morning: string; evening: string };
                if (mondayOfWeek >= SHIFT_CHANGE_DATE) {
                    defaultAssignments = { morning: 'Adrián', evening: 'Olga' };
                } else {
                    const isEvenWeek = weekNum % 2 === 0;
                    defaultAssignments = {
                        morning: isEvenWeek ? 'Dani' : 'Olga',
                        evening: isEvenWeek ? 'Olga' : 'Dani',
                    };
                }

                const affectedWorkers = getAffectedWorkers(oldShifts, newShifts, defaultAssignments);

                if (affectedWorkers.length > 0) {
                    const notificationId = `shift-update-${weekId}`;
                    const notificationPayload: ShiftUpdateNotification = {
                        id: notificationId,
                        type: 'shift_update',
                        title: `Cambios en turnos - Semana ${weekNum}`,
                        createdAt: serverTimestamp(),
                        readBy: [], // This will be populated by users as they read it.
                        link: {
                            view: 'agenda',
                            weekId: weekId,
                        },
                        affectedWorkers: affectedWorkers,
                    };
                    // Create or overwrite the notification for this week
                    await setDoc(doc(db, 'notifications', notificationId), notificationPayload);
                }
            }

            setShiftConfirmationState({ isOpen: false, weekId: null, newShifts: null, oldShifts: undefined });
            return true;
        } catch (error) {
            console.error("Error confirming shift update:", error);
            alert("No se pudo actualizar el turno.");
            setShiftConfirmationState({ isOpen: false, weekId: null, newShifts: null, oldShifts: undefined });
            return false;
        }
    }, [shiftConfirmationState]);

     const handleAddRecurringTask = useCallback(async (
        taskDetails: Omit<Task, 'id' | 'completed' | 'recurrenceId'>,
        weekIds: string[]
    ): Promise<boolean> => {
        try {
            const batch = writeBatch(db);
            const recurrenceId = doc(collection(db, 'shiftAssignments')).id; // Just for a unique ID

            const docRefs = weekIds.map(id => doc(db, 'shiftAssignments', id));
            const docSnaps = await Promise.all(docRefs.map(ref => getDoc(ref)));

            for (let i = 0; i < weekIds.length; i++) {
                const weekId = weekIds[i];
                const docRef = docRefs[i];
                const docSnap = docSnaps[i];

                const newTask: Task = {
                    ...taskDetails,
                    id: doc(collection(db, 'shiftAssignments')).id, // Unique ID for each instance
                    completed: false,
                    recurrenceId: recurrenceId,
                };

                if (docSnap.exists()) {
                    const existingData = docSnap.data() as ShiftAssignment;
                    const updatedTasks = [...(existingData.tasks || []), newTask];
                    batch.update(docRef, { tasks: updatedTasks });
                } else {
                    const [yearStr, weekStr] = weekId.split('-');
                    const year = parseInt(yearStr, 10);
                    const week = parseInt(weekStr, 10);
                    const mondayOfWeek = getMondayOfWeek(year, week);

                    let morning: string;
                    let evening: string;
                    if (mondayOfWeek >= SHIFT_CHANGE_DATE) {
                        morning = 'Adrián';
                        evening = 'Olga';
                    } else {
                        const isEvenWeek = week % 2 === 0;
                        morning = isEvenWeek ? 'Dani' : 'Olga';
                        evening = isEvenWeek ? 'Olga' : 'Dani';
                    }
                    
                    const newAssignment: ShiftAssignment = {
                        morning,
                        evening,
                        tasks: [newTask]
                    };
                    batch.set(docRef, newAssignment);
                }
            }

            await batch.commit();
            return true;
        } catch (error) {
            console.error("Error adding recurring task:", error);
            alert("No se pudo añadir la tarea recurrente.");
            return false;
        }
    }, []);

    const handleResetWeekShifts = useCallback(async (weekId: string) => {
        try {
            const docRef = doc(db, 'shiftAssignments', weekId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error resetting week shifts:", error);
             alert("No se pudo resetear el turno de la semana.");
        }
    }, []);

    const handleToggleTask = useCallback(async (sourceId: string, taskId: string, collectionName: TaskSourceCollection) => {
        try {
            const docRef = doc(db, collectionName, sourceId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const tasks = (data.tasks as Task[] || []).map(task => 
                    task.id === taskId ? { ...task, completed: !task.completed } : task
                );
                await updateDoc(docRef, { tasks });
            }
        } catch (error) {
            console.error("Error toggling task:", error);
            alert("No se pudo actualizar el estado de la tarea.");
        }
    }, []);

    const handleUpdateCleaningTime = useCallback(async (date: Date, startTime: string) => {
        const docId = formatDateForBookingKey(date);
        try {
            const docRef = doc(db, 'cleaningAssignments', docId);
            if (startTime) {
                await setDoc(docRef, { startTime });
            } else {
                await deleteDoc(docRef);
            }
        } catch (error) {
            console.error("Error updating cleaning time:", error);
            alert("No se pudo actualizar la hora de limpieza.");
        }
    }, []);

    const handleUpdateCleaningObservations = useCallback(async (weekId: string, observations: string) => {
         try {
            const docRef = doc(db, 'cleaningObservations', weekId);
            if (observations) {
                await setDoc(docRef, { observations });
            } else {
                await deleteDoc(docRef);
            }
        } catch (error) {
            console.error("Error updating cleaning observations:", error);
            alert("No se pudieron actualizar las observaciones de limpieza.");
        }
    }, []);
    
    const handleSaveSpecialEvent = useCallback(async (eventData: SpecialEvent, originalEvent: SpecialEvent | null): Promise<boolean> => {
        try {
            const batch = writeBatch(db);
            const eventRef = doc(db, 'specialEvents', eventData.id);

            // 1. Delete old bookings from original event if spaces/times have changed
            if (originalEvent?.spaceIds && originalEvent.spaceIds.length > 0 && originalEvent.startTime && originalEvent.endTime) {
                const oldKeysToDelete: string[] = [];
                const oldTimeSlots = TIME_SLOTS.filter(time => time >= originalEvent.startTime! && time < originalEvent.endTime!);
                for (let d = new Date(`${originalEvent.startDate}T00:00:00`); d <= new Date(`${originalEvent.endDate}T00:00:00`); d.setDate(d.getDate() + 1)) {
                    const dateStr = formatDateForBookingKey(d);
                    originalEvent.spaceIds.forEach(spaceId => {
                        oldTimeSlots.forEach(time => {
                            oldKeysToDelete.push(`${spaceId}-${dateStr}-${time}`);
                        });
                    });
                }
                oldKeysToDelete.forEach(key => batch.delete(doc(db, 'bookings', key)));
            }
            
            // 2. Add new bookings for the current event
            if (eventData.spaceIds && eventData.spaceIds.length > 0 && eventData.startTime && eventData.endTime) {
                const newTimeSlots = TIME_SLOTS.filter(time => time >= eventData.startTime! && time < eventData.endTime!);
                const eventBookingDetails: BookingDetails = { name: `EVENTO: ${eventData.name}` };
                
                 for (let d = new Date(`${eventData.startDate}T00:00:00`); d <= new Date(`${eventData.endDate}T00:00:00`); d.setDate(d.getDate() + 1)) {
                    const dateStr = formatDateForBookingKey(d);
                    eventData.spaceIds.forEach(spaceId => {
                        newTimeSlots.forEach(time => {
                            const key = `${spaceId}-${dateStr}-${time}`;
                            batch.set(doc(db, 'bookings', key), eventBookingDetails);
                        });
                    });
                }
            }
            
            // 3. Save the event document itself
            batch.set(eventRef, eventData);

            await batch.commit();

            // 4. Create/Update notification SEPARATELY to use serverTimestamp
            const notificationRef = doc(db, 'notifications', eventData.id);
            const notificationPayload = {
                id: eventData.id,
                type: 'special_event' as const,
                title: originalEvent ? `Evento actualizado: ${eventData.name}` : `Nuevo evento: ${eventData.name}`,
                createdAt: serverTimestamp(),
                readBy: [], // Reset read status on every update to re-notify everyone
                link: {
                    view: 'detalles_evento' as const,
                    entityId: eventData.id,
                },
            };
            await setDoc(notificationRef, notificationPayload);

            return true;
        } catch (error) {
            console.error("Error saving special event:", error);
            alert("No se pudo guardar el evento especial.");
            return false;
        }
    }, []);
    
    const handleDeleteSpecialEvent = useCallback(async (event: SpecialEvent) => {
        if (!window.confirm(`¿Está seguro de que desea eliminar el evento "${event.name}"? Esta acción no se puede deshacer.`)) {
            return;
        }
        try {
            const batch = writeBatch(db);
            const eventRef = doc(db, 'specialEvents', event.id);

            // Delete associated bookings
            if (event.spaceIds && event.spaceIds.length > 0 && event.startTime && event.endTime) {
                const timeSlots = TIME_SLOTS.filter(time => time >= event.startTime! && time < event.endTime!);
                 for (let d = new Date(`${event.startDate}T00:00:00`); d <= new Date(`${event.endDate}T00:00:00`); d.setDate(d.getDate() + 1)) {
                    const dateStr = formatDateForBookingKey(d);
                    event.spaceIds.forEach(spaceId => {
                        timeSlots.forEach(time => {
                            const key = `${spaceId}-${dateStr}-${time}`;
                            batch.delete(doc(db, 'bookings', key));
                        });
                    });
                }
            }
            
            // Delete the event document
            batch.delete(eventRef);

            // Delete the associated notification
            batch.delete(doc(db, 'notifications', event.id));

            await batch.commit();
        } catch (error) {
            console.error("Error deleting special event:", error);
            alert("No se pudo eliminar el evento especial.");
        }
    }, []);

    const handleUpdateSponsor = useCallback(async (sponsorId: string, newSponsorData: Sponsor) => {
        try {
            const docRef = doc(db, 'sponsors', sponsorId);
            await setDoc(docRef, newSponsorData);
        } catch (error) {
            console.error("Error updating sponsor:", error);
            alert("No se pudo actualizar el patrocinador.");
        }
    }, []);

    const handleAddSponsor = useCallback(async (sponsorData: Omit<Sponsor, 'id'>): Promise<string | null> => {
        try {
            const newSponsorRef = doc(collection(db, 'sponsors'));
            const newSponsor: Sponsor = {
                id: newSponsorRef.id,
                ...sponsorData,
            };
            await setDoc(newSponsorRef, newSponsor);
            return newSponsorRef.id;
        } catch (error) {
            console.error("Error adding sponsor:", error);
            alert("No se pudo añadir el patrocinador.");
            return null;
        }
    }, []);

    const handleUpdateVacations = useCallback(async (year: string, newDates: Record<string, string>) => {
        const oldYearVacations = (vacations[year] as VacationYear)?.dates || {};
        try {
            const docRef = doc(db, 'vacations', year);
            await setDoc(docRef, { dates: newDates });

            if (userRole === 'TRABAJADOR' && currentUserName) {
                const oldDatesSet = new Set(Object.keys(oldYearVacations));
                const newDatesSet = new Set(Object.keys(newDates));

                let action: 'añadido' | 'eliminado' | null = null;
                let changedDate: string | null = null;

                for (const date of newDatesSet) {
                    if (!oldDatesSet.has(date)) {
                        action = 'añadido';
                        changedDate = date;
                        break;
                    }
                }
                if (!action) {
                    for (const date of oldDatesSet) {
                        if (!newDatesSet.has(date)) {
                            action = 'eliminado';
                            changedDate = date;
                            break;
                        }
                    }
                }

                if (action && changedDate) {
                    const dateObj = new Date(`${changedDate}T00:00:00`);
                    const formattedChangedDate = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

                    const notificationId = `vacation-update-${changedDate}-${currentUserName}`;
                    const notificationPayload: Omit<VacationUpdateNotification, 'createdAt'> & {createdAt: any} = {
                        id: notificationId,
                        type: 'vacation_update',
                        title: `${currentUserName} ha ${action} el ${formattedChangedDate} como día de vacaciones.`,
                        createdAt: serverTimestamp(),
                        readBy: [],
                        targetUsers: ['Manu'],
                        link: {
                            view: 'turnos',
                            date: changedDate,
                        },
                    };
                    await setDoc(doc(db, 'notifications', notificationId), notificationPayload);
                }
            }
        } catch (error) {
            console.error("Error updating vacations:", error);
            alert("No se pudieron actualizar las vacaciones.");
        }
    }, [vacations, userRole, currentUserName]);

    // Return all state and handlers
    return {
        bookings,
        shiftAssignments,
        cleaningAssignments,
        cleaningObservations,
        specialEvents,
        sponsors,
        vacations,
        myPendingTasks,
        myUnreadNotifications,
        handleAddBooking,
        handleDeleteBookingKeys,
        handleUpdateShifts,
        handleAddRecurringTask,
        handleResetWeekShifts,
        handleToggleTask,
        handleMarkNotificationAsRead,
        handleUpdateCleaningTime,
        handleUpdateCleaningObservations,
        handleSaveSpecialEvent,
        handleDeleteSpecialEvent,
        handleUpdateSponsor,
        handleAddSponsor,
        handleUpdateVacations,
        shiftConfirmationState,
        confirmShiftUpdate,
        setShiftConfirmationState,
    };
};
