import type {
    Bookings,
    SpecialEvents,
    SpecialEvent,
    ShiftAssignment,
    CleaningAssignments,
    CleaningObservations,
    Task,
} from './types';
import { consolidateBookingsForDay } from './bookingUtils';
import { formatDateForBookingKey } from './dateUtils';

// Type declarations for jsPDF and jsPDF-AutoTable, which are loaded from a CDN.
// This prevents TypeScript errors when using the globally available libraries.
declare const jspdf: any;
declare const autoTable: any;

let libsLoaded = false;

// Dynamically loads a script from a given source URL.
const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Script load error for ${src}`));
        document.body.appendChild(script);
    });
};

/**
 * Ensures that the jsPDF and jsPDF-AutoTable libraries are loaded.
 * It loads them from a CDN only once and then caches the result.
 * @returns A promise that resolves to true if libraries are loaded, false otherwise.
 */
export const ensurePdfLibsLoaded = async (): Promise<boolean> => {
    if (libsLoaded) return true;
    try {
        await Promise.all([
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf-autotable.min.js')
        ]);
        libsLoaded = true;
        return true;
    } catch (error) {
        console.error("Failed to load PDF generation libraries:", error);
        alert("No se pudieron cargar las librerías para generar el PDF. Por favor, revise su conexión a internet e inténtelo de nuevo.");
        return false;
    }
};

/**
 * Generates a PDF of the monthly calendar view.
 * @param days An array of Date objects for the calendar grid.
 * @param currentMonth The month being displayed.
 * @param bookings The bookings data.
 * @param specialEvents The special events data.
 */
export const generateCalendarPDF = async (
    days: Date[],
    currentMonth: Date,
    bookings: Bookings,
    specialEvents: SpecialEvents
): Promise<void> => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const monthName = currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    doc.setFontSize(22);
    doc.text(`Calendario de ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`, 14, 20);

    const head = [['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']];
    const body: any[] = [];
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
    }

    weeks.forEach(week => {
        const weekRow = week.map(day => {
            const dayKey = formatDateForBookingKey(day);
            const dayBookings = consolidateBookingsForDay(bookings, day);
            const eventsForDay = Object.values(specialEvents).filter(event => dayKey >= (event as SpecialEvent).startDate && dayKey <= (event as SpecialEvent).endDate);

            let content = `${day.getDate()}\n`;
            eventsForDay.forEach(event => {
                content += `⭐ ${(event as SpecialEvent).name}\n`;
            });
            dayBookings.forEach(booking => {
                content += `• ${booking.startTime} ${booking.details.name}\n`;
            });

            return {
                content,
                styles: {
                    valign: 'top',
                    fillColor: day.getMonth() === currentMonth.getMonth() ? [255, 255, 255] : [230, 230, 230],
                    textColor: day.getMonth() === currentMonth.getMonth() ? [0, 0, 0] : [150, 150, 150],
                    minCellHeight: 28,
                    fontSize: 6,
                }
            };
        });
        body.push(weekRow);
    });

    autoTable(doc, {
        head,
        body,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [255, 165, 0], textColor: [255, 255, 255] },
    });

    doc.save(`calendario-${currentMonth.getFullYear()}-${currentMonth.getMonth() + 1}.pdf`);
};

/**
 * Generates a PDF of the weekly shift schedule.
 * @param weekNumber The week number.
 * @param year The year.
 * @param weekDays An array of Date objects for the week.
 * @param shifts The shift assignment for the week.
 * @param tasks An array of tasks for the week.
 */
export const generateShiftsPDF = async (
    weekNumber: number,
    year: number,
    weekDays: Date[],
    shifts: ShiftAssignment,
    tasks: (Task & { type: string; sourceId: string; eventName?: string })[]
): Promise<void> => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Horario de Turnos - Semana ${weekNumber} (${year})`, 14, 20);

    const head = [['Día', 'Fecha', 'Turnos']];
    const body = weekDays.map((day, i) => {
        const dailyShift = shifts.dailyOverrides?.[i] || {
            morning: { worker: shifts.morning, start: '09:00', end: '14:00', active: i !== 6 },
            evening: { worker: shifts.evening, start: '17:00', end: '23:00', active: i <= 4 }
        };

        let shiftInfo = '';
        if (dailyShift.morning.active) shiftInfo += `Mañana: ${dailyShift.morning.worker} (${dailyShift.morning.start} - ${dailyShift.morning.end})\n`;
        if (dailyShift.evening.active) shiftInfo += `Tarde: ${dailyShift.evening.worker} (${dailyShift.evening.start} - ${dailyShift.evening.end})`;
        if (!dailyShift.morning.active && !dailyShift.evening.active) shiftInfo = 'Cerrado';
        
        return [
            day.toLocaleDateString('es-ES', { weekday: 'long' }),
            day.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' }),
            shiftInfo
        ];
    });

    autoTable(doc, {
        head,
        body,
        startY: 30,
        headStyles: { fillColor: [0, 123, 255] },
        columnStyles: { 2: { cellWidth: 'auto' } },
    });
    
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    
    if (tasks.length > 0) {
        doc.setFontSize(14);
        doc.text('Tareas de la Semana', 14, finalY);
        finalY += 7;
        const taskBody = tasks.map(t => [
            t.completed ? 'Sí' : 'No',
            t.text,
            Array.isArray(t.assignedTo) ? t.assignedTo.join(', ') : t.assignedTo
        ]);
        autoTable(doc, {
            head: [['Completada', 'Tarea', 'Asignado a']],
            body: taskBody,
            startY: finalY,
            headStyles: { fillColor: [40, 167, 69] },
        });
        finalY = (doc as any).lastAutoTable.finalY + 10;
    }

    if (shifts.observations) {
        doc.setFontSize(14);
        doc.text('Observaciones', 14, finalY);
        finalY += 7;
        doc.setFontSize(10);
        doc.text(shifts.observations, 14, finalY, { maxWidth: 180 });
    }

    doc.save(`turnos-semana-${weekNumber}-${year}.pdf`);
};

/**
 * Generates a PDF of the weekly agenda, including events and bookings.
 * @param weekNumber The week number.
 * @param year The year.
 * @param weekDays An array of Date objects for the week.
 * @param bookings The bookings data.
 * @param shifts The shift assignment for the week.
 * @param specialEvents The special events data.
 * @param tasks An array of tasks for the week.
 */
export const generateAgendaPDF = async (
    weekNumber: number,
    year: number,
    weekDays: Date[],
    bookings: Bookings,
    shifts: ShiftAssignment,
    specialEvents: SpecialEvents,
    tasks: (Task & { type: string; sourceId: string; eventName?: string })[]
): Promise<void> => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(22);
    doc.text(`Agenda Semanal - Semana ${weekNumber} (${year})`, 14, 20);

    const body: any[] = [];
    weekDays.forEach((day, i) => {
        const dayKey = formatDateForBookingKey(day);
        const dayBookings = consolidateBookingsForDay(bookings, day);
        const eventsForDay = Object.values(specialEvents).filter(event => dayKey >= (event as SpecialEvent).startDate && dayKey <= (event as SpecialEvent).endDate);
        
        const dailyShift = shifts.dailyOverrides?.[i] || {
            morning: { worker: shifts.morning, start: '09:00', end: '14:00', active: i !== 6 },
            evening: { worker: shifts.evening, start: '17:00', end: '23:00', active: i <= 4 }
        };
        let shiftInfo = `M: ${dailyShift.morning.active ? dailyShift.morning.worker : 'Cerrado'} | T: ${dailyShift.evening.active ? dailyShift.evening.worker : 'Cerrado'}`;

        let content = `${shiftInfo}\n\n`;
        eventsForDay.forEach(e => {
            const event = e as SpecialEvent;
            content += `⭐ ${event.name} (${event.startTime || ''} - ${event.endTime || ''})\n`;
        });
        dayBookings.forEach(b => {
            content += `• ${b.startTime}-${b.endTime}: ${b.details.name} (${b.space})\n`;
        });

        body.push({
            content,
            styles: { valign: 'top', fontSize: 8, minCellHeight: 140 }
        });
    });

    autoTable(doc, {
        head: [weekDays.map(d => d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }))],
        body: [body],
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [255, 165, 0], textColor: [255, 255, 255] },
    });

    if (tasks.length > 0) {
        doc.addPage('portrait');
        doc.setFontSize(18);
        doc.text('Tareas de la Semana', 14, 20);
        const taskBody = tasks.map(t => [
            t.completed ? 'Sí' : 'No',
            t.text,
            Array.isArray(t.assignedTo) ? t.assignedTo.join(', ') : t.assignedTo
        ]);
        autoTable(doc, {
            head: [['Completada', 'Tarea', 'Asignado a']],
            body: taskBody,
            startY: 30,
            headStyles: { fillColor: [40, 167, 69] },
        });
    }

    doc.save(`agenda-semana-${weekNumber}-${year}.pdf`);
};

/**
 * Generates a PDF of the weekly cleaning schedule.
 * @param weekNumber The week number.
 * @param year The year.
 * @param weekDays An array of Date objects for the week.
 * @param cleaningAssignments The cleaning assignments data.
 * @param observations The cleaning observations for the week.
 */
export const generateCleaningPDF = async (
    weekNumber: number,
    year: number,
    weekDays: Date[],
    cleaningAssignments: CleaningAssignments,
    observations: CleaningObservations[string] | undefined
): Promise<void> => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(`Agenda de Limpieza - Semana ${weekNumber} (${year})`, 14, 20);

    const head = [['Día', 'Fecha', 'Hora de Inicio']];
    const body = weekDays.map(day => {
        const dayKey = formatDateForBookingKey(day);
        const assignment = cleaningAssignments[dayKey];
        return [
            day.toLocaleDateString('es-ES', { weekday: 'long' }),
            day.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' }),
            assignment?.startTime || 'No asignada'
        ];
    });

    autoTable(doc, {
        head,
        body,
        startY: 30,
        headStyles: { fillColor: [23, 162, 184] },
    });

    if (observations?.observations) {
        let finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(14);
        doc.text('Observaciones de Limpieza', 14, finalY);
        finalY += 7;
        doc.setFontSize(10);
        doc.text(observations.observations, 14, finalY, { maxWidth: 180 });
    }

    doc.save(`limpieza-semana-${weekNumber}-${year}.pdf`);
};
