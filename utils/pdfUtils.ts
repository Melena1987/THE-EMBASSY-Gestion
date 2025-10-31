import type {
    Bookings,
    SpecialEvents,
    SpecialEvent,
    ShiftAssignment,
    CleaningAssignments,
    CleaningObservations,
    Task,
    Vacations,
} from '../types';
import { consolidateBookingsForDay } from './bookingUtils';
import { formatDateForBookingKey } from './dateUtils';

// Module-scoped variable to hold the jsPDF constructor.
let jsPDF: any = null;
// A promise to ensure libraries are loaded only once, handling concurrent requests.
let libsPromise: Promise<boolean> | null = null;

/**
 * Dynamically loads jsPDF and the jsPDF-AutoTable plugin.
 * The autotable plugin is loaded for its side-effect of attaching itself to the jsPDF prototype.
 * This is a more robust method than calling it as a separate function.
 * @returns A promise that resolves to true if libraries are loaded successfully.
 */
const loadLibraries = (): Promise<boolean> => {
    // If the promise already exists, return it to avoid re-fetching.
    if (libsPromise) {
        return libsPromise;
    }

    // Create the promise to load libraries.
    libsPromise = (async () => {
        try {
            // Dynamically import jspdf and get its default export (the constructor)
            const jspdfModule = await import('https://cdn.skypack.dev/jspdf@2.5.1');
            jsPDF = jspdfModule.default;

            // Dynamically import jspdf-autotable for its side-effect. It will patch the jsPDF prototype.
            await import('https://cdn.skypack.dev/jspdf-autotable@3.8.2');
            
            return true;
        } catch (error) {
            console.error("Failed to load PDF generation libraries:", error);
            alert("No se pudieron cargar las librerías para generar el PDF. Por favor, revise su conexión a internet e inténtelo de nuevo.");
            
            // Reset promise on failure to allow retrying.
            libsPromise = null; 
            return false;
        }
    })();

    return libsPromise;
};

/**
 * Ensures that the jsPDF and jsPDF-AutoTable libraries are loaded.
 * This is the public-facing function that components will call.
 * @returns A promise that resolves to true if libraries are loaded, false otherwise.
 */
export const ensurePdfLibsLoaded = loadLibraries;

/**
 * Generates a PDF of the monthly calendar view.
 * @param days An array of Date objects for the calendar grid.
 * @param currentMonth The month being displayed.
 * @param bookings The bookings data.
 * @param specialEvents The special events data.
 * @param vacations The vacations data.
 */
export const generateCalendarPDF = async (
    days: Date[],
    currentMonth: Date,
    bookings: Bookings,
    specialEvents: SpecialEvents,
    vacations: Vacations
): Promise<void> => {
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
            const dayYear = day.getFullYear().toString();
            const dayBookings = consolidateBookingsForDay(bookings, day);
            const eventsForDay = Object.values(specialEvents).filter(event => dayKey >= (event as SpecialEvent).startDate && dayKey <= (event as SpecialEvent).endDate);
            const vacationWorker = vacations[dayYear]?.dates[dayKey];

            let content = `${day.getDate()}\n`;

            if (vacationWorker) {
                content += `(VAC) ${vacationWorker}\n`;
            }

            eventsForDay.forEach(event => {
                content += `(E) ${(event as SpecialEvent).name}\n`;
            });
            dayBookings.forEach(booking => {
                content += `• ${booking.startTime} ${booking.details.name}\n`;
            });

            const styles: any = {
                valign: 'top',
                textColor: day.getMonth() === currentMonth.getMonth() ? [0, 0, 0] : [150, 150, 150],
                minCellHeight: 28,
                fontSize: 6,
            };

            if (day.getMonth() === currentMonth.getMonth()) {
                if (vacationWorker) {
                    styles.fillColor = [224, 204, 255]; // Light purple for vacations
                } else if (eventsForDay.length > 0) {
                    styles.fillColor = [255, 251, 204]; // Light yellow for special events
                } else {
                    styles.fillColor = [255, 255, 255]; // Default for current month
                }
            } else {
                styles.fillColor = [230, 230, 230]; // Default for other months
            }

            return {
                content,
                styles
            };
        });
        body.push(weekRow);
    });

    (doc as any).autoTable({
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

    (doc as any).autoTable({
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
        (doc as any).autoTable({
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
 * @param vacations The vacations data.
 */
export const generateAgendaPDF = async (
    weekNumber: number,
    year: number,
    weekDays: Date[],
    bookings: Bookings,
    shifts: ShiftAssignment,
    specialEvents: SpecialEvents,
    tasks: (Task & { type: string; sourceId: string; eventName?: string })[],
    vacations: Vacations
): Promise<void> => {
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(22);
    doc.text(`Agenda Semanal - Semana ${weekNumber} (${year})`, 14, 20);

    const body: any[] = [];
    weekDays.forEach((day, i) => {
        const dayKey = formatDateForBookingKey(day);
        const dayYear = day.getFullYear().toString();
        const dayBookings = consolidateBookingsForDay(bookings, day);
        const eventsForDay = Object.values(specialEvents).filter(event => dayKey >= (event as SpecialEvent).startDate && dayKey <= (event as SpecialEvent).endDate);
        
        const dailyShift = shifts.dailyOverrides?.[i] || {
            morning: { worker: shifts.morning, start: '09:00', end: '14:00', active: i !== 6 },
            evening: { worker: shifts.evening, start: '17:00', end: '23:00', active: i <= 4 }
        };

        const vacationWorker = vacations[dayYear]?.dates[dayKey];
        const isMorningVacation = dailyShift.morning.active && dailyShift.morning.worker === vacationWorker;
        const isEveningVacation = dailyShift.evening.active && dailyShift.evening.worker === vacationWorker;

        let shiftInfo = `M: ${dailyShift.morning.active ? (isMorningVacation ? `${dailyShift.morning.worker} (VAC)` : dailyShift.morning.worker) : 'Cerrado'} | T: ${dailyShift.evening.active ? (isEveningVacation ? `${dailyShift.evening.worker} (VAC)` : dailyShift.evening.worker) : 'Cerrado'}`;


        let content = `${shiftInfo}\n\n`;
        eventsForDay.forEach(e => {
            const event = e as SpecialEvent;
            content += `(E) ${event.name} (${event.startTime || ''} - ${event.endTime || ''})\n`;
        });
        dayBookings.forEach(b => {
            content += `• ${b.startTime}-${b.endTime}: ${b.details.name} (${b.space})\n`;
        });

        const styles: any = { valign: 'top', fontSize: 8, minCellHeight: 140 };
        if (vacationWorker) {
            styles.fillColor = [224, 204, 255]; // Light purple
        } else if (eventsForDay.length > 0) {
            styles.fillColor = [255, 251, 204]; // Light yellow
        }

        body.push({
            content,
            styles
        });
    });

    (doc as any).autoTable({
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
        (doc as any).autoTable({
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

    (doc as any).autoTable({
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

/**
 * Generates a PDF summary of vacation days for a specific month.
 * @param selectedDate A date within the desired month.
 * @param vacations The complete vacation data.
 */
export const generateVacationPDF = async (
    selectedDate: Date,
    vacations: Vacations
): Promise<void> => {
    const doc = new jsPDF();
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth(); // 0-indexed
    const monthName = selectedDate.toLocaleString('es-ES', { month: 'long' });
    const monthNameCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    doc.setFontSize(18);
    doc.text(`Resumen de Vacaciones - ${monthNameCapitalized} ${year}`, 14, 20);

    const workersToReport = ['Olga', 'Dani'];
    const yearVacations = vacations[year.toString()]?.dates || {};

    const body: any[] = [];

    workersToReport.forEach(worker => {
        const totalAnnualDays = Object.values(yearVacations).filter(name => name === worker).length;

        const monthDays = Object.keys(yearVacations)
            .filter(dateStr => {
                const vacationDate = new Date(`${dateStr}T00:00:00`);
                return yearVacations[dateStr] === worker && vacationDate.getFullYear() === year && vacationDate.getMonth() === month;
            })
            .map(dateStr => new Date(`${dateStr}T00:00:00`).getDate())
            .sort((a, b) => a - b);

        const totalMonthDays = monthDays.length;

        body.push([
            worker,
            monthDays.join(', ') || 'Ninguno',
            totalMonthDays.toString(),
            `${totalAnnualDays} / 30`
        ]);
    });

    (doc as any).autoTable({
        head: [['Trabajador', `Días en ${monthNameCapitalized}`, 'Total Mes', 'Total Anual']],
        body,
        startY: 30,
        headStyles: { fillColor: [108, 92, 231] }, // Purple color
        theme: 'grid',
    });

    doc.save(`vacaciones-${year}-${month + 1}.pdf`);
};
