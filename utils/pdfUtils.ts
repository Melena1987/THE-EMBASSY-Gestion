import type { ShiftAssignment, Bookings, ConsolidatedBooking, CleaningAssignments, CleaningObservations, SpecialEvents, SpecialEvent, Task } from '../types';
import { getDefaultDailyShift } from './shiftUtils';
import { consolidateBookingsForDay } from './bookingUtils';
import { formatDateForBookingKey } from './dateUtils';

// A global map to store promises for script loading, preventing duplicate script tags.
const scriptPromises: Record<string, Promise<void>> = {};

// Color constants for PDF generation
const ORANGE = { r: 0.96, g: 0.45, b: 0.09 };
const DARK_BLUE = { r: 0.047, g: 0.102, b: 0.18 };
const WHITE = { r: 1, g: 1, b: 1 };
const BLACK = { r: 0, g: 0, b: 0 };
const DARK_GRAY = { r: 0.2, g: 0.2, b: 0.2 };
const MEDIUM_GRAY = { r: 0.5, g: 0.5, b: 0.5 };
const LIGHT_GRAY = { r: 0.8, g: 0.8, b: 0.8 };
const PURPLE = { r: 0.5, g: 0.2, b: 0.8 };

/**
 * Dynamically loads a script from a given source.
 * It ensures that the same script is not loaded multiple times.
 * @param src The URL of the script to load.
 * @returns A promise that resolves when the script is loaded.
 */
const loadScript = (src: string): Promise<void> => {
    if (scriptPromises[src]) {
        return scriptPromises[src];
    }
    
    scriptPromises[src] = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => {
            delete scriptPromises[src]; // Allow retrying on failure
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.head.appendChild(script);
    });
    return scriptPromises[src];
};

/**
 * Ensures that the pdf-lib library is loaded into the window.
 * It loads it from a CDN if it is not already present.
 * @returns A promise that resolves to true if the library is loaded, false otherwise.
 */
export const ensurePdfLibsLoaded = async (): Promise<boolean> => {
    try {
        if (typeof (window as any).PDFLib?.PDFDocument?.create !== 'function') {
            await loadScript("https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js");
        }
        return typeof (window as any).PDFLib?.PDFDocument?.create === 'function';
    } catch (error) {
        console.error("Error loading PDF library:", error);
        alert("No se pudo cargar la librería para generar el PDF. Revise su conexión a internet y vuelva a intentarlo.");
        return false;
    }
};

/**
 * Sanitizes text to remove characters unsupported by pdf-lib's standard fonts (WinAnsi encoding).
 * @param text The input string to sanitize.
 * @returns The sanitized string.
 */
const sanitizeText = (text: string | undefined | null): string => {
    if (!text) return '';
    // Replaces smart quotes, em-dashes, and newlines with their ASCII equivalents or spaces.
    return String(text).replace(/[’‘“”—\r\n]/g, (char) => {
        switch (char) {
            case '’': case '‘': return "'";
            case '“': case '”': return '"';
            case '—': return '-';
            case '\r': case '\n': return ' ';
            default: return '';
        }
    });
};

type CombinedTaskForPDF = (Task & {
    type: 'shift';
    sourceId: string;
}) | (Task & {
    type: 'event';
    sourceId: string;
    eventName: string;
});

/**
 * A helper function to split text into lines based on a max width.
 * This is used to estimate the height of a wrapped text block in a PDF.
 * @param text The text to wrap.
 * @param font The PDFFont object.
 * @param size The font size.
 * @param maxWidth The maximum width for a line.
 * @returns An array of strings, where each string is a line of text.
 */
const getLinesOfText = (text: string, font: any, size: number, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    if (words.length === 0) return [];
    
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = font.widthOfTextAtSize(`${currentLine} ${word}`, size);
        if (width < maxWidth) {
            currentLine += ` ${word}`;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
};

/**
 * Generates a PDF document for the weekly shift schedule.
 * Includes daily shifts, weekly tasks, and observations.
 * @param weekNumber The week number.
 * @param year The year.
 * @param weekDays An array of Date objects for the week.
 * @param shifts The shift assignment object for the week.
 * @param allTasks An array of all tasks (shift and event) for the week.
 */
export const generateShiftsPDF = async (weekNumber: number, year: number, weekDays: Date[], shifts: ShiftAssignment, allTasks: CombinedTaskForPDF[]) => {
    const { PDFDocument, rgb, StandardFonts } = (window as any).PDFLib;
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    let y = height - margin;

    const addNewPage = () => {
        page = pdfDoc.addPage();
        y = height - margin;
        page.drawText(`Horario Semanal - Semana ${weekNumber} (cont.)`, { x: margin, y: y, font: fontBold, size: 18, color: ORANGE });
        y -= 30;
    };

    page.drawText(`Horario Semanal - Semana ${weekNumber}`, { x: margin, y: y, font: fontBold, size: 24, color: ORANGE });
    y -= 20;
    const weekRange = `${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    page.drawText(sanitizeText(weekRange), { x: margin, y: y, font: font, size: 14, color: MEDIUM_GRAY });
    y -= 40;

    const tableTop = y;
    const colWidths = [120, 100, 150, 150];
    const headerTexts = ['Día', 'Turno', 'Personal', 'Horario'];

    page.drawRectangle({ x: margin, y: y - 25, width: colWidths.reduce((a, b) => a + b, 0), height: 25, color: DARK_BLUE });
    let currentX = margin;
    headerTexts.forEach((text, i) => {
        page.drawText(text, { x: currentX + 10, y: y - 17, font: fontBold, size: 12, color: WHITE });
        currentX += colWidths[i];
    });
    y -= 25;

    const rowHeight = 35;
    weekDays.forEach((day, dayIndex) => {
        const effectiveShifts = shifts.dailyOverrides?.[dayIndex] || getDefaultDailyShift(dayIndex, shifts.morning, shifts.evening);
        const dayShifts = [{ turno: 'Mañana', details: effectiveShifts.morning }, { turno: 'Tarde', details: effectiveShifts.evening }];

        dayShifts.forEach((shiftInfo, shiftIndex) => {
            page.drawRectangle({ x: margin, y: y - rowHeight, width: colWidths.reduce((a, b) => a + b, 0), height: rowHeight, color: (dayIndex * 2 + shiftIndex) % 2 !== 0 ? rgb(0.9, 0.93, 0.98) : rgb(0.98, 0.95, 0.85) });
            if (shiftIndex === 0) {
                 page.drawText(sanitizeText(day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })), { x: margin + 10, y: y - (rowHeight / 2) - 10, font: fontBold, size: 11, color: BLACK });
            }
            const rowData = [shiftInfo.turno, shiftInfo.details.active ? shiftInfo.details.worker : 'Cerrado', shiftInfo.details.active ? `${shiftInfo.details.start} - ${shiftInfo.details.end}` : '-'];
            let currentX = margin + colWidths[0];
            rowData.forEach((text, i) => {
                page.drawText(sanitizeText(text), { x: currentX + 10, y: y - (rowHeight / 2) - 5, font: font, size: 11, color: BLACK });
                currentX += colWidths[i + 1];
            });
            y -= rowHeight;
        });
    });

    const tableBottom = y;
    currentX = margin;
    [...colWidths, 0].forEach(w => {
        page.drawLine({ start: { x: currentX, y: tableTop }, end: { x: currentX, y: tableBottom }, thickness: 1, color: LIGHT_GRAY });
        currentX += w;
    });
    y -= 25;
    
    const uncompletedTasks = allTasks.filter(task => !task.completed);
    if (uncompletedTasks.length > 0) {
        if (y < margin + 40) addNewPage();
        y -= 10;
        page.drawText('Tareas de la Semana:', { x: margin, y: y, font: fontBold, size: 16, color: ORANGE });
        y -= 20;

        uncompletedTasks.forEach(task => {
            const isEventTask = task.type === 'event';
            const fullText = `${isEventTask ? `[${task.eventName}] ` : ''}${task.text} (Asignado a: ${Array.isArray(task.assignedTo) ? task.assignedTo.join(', ') : task.assignedTo})`;
            const lines = getLinesOfText(sanitizeText(fullText), font, 10, width - margin * 2 - 20);
            if (y < margin + lines.length * 12 + 6) addNewPage();
            
            page.drawRectangle({ x: margin, y: y + 1, width: 10, height: 10, borderWidth: 1, borderColor: isEventTask ? PURPLE : BLACK });
            lines.forEach((line, index) => page.drawText(line, { x: margin + 15, y: y - (index * 12), font: font, size: 10, color: isEventTask ? PURPLE : BLACK }));
            y -= lines.length * 12 + 6;
        });
        y -= 15;
    }

    if (shifts.observations) {
        const lines = getLinesOfText(sanitizeText(shifts.observations), font, 12, width - 2 * margin);
        if (y < margin + 16 + 20 + lines.length * 15) addNewPage();
        y -= 10;
        page.drawText('Observaciones:', { x: margin, y: y, font: fontBold, size: 16, color: ORANGE });
        y -= 20;
        page.drawText(sanitizeText(shifts.observations), { x: margin, y: y, font: font, size: 12, lineHeight: 15, color: DARK_GRAY, maxWidth: width - 2 * margin });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Horario_Semana_${weekNumber}_${year}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
};

/**
 * Generates a PDF document for the weekly agenda.
 * Includes daily bookings, special events, weekly tasks, and observations.
 * @param weekNumber The week number.
 * @param year The year.
 * @param weekDays An array of Date objects for the week.
 * @param bookings The global bookings object.
 * @param shifts The shift assignment object for the week.
 * @param specialEvents The global special events object.
 * @param allTasks An array of all tasks for the week.
 */
export const generateAgendaPDF = async (
    weekNumber: number, year: number, weekDays: Date[], bookings: Bookings, shifts: ShiftAssignment, specialEvents: SpecialEvents, allTasks: CombinedTaskForPDF[]
) => {
    const { PDFDocument, rgb, StandardFonts } = (window as any).PDFLib;
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const margin = 50;
    let y = height - margin;

    const addNewPage = () => {
        page = pdfDoc.addPage();
        y = height - margin;
        page.drawText(`Agenda Semanal - Semana ${weekNumber} (cont.)`, { x: margin, y: y, font: fontBold, size: 18, color: ORANGE });
        y -= 30;
    };

    page.drawText(`Agenda Semanal - Semana ${weekNumber}`, { x: margin, y: y, font: fontBold, size: 24, color: ORANGE });
    y -= 20;
    page.drawText(sanitizeText(`${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`), { x: margin, y: y, font: font, size: 14, color: MEDIUM_GRAY });
    y -= 25;

    const eventsThisWeek = Object.values(specialEvents).filter(event => (event.startDate <= formatDateForBookingKey(weekDays[6]) && event.endDate >= formatDateForBookingKey(weekDays[0])));
    if (eventsThisWeek.length > 0) {
        y -= 10;
        page.drawText('Eventos Especiales de la Semana:', { x: margin, y: y, font: fontBold, size: 14, color: PURPLE });
        y -= 20;
        eventsThisWeek.forEach(event => {
            const dateRange = event.startDate === event.endDate ? new Date(`${event.startDate}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : `${new Date(`${event.startDate}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${new Date(`${event.endDate}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
            page.drawText(sanitizeText(`- ${event.name} (${dateRange})`), { x: margin + 10, y: y, font: font, size: 10, color: DARK_GRAY });
            y -= 15;
        });
    }
    y -= 20;

    weekDays.forEach((day, index) => {
        const dayBookings = consolidateBookingsForDay(bookings, day);
        const dayKey = formatDateForBookingKey(day);
        const eventsForDay = Object.values(specialEvents).filter((event: SpecialEvent) => dayKey >= event.startDate && dayKey <= event.endDate);
        
        const maxWidth = width - margin * 2 - 10;
        let neededHeight = 40;
        eventsForDay.forEach(event => neededHeight += getLinesOfText(sanitizeText(`EVENTO: ${event.name}`), fontBold, 9, maxWidth).length * fontBold.heightAtSize(9) * 1.2 + 5);
        dayBookings.forEach(booking => neededHeight += getLinesOfText(sanitizeText(`${booking.startTime}-${booking.endTime}: ${booking.details.name} (${booking.space})`), font, 9, maxWidth).length * font.heightAtSize(9) * 1.2 + 5);
        if (eventsForDay.length === 0 && dayBookings.length === 0) neededHeight += 12;

        if (y < margin + neededHeight) addNewPage();

        if (index > 0) {
            y -= 10;
            page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 0.5, color: LIGHT_GRAY });
        }
        
        page.drawText(sanitizeText(day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })), { x: margin, y: y, font: fontBold, size: 14, color: DARK_BLUE });
        y -= 22;

        eventsForDay.forEach(event => {
            const lines = getLinesOfText(sanitizeText(`EVENTO: ${event.name}`), fontBold, 9, maxWidth);
            page.drawText(lines.join('\n'), { x: margin + 10, y: y, font: fontBold, size: 9, color: PURPLE, lineHeight: fontBold.heightAtSize(9) * 1.2 });
            y -= lines.length * fontBold.heightAtSize(9) * 1.2 + 8;
        });
        
        if (dayBookings.length > 0) {
            dayBookings.forEach(booking => {
                const lines = getLinesOfText(sanitizeText(`${booking.startTime}-${booking.endTime}: ${booking.details.name} (${booking.space})`), font, 9, maxWidth);
                page.drawText(lines.join('\n'), { x: margin + 10, y: y, font: font, size: 9, color: DARK_GRAY, lineHeight: font.heightAtSize(9) * 1.2 });
                y -= lines.length * font.heightAtSize(9) * 1.2 + 8;
            });
        } else if (eventsForDay.length === 0) {
             page.drawText('Sin reservas', { x: margin + 10, y: y, font: font, size: 9, color: MEDIUM_GRAY });
             y -= 12;
        }
    });

    y -= 40;

    const uncompletedTasks = allTasks.filter(task => !task.completed);
    if (uncompletedTasks.length > 0) {
        if (y < margin + 40) addNewPage();
        page.drawText('Tareas de la Semana:', { x: margin, y: y, font: fontBold, size: 16, color: ORANGE });
        y -= 25;
        uncompletedTasks.forEach(task => {
            const fullText = `${task.type === 'event' ? `[${task.eventName}] ` : ''}${task.text} (Asignado a: ${Array.isArray(task.assignedTo) ? task.assignedTo.join(', ') : task.assignedTo})`;
            const lines = getLinesOfText(sanitizeText(fullText), font, 10, width - margin * 2 - 20);
            if (y < margin + lines.length * 12 + 8) addNewPage();
            
            page.drawRectangle({ x: margin, y: y + 1, width: 10, height: 10, borderWidth: 1, borderColor: task.type === 'event' ? PURPLE : BLACK });
            lines.forEach((line, index) => page.drawText(line, { x: margin + 15, y: y - (index * 12), font: font, size: 10, color: task.type === 'event' ? PURPLE : BLACK }));
            y -= lines.length * 12 + 8;
        });
        y -= 15;
    }

    if (shifts.observations) {
        const lines = getLinesOfText(sanitizeText(shifts.observations), font, 10, width - 2 * margin);
        if (y < margin + 16 + 20 + lines.length * 13) addNewPage();
        y -= 10;
        page.drawText('Observaciones:', { x: margin, y: y, font: fontBold, size: 16, color: ORANGE });
        y -= 20;
        page.drawText(sanitizeText(shifts.observations), { x: margin, y: y, font: font, size: 10, lineHeight: 13, color: DARK_GRAY, maxWidth: width - 2 * margin });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Agenda_Semana_${weekNumber}_${year}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
};

/**
 * Generates a PDF calendar for a given month.
 * Displays day numbers, special events, and bookings.
 * @param days An array of 42 Date objects representing the calendar grid.
 * @param month The month to generate the calendar for.
 * @param bookings The global bookings object.
 * @param specialEvents The global special events object.
 */
export const generateCalendarPDF = async (days: Date[], month: Date, bookings: Bookings, specialEvents: SpecialEvents) => {
    const { PDFDocument, rgb, StandardFonts } = (window as any).PDFLib;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([841.89, 595.28]);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 40;
    let y = height - margin;
    
    page.drawText(sanitizeText(month.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()), { x: margin, y: y, font: fontBold, size: 28, color: ORANGE });
    y -= 40;

    const colWidth = (width - 2 * margin) / 7;
    ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'].forEach((text, i) => {
        page.drawText(text, { x: margin + i * colWidth + 5, y: y - 15, font: fontBold, size: 10, color: DARK_GRAY });
    });
    y -= 20;

    const numWeeks = Math.ceil(days.length / 7);
    const rowHeight = (y - margin) / numWeeks;

    for (let week = 0; week < numWeeks; week++) {
        for (let day = 0; day < 7; day++) {
            const date = days[week * 7 + day];
            if (!date) continue;

            const isCurrentMonth = date.getMonth() === month.getMonth();
            const cellX = margin + day * colWidth;
            const cellY = y - week * rowHeight;

            page.drawRectangle({ x: cellX, y: cellY - rowHeight, width: colWidth, height: rowHeight, borderColor: LIGHT_GRAY, borderWidth: 0.5 });
            page.drawText(date.getDate().toString(), { x: cellX + 5, y: cellY - 15, font: fontBold, size: 12, color: isCurrentMonth ? BLACK : MEDIUM_GRAY });

            const dayKey = formatDateForBookingKey(date);
            const eventsForDay = Object.values(specialEvents).filter((event: SpecialEvent) => dayKey >= event.startDate && dayKey <= event.endDate);
            const dayBookings = consolidateBookingsForDay(bookings, date);

            const itemsToDisplay = [...eventsForDay.map(e => ({ type: 'event', data: e })), ...dayBookings.map(b => ({ type: 'booking', data: b }))];
            let contentY = cellY - 30;

            itemsToDisplay.slice(0, 4).forEach(item => {
                if (contentY > cellY - rowHeight + 10) {
                    const { text, options } = item.type === 'event' 
                        ? { text: `* ${(item.data as SpecialEvent).name}`, options: { font: fontBold, color: isCurrentMonth ? PURPLE : rgb(0.7, 0.6, 0.8) } }
                        : { text: `${(item.data as ConsolidatedBooking).startTime} ${(item.data as ConsolidatedBooking).details.name}`, options: { font, color: isCurrentMonth ? DARK_GRAY : MEDIUM_GRAY } };
                    
                    page.drawText(sanitizeText(text), { x: cellX + 5, y: contentY, size: 7, maxWidth: colWidth - 10, ...options });
                    contentY -= 9;
                }
            });

            if (itemsToDisplay.length > 4 && contentY > cellY - rowHeight + 10) {
                page.drawText('...', { x: cellX + 5, y: contentY, font: font, size: 8, color: MEDIUM_GRAY });
            }
        }
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Calendario_${month.toLocaleString('es-ES', {month: 'long', year: 'numeric'})}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
};

/**
 * Generates a PDF document for the weekly cleaning schedule.
 * @param weekNumber The week number.
 * @param year The year.
 * @param weekDays An array of Date objects for the week.
 * @param cleaningAssignments The cleaning assignments object.
 * @param cleaningObservation The cleaning observations for the week.
 */
export const generateCleaningPDF = async (weekNumber: number, year: number, weekDays: Date[], cleaningAssignments: CleaningAssignments, cleaningObservation?: { observations: string }) => {
    const { PDFDocument, rgb, StandardFonts } = (window as any).PDFLib;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    let y = height - margin;

    page.drawText(`Agenda de Limpieza - Semana ${weekNumber}`, { x: margin, y: y, font: fontBold, size: 24, color: ORANGE });
    y -= 20;
    page.drawText(sanitizeText(`${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`), { x: margin, y: y, font: font, size: 14, color: MEDIUM_GRAY });
    y -= 40;

    const colWidths = [200, 200];
    page.drawRectangle({ x: margin, y: y - 25, width: colWidths.reduce((a, b) => a + b, 0), height: 25, color: DARK_BLUE });
    ['Día', 'Hora de Inicio'].forEach((text, i) => {
        page.drawText(text, { x: margin + (colWidths.slice(0, i).reduce((a, b) => a + b, 0)) + 10, y: y - 17, font: fontBold, size: 12, color: WHITE });
    });
    y -= 25;

    weekDays.forEach((day, dayIndex) => {
        const assignment = cleaningAssignments[formatDateForBookingKey(day)];
        page.drawRectangle({ x: margin, y: y - 35, width: colWidths.reduce((a, b) => a + b, 0), height: 35, color: dayIndex % 2 === 0 ? rgb(0.9, 0.93, 0.98) : WHITE });
        page.drawText(sanitizeText(day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'numeric' })), { x: margin + 10, y: y - 22.5, font: fontBold, size: 11, color: BLACK });
        page.drawText(assignment?.startTime || 'Sin asignar', { x: margin + colWidths[0] + 10, y: y - 22.5, font: font, size: 11, color: assignment?.startTime ? BLACK : MEDIUM_GRAY });
        y -= 35;
    });

    if (cleaningObservation?.observations) {
        y -= 25;
        page.drawText('Observaciones:', { x: margin, y: y, font: fontBold, size: 16, color: ORANGE });
        y -= 20;
        page.drawText(sanitizeText(cleaningObservation.observations), { x: margin, y: y, font: font, size: 12, lineHeight: 15, color: DARK_GRAY, maxWidth: width - 2 * margin });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Limpieza_Semana_${weekNumber}_${year}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
};
