import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, doc, runTransaction, writeBatch, deleteDoc, setDoc, getDoc, DocumentReference } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { User, UserRole, Bookings, BookingDetails, ShiftAssignments, ShiftAssignment, CleaningAssignments, CleaningObservations, SpecialEvents, SpecialEvent, Sponsors, Sponsor, Task, AggregatedTask, TaskSourceCollection } from '../types';
import { TIME_SLOTS, SPACES } from '../constants';
import { formatDateForBookingKey } from '../utils/dateUtils';

export const useAppStore = (user: User | null, userRole: UserRole, currentUserName: string | null) => {
    const [bookings, setBookings] = useState<Bookings>({});
    const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignments>({});
    const [cleaningAssignments, setCleaningAssignments] = useState<CleaningAssignments>({});
    const [cleaningObservations, setCleaningObservations] = useState<CleaningObservations>({});
    const [specialEvents, setSpecialEvents] = useState<SpecialEvents>({});
    const [sponsors, setSponsors] = useState<Sponsors>({});

    useEffect(() => {
        if (!user) return;
        const subscriptions = [
            onSnapshot(collection(db, 'bookings'), snapshot => {
                const newBookings: Bookings = {};
                snapshot.forEach(doc => newBookings[doc.id] = doc.data() as BookingDetails);
                setBookings(newBookings);
            }),
            onSnapshot(collection(db, 'shiftAssignments'), snapshot => {
                const newShifts: ShiftAssignments = {};
                snapshot.forEach(doc => newShifts[doc.id] = doc.data() as ShiftAssignment);
                setShiftAssignments(newShifts);
            }),
            onSnapshot(collection(db, 'cleaningAssignments'), snapshot => {
                const newAssignments: CleaningAssignments = {};
                snapshot.forEach(doc => newAssignments[doc.id] = doc.data() as { startTime: string });
                setCleaningAssignments(newAssignments);
            }),
            onSnapshot(collection(db, 'cleaningObservations'), snapshot => {
                const newObservations: CleaningObservations = {};
                snapshot.forEach(doc => newObservations[doc.id] = doc.data() as { observations: string });
                setCleaningObservations(newObservations);
            }),
            onSnapshot(collection(db, 'specialEvents'), snapshot => {
                const newEvents: SpecialEvents = {};
                snapshot.forEach(doc => newEvents[doc.id] = { ...doc.data(), id: doc.id } as SpecialEvent);
                setSpecialEvents(newEvents);
            }),
            onSnapshot(collection(db, 'sponsors'), snapshot => {
                const newSponsors: Sponsors = {};
                snapshot.forEach(doc => newSponsors[doc.id] = { ...doc.data(), id: doc.id } as Sponsor);
                setSponsors(newSponsors);
            }),
        ];
        return () => subscriptions.forEach(unsub => unsub());
    }, [user]);

    const myPendingTasks = useMemo((): AggregatedTask[] => {
        if (!currentUserName) return [];
        const allTasks: AggregatedTask[] = [];
        for (const [weekId, assignment] of Object.entries(shiftAssignments)) {
            (assignment as ShiftAssignment).tasks?.forEach(task => {
                if (!task.completed && (Array.isArray(task.assignedTo) ? task.assignedTo.includes(currentUserName) : task.assignedTo === currentUserName)) {
                    allTasks.push({ ...task, sourceCollection: 'shiftAssignments', sourceId: weekId, sourceName: `Turnos (Semana ${weekId.split('-')[1]})` });
                }
            });
        }
        for (const event of Object.values(specialEvents)) {
            (event as SpecialEvent).tasks?.forEach(task => {
                if (!task.completed && (Array.isArray(task.assignedTo) ? task.assignedTo.includes(currentUserName) : task.assignedTo === currentUserName)) {
                    allTasks.push({ ...task, sourceCollection: 'specialEvents', sourceId: (event as SpecialEvent).id, sourceName: `Evento: ${(event as SpecialEvent).name}` });
                }
            });
        }
        for (const sponsor of Object.values(sponsors)) {
            (sponsor as Sponsor).tasks?.forEach(task => {
                if (!task.completed && (Array.isArray(task.assignedTo) ? task.assignedTo.includes(currentUserName) : task.assignedTo === currentUserName)) {
                    allTasks.push({ ...task, sourceCollection: 'sponsors', sourceId: (sponsor as Sponsor).id, sourceName: `Patrocinador: ${(sponsor as Sponsor).name}` });
                }
            });
        }
        return allTasks;
    }, [currentUserName, shiftAssignments, specialEvents, sponsors]);

    const handleAddBooking = useCallback(async (bookingKeys: string[], bookingDetails: BookingDetails): Promise<boolean> => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS') { alert("Acción no permitida."); return false; }
        if (bookingKeys.length === 0 || !bookingDetails.name.trim()) { alert("Datos de reserva inválidos."); return false; }
        try {
            for (let i = 0; i < bookingKeys.length; i += 100) {
                const chunk = bookingKeys.slice(i, i + 100);
                await runTransaction(db, async (transaction) => {
                    const bookingDocsRefs = chunk.map(key => doc(db, 'bookings', key));
                    const bookingDocsSnapshots = await Promise.all(bookingDocsRefs.map(ref => transaction.get(ref)));
                    for (const docSnapshot of bookingDocsSnapshots) {
                        if (docSnapshot.exists()) throw new Error(`Conflicto de reserva en ${docSnapshot.id}.`);
                    }
                    chunk.forEach(key => transaction.set(doc(db, 'bookings', key), bookingDetails));
                });
            }
            return true;
        } catch (e: any) {
            console.error("Error en la transacción de reserva:", e);
            alert(e.message || "No se pudo crear la reserva.");
            return false;
        }
    }, [userRole]);

    const handleDeleteBookingKeys = useCallback(async (keys: string[]): Promise<boolean> => {
        try {
            const batch = writeBatch(db);
            keys.forEach(key => batch.delete(doc(db, 'bookings', key)));
            await batch.commit();
            return true;
        } catch (error) {
            console.error("Error al eliminar reservas:", error);
            alert("Ocurrió un error al eliminar las reservas.");
            return false;
        }
    }, []);
    
    const handleUpdateShifts = useCallback(async (weekId: string, newShifts: ShiftAssignment) => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS' && userRole !== 'TRABAJADOR') { alert("Acción no permitida."); return; }
        if (userRole === 'TRABAJADOR') {
            const currentDoc = await getDoc(doc(db, 'shiftAssignments', weekId));
            if (currentDoc.exists()) {
                const currentData = currentDoc.data() as ShiftAssignment;
                if (JSON.stringify({ ...currentData, observations: '' }) !== JSON.stringify({ ...newShifts, observations: '' })) {
                    alert("No tiene permisos para modificar la configuración de turnos."); return;
                }
            }
        }
        try { await setDoc(doc(db, 'shiftAssignments', weekId), newShifts, { merge: true }); } catch (error) { console.error("Error al actualizar los turnos:", error); alert("No se pudieron guardar los cambios en los turnos."); }
    }, [userRole]);

    const handleToggleTask = useCallback(async (sourceId: string, taskId: string, collectionName: TaskSourceCollection) => {
        if (!user) return;
        const docRef = doc(db, collectionName, sourceId);
        try {
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) throw new Error("Documento no encontrado.");
                const currentData = docSnap.data() as (ShiftAssignment | SpecialEvent | Sponsor);
                const updatedTasks = currentData.tasks?.map(task => task.id === taskId ? { ...task, completed: !task.completed } : task);
                if (updatedTasks) transaction.update(docRef, { tasks: updatedTasks });
            });
        } catch (error) { console.error("Error al actualizar la tarea:", error); alert(`No se pudo actualizar el estado de la tarea.`); }
    }, [user]);

    const handleResetWeekShifts = useCallback(async (weekId: string) => {
        if (userRole !== 'ADMIN') { alert("Acción no permitida."); return; }
        try { await deleteDoc(doc(db, 'shiftAssignments', weekId)); } catch (error) { console.error("Error al resetear los turnos:", error); alert("No se pudo resetear la semana."); }
    }, [userRole]);

    const handleUpdateCleaningTime = useCallback(async (date: Date, startTime: string) => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS' && userRole !== 'TRABAJADOR') { alert("Acción no permitida."); return; }
        const docId = formatDateForBookingKey(date);
        try {
            if (startTime) await setDoc(doc(db, 'cleaningAssignments', docId), { startTime });
            else await deleteDoc(doc(db, 'cleaningAssignments', docId));
        } catch (error) { console.error("Error al actualizar la hora de limpieza:", error); alert("No se pudo guardar la hora de limpieza."); }
    }, [userRole]);

    const handleUpdateCleaningObservations = useCallback(async (weekId: string, observations: string) => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS' && userRole !== 'TRABAJADOR') { alert("Acción no permitida."); return; }
        try {
            if (observations.trim()) await setDoc(doc(db, 'cleaningObservations', weekId), { observations });
            else await deleteDoc(doc(db, 'cleaningObservations', weekId));
        } catch (error) { console.error("Error al actualizar las observaciones de limpieza:", error); alert("No se pudo guardar las observaciones."); }
    }, [userRole]);

    const handleSaveSpecialEvent = useCallback(async (eventData: SpecialEvent, originalEvent: SpecialEvent | null): Promise<boolean> => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS') {
            alert("Acción no permitida.");
            return false;
        }

        try {
            await runTransaction(db, async (transaction) => {
                const eventDocRef = doc(db, 'specialEvents', eventData.id);

                // --- Phase 0: Prepare key arrays (no DB interaction) ---
                const oldKeysToDelete: string[] = [];
                if (originalEvent?.startTime && originalEvent.endTime && originalEvent.spaceIds) {
                    const oldSlots = TIME_SLOTS.filter(t => t >= originalEvent.startTime! && t < originalEvent.endTime!);
                    for (let d = new Date(`${originalEvent.startDate}T00:00:00`); d <= new Date(`${originalEvent.endDate}T00:00:00`); d.setDate(d.getDate() + 1)) {
                        const dateStr = formatDateForBookingKey(d);
                        originalEvent.spaceIds!.forEach(spaceId => oldSlots.forEach(time => oldKeysToDelete.push(`${spaceId}-${dateStr}-${time}`)));
                    }
                }

                const newKeysToCreate: string[] = [];
                if (eventData.startTime && eventData.endTime && eventData.spaceIds) {
                    const newSlots = TIME_SLOTS.filter(t => t >= eventData.startTime! && t < eventData.endTime!);
                    for (let d = new Date(`${eventData.startDate}T00:00:00`); d <= new Date(`${eventData.endDate}T00:00:00`); d.setDate(d.getDate() + 1)) {
                        const dateStr = formatDateForBookingKey(d);
                        eventData.spaceIds!.forEach(spaceId => newSlots.forEach(time => newKeysToCreate.push(`${spaceId}-${dateStr}-${time}`)));
                    }
                }

                // --- Phase 1: READ from database ---
                const cancellationTasks: Task[] = [];
                const conflictingRefs: DocumentReference[] = [];

                if (newKeysToCreate.length > 0) {
                    const refsToRead = newKeysToCreate.map(key => doc(db, 'bookings', key));
                    const snapshots = await Promise.all(refsToRead.map(ref => transaction.get(ref)));
                    
                    const processedForCancellation = new Set<string>();

                    for (const snap of snapshots) {
                        if (snap.exists() && !oldKeysToDelete.includes(snap.id)) {
                            conflictingRefs.push(snap.ref);
                            const details = snap.data() as BookingDetails;
                            const keyParts = snap.id.split('-');
                            const compositeKey = `${details.name}-${keyParts.slice(-4, -1).join('-')}`;
                            
                            if (!processedForCancellation.has(compositeKey)) {
                                processedForCancellation.add(compositeKey);
                                const spaceName = SPACES.find(s => s.id === keyParts.slice(0, -4).join('-'))?.name || 'Espacio';
                                cancellationTasks.push({
                                    id: `cancel-${Date.now()}-${cancellationTasks.length}`,
                                    text: `URGENTE: Cancelar y notificar reserva "${details.name}" en ${spaceName} el ${keyParts.slice(-4, -1).join('-')} por evento.`,
                                    assignedTo: ['Manu'],
                                    completed: false
                                });
                            }
                        }
                    }
                }

                // --- Phase 2: WRITE to database ---
                oldKeysToDelete.forEach(key => transaction.delete(doc(db, 'bookings', key)));
                conflictingRefs.forEach(ref => transaction.delete(ref));

                const eventBookingDetails: BookingDetails = { name: `EVENTO: ${eventData.name}` };
                newKeysToCreate.forEach(key => transaction.set(doc(db, 'bookings', key), eventBookingDetails));

                const finalTasks = [...(eventData.tasks || []), ...cancellationTasks];
                const { id, ...eventToSave } = { ...eventData, tasks: finalTasks.length > 0 ? finalTasks : undefined };
                transaction.set(eventDocRef, eventToSave);
            });
            return true;
        } catch (e: any) {
            console.error("Error al guardar evento:", e);
            alert(e.message || "No se pudo guardar el evento.");
            return false;
        }
    }, [userRole]);

    const handleDeleteSpecialEvent = useCallback(async (eventToDelete: SpecialEvent) => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS') { alert("Acción no permitida."); return; }
        if (!window.confirm(`¿Seguro que desea eliminar el evento "${eventToDelete.name}"?`)) return;
        try {
            const batch = writeBatch(db);
            if (eventToDelete.startTime && eventToDelete.endTime && eventToDelete.spaceIds) {
                const slots = TIME_SLOTS.filter(t => t >= eventToDelete.startTime! && t < eventToDelete.endTime!);
                for (let d = new Date(eventToDelete.startDate); d <= new Date(eventToDelete.endDate); d.setDate(d.getDate() + 1)) {
                    const dateStr = formatDateForBookingKey(d);
                    eventToDelete.spaceIds.forEach(spaceId => slots.forEach(time => batch.delete(doc(db, 'bookings', `${spaceId}-${dateStr}-${time}`))));
                }
            }
            if (eventToDelete.posterUrl) {
                try { await deleteObject(ref(storage, eventToDelete.posterUrl)); } catch (e) { console.warn(`Failed to delete poster for event ${eventToDelete.id}.`); }
            }
            batch.delete(doc(db, 'specialEvents', eventToDelete.id));
            await batch.commit();
        } catch (e) { console.error("Error eliminando evento:", e); alert("No se pudo eliminar el evento."); }
    }, [userRole]);

    const handleUpdateSponsor = useCallback(async (sponsorId: string, newSponsorData: Sponsor) => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS') { alert("Acción no permitida."); return; }
        try {
            const { id, ...dataToSave } = newSponsorData;
            await setDoc(doc(db, 'sponsors', sponsorId), dataToSave, { merge: true });
        } catch (error) { console.error("Error al actualizar patrocinador:", error); alert("No se pudieron guardar los cambios."); }
    }, [userRole]);

    const handleAddSponsor = useCallback(async (sponsorName: string): Promise<string | null> => {
        if (userRole !== 'ADMIN' && userRole !== 'EVENTOS') { alert("Acción no permitida."); return null; }
        if (!sponsorName.trim()) { alert("El nombre no puede estar vacío."); return null; }
        try {
            const sponsorId = sponsorName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const sponsorRef = doc(db, 'sponsors', sponsorId);
            const docSnap = await getDoc(sponsorRef);
            if (docSnap.exists()) { alert("Ya existe un patrocinador con un nombre similar."); return null; }
            await setDoc(sponsorRef, { name: sponsorName.trim(), tasks: [], allianceDate: formatDateForBookingKey(new Date()) });
            return sponsorId;
        } catch (error) { console.error("Error al añadir patrocinador:", error); alert("No se pudo añadir el patrocinador."); return null; }
    }, [userRole]);

    return {
        bookings, shiftAssignments, cleaningAssignments, cleaningObservations,
        specialEvents, sponsors, myPendingTasks, handleAddBooking,
        handleDeleteBookingKeys, handleUpdateShifts, handleToggleTask,
        handleResetWeekShifts, handleUpdateCleaningTime, handleUpdateCleaningObservations,
        handleSaveSpecialEvent, handleDeleteSpecialEvent, handleUpdateSponsor, handleAddSponsor
    };
};