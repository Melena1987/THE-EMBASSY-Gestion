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
} from '../types';
import { formatDateForBookingKey, getWeekData } from '../utils/dateUtils';
import { TIME_SLOTS, WORKERS } from '../constants';

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
        ];

        const unsubscribes = collections.map(({ name, setter }) => {
            return onSnapshot(collection(db, name), (snapshot) => {
                const data: Record<string, any> = {};
                snapshot.forEach(doc => {
                    data[doc.id] = doc.data();
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

        const tasks: AggregatedTask[] = [];

        // Tasks from shift assignments
        Object.entries(shiftAssignments).forEach(([id, assignment]) => {
            const typedAssignment = assignment as ShiftAssignment;
            (typedAssignment.tasks || []).forEach(task => {
                if (task.completed) return;

                let isAssigned = false;
                const taskAssignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                for (const assignee of taskAssignees) {
                    if (assignee === currentUserName) {
                        isAssigned = true;
                        break;
                    }
                    if (assignee === 'MAÑANA' && typedAssignment.morning === currentUserName) {
                        isAssigned = true;
                        break;
                    }
                    if (assignee === 'TARDE' && typedAssignment.evening === currentUserName) {
                        isAssigned = true;
                        break;
                    }
                }

                if (isAssigned) {
                    tasks.push({ ...task, sourceCollection: 'shiftAssignments', sourceId: id, sourceName: `Turnos (Semana ${id.split('-')[1]})` });
                }
            });
        });

        // Tasks from special events
        Object.entries(specialEvents).forEach(([id, event]) => {
            const typedEvent = event as SpecialEvent;
            (typedEvent.tasks || []).forEach(task => {
                const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                if (!task.completed && assignees.includes(currentUserName)) {
                    tasks.push({ ...task, sourceCollection: 'specialEvents', sourceId: id, sourceName: typedEvent.name });
                }
            });
        });

        // Tasks from sponsors
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
    }, [shiftAssignments, specialEvents, sponsors, currentUserName]);


    // --- Data Mutation Handlers ---

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
    
    const handleUpdateShifts = useCallback(async (weekId: string, newShifts: ShiftAssignment) => {
        try {
            const docRef = doc(db, 'shiftAssignments', weekId);
            await setDoc(docRef, newShifts);
        } catch (error) {
            console.error("Error updating shifts:", error);
            alert("No se pudo actualizar el turno.");
        }
    }, []);

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
                    const [, weekStr] = weekId.split('-');
                    const week = parseInt(weekStr, 10);
                    const isEvenWeek = week % 2 === 0;
                    const morning = isEvenWeek ? WORKERS[1] : WORKERS[0];
                    const evening = morning === WORKERS[0] ? WORKERS[1] : WORKERS[0];
                    
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

    const handleAddSponsor = useCallback(async (sponsorName: string): Promise<string | null> => {
        try {
            const newSponsorRef = doc(collection(db, 'sponsors'));
            const newSponsor: Sponsor = {
                id: newSponsorRef.id,
                name: sponsorName.trim(),
            };
            await setDoc(newSponsorRef, newSponsor);
            return newSponsorRef.id;
        } catch (error) {
            console.error("Error adding sponsor:", error);
            alert("No se pudo añadir el patrocinador.");
            return null;
        }
    }, []);

    const handleUpdateVacations = useCallback(async (year: string, dates: Record<string, string>) => {
        try {
            const docRef = doc(db, 'vacations', year);
            await setDoc(docRef, { dates });
        } catch (error) {
            console.error("Error updating vacations:", error);
            alert("No se pudieron actualizar las vacaciones.");
        }
    }, []);

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
        handleAddBooking,
        handleDeleteBookingKeys,
        handleUpdateShifts,
        handleAddRecurringTask,
        handleResetWeekShifts,
        handleToggleTask,
        handleUpdateCleaningTime,
        handleUpdateCleaningObservations,
        handleSaveSpecialEvent,
        handleDeleteSpecialEvent,
        handleUpdateSponsor,
        handleAddSponsor,
        handleUpdateVacations,
    };
};
