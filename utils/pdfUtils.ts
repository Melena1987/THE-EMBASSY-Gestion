


import type { ShiftAssignment, Bookings, ConsolidatedBooking, CleaningAssignments, CleaningObservations, SpecialEvents, SpecialEvent, Task } from '../types';
import { getDefaultDailyShift } from './shiftUtils';
import { consolidateBookingsForDay } from './bookingUtils';
import { formatDateForBookingKey } from './dateUtils';

// A global map to store promises for script loading, preventing duplicate script tags.
const scriptPromises: Record<string, Promise<void>> = {};

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
        page.drawText(`Horario Semanal - Semana ${weekNumber} (cont.)`, { x: margin, y: y, font: fontBold, size: 18, color: rgb(0.96, 0.45, 0.09) });
        y -= 30;
    };

    // Title
    page.drawText(`Horario Semanal - Semana ${weekNumber}`, {
        x: margin,
        y: y,
        font: fontBold,
        size: 24,
        color: rgb(0.96, 0.45, 0.09), // Orange
    });
    y -= 20;

    const weekRange = `${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    page.drawText(weekRange, {
        x: margin,
        y: y,
        font: font,
        size: 14,
        color: rgb(0.5, 0.5, 0.5),
    });
    y -= 40;

    // Table Header
    const tableTop = y;
    const colWidths = [120, 100, 150, 150];
    const headerTexts = ['Día', 'Turno', 'Personal', 'Horario'];

    page.drawRectangle({
        x: margin,
        y: y - 25,
        width: colWidths.reduce((a, b) => a + b, 0),
        height: 25,
        color: rgb(0.047, 0.102, 0.18), // Dark blue
    });

    let currentX = margin;
    headerTexts.forEach((text, i) => {
        page.drawText(text, {
            x: currentX + 10,
            y: y - 17,
            font: fontBold,
            size: 12,
            color: rgb(1, 1, 1),
        });
        currentX += colWidths[i];
    });
    y -= 25;

    // Table Body
    const rowHeight = 35;
    const lightColor = rgb(0.98, 0.95, 0.85); // Cream
    const darkColor = rgb(0.9, 0.93, 0.98); // Light blue
    
    weekDays.forEach((day, dayIndex) => {
        const dailyOverride = shifts.dailyOverrides?.[dayIndex];
        const effectiveShifts = dailyOverride || getDefaultDailyShift(dayIndex, shifts.morning, shifts.evening);
        
        const dayShifts = [
            { turno: 'Mañana', details: effectiveShifts.morning },
            { turno: 'Tarde', details: effectiveShifts.evening }
        ];

        dayShifts.forEach((shiftInfo, shiftIndex) => {
            const isDarkRow = (dayIndex * 2 + shiftIndex) % 2 !== 0;
            page.drawRectangle({
                x: margin,
                y: y - rowHeight,
                width: colWidths.reduce((a, b) => a + b, 0),
                height: rowHeight,
                color: isDarkRow ? darkColor : lightColor,
            });

            if (shiftIndex === 0) {
                 page.drawText(day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }), {
                    x: margin + 10,
                    y: y - (rowHeight / 2) - 10,
                    font: fontBold,
                    size: 11,
                    color: rgb(0, 0, 0),
                });
            }
            
            const horario = shiftInfo.details.active ? `${shiftInfo.details.start} - ${shiftInfo.details.end}` : '-';
            const personal = shiftInfo.details.active ? shiftInfo.details.worker : 'Cerrado';

            const rowData = [shiftInfo.turno, personal, horario];
            let currentX = margin + colWidths[0];

            rowData.forEach((text, i) => {
                page.drawText(text, {
                    x: currentX + 10,
                    y: y - (rowHeight / 2) - 5,
                    font: font,
                    size: 11,
                    color: rgb(0, 0, 0),
                });
                currentX += colWidths[i + 1];
            });
            y -= rowHeight;
        });
    });

    const tableBottom = y;
    currentX = margin;
    [...colWidths, 0].forEach(width => {
        page.drawLine({
            start: { x: currentX, y: tableTop },
            end: { x: currentX, y: tableBottom },
            thickness: 1,
            color: rgb(0.8, 0.8, 0.8),
        });
        currentX += width;
    });

    y -= 25;
    
    // Tasks section
    if (allTasks && allTasks.length > 0) {
        if (y < margin + 40) addNewPage();
        y -= 10;
        page.drawText('Tareas de la Semana:', { x: margin, y: y, font: fontBold, size: 16, color: rgb(0.96, 0.45, 0.09) });
        y -= 20;

        allTasks.forEach(task => {
            const isEventTask = task.type === 'event';
            const taskText = isEventTask ? `[${task.eventName}] ${task.text}` : task.text;
            const assignees = Array.isArray(task.assignedTo) ? task.assignedTo.join(', ') : task.assignedTo;
            const fullText = `${taskText} (Asignado a: ${assignees})`;
            const maxWidthTasks = width - margin * 2 - 20;
            
            const lines = getLinesOfText(fullText, font, 10, maxWidthTasks);
            const neededHeight = lines.length * 12 + 6;

            if (y < margin + neededHeight) addNewPage();

            const taskColor = task.completed ? rgb(0.5, 0.5, 0.5) : (isEventTask ? rgb(0.5, 0.2, 0.8) : rgb(0, 0, 0));
            const boxSize = 10;
            const boxY = y + 1;

            page.drawRectangle({ x: margin, y: boxY, width: boxSize, height: boxSize, borderWidth: 1, borderColor: taskColor });
            if (task.completed) {
                page.drawLine({ start: { x: margin + 2, y: boxY + 5 }, end: { x: margin + 4, y: boxY + 2 }, thickness: 1.5, color: taskColor });
                page.drawLine({ start: { x: margin + 4, y: boxY + 2 }, end: { x: margin + 8, y: boxY + 8 }, thickness: 1.5, color: taskColor });
            }

            page.drawText(fullText, {
                x: margin + boxSize + 5, y: y, font: font, size: 10, color: taskColor, maxWidth: maxWidthTasks, lineHeight: 12,
            });
            y -= neededHeight;
        });
        y -= 15;
    }

    if (shifts.observations) {
        const lines = getLinesOfText(shifts.observations, font, 12, width - 2 * margin);
        const neededHeight = 16 + 20 + lines.length * 15;
        if (y < margin + neededHeight) addNewPage();
        
        y -= 10;
        page.drawText('Observaciones:', { x: margin, y: y, font: fontBold, size: 16, color: rgb(0.96, 0.45, 0.09) });
        y -= 20;

        page.drawText(shifts.observations, {
            x: margin, y: y, font: font, size: 12, lineHeight: 15, color: rgb(0.2, 0.2, 0.2), maxWidth: width - 2 * margin,
        });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Horario_Semana_${weekNumber}_${year}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
};


export const generateAgendaPDF = async (
    weekNumber: number,
    year: number,
    weekDays: Date[],
    bookings: Bookings,
    shifts: ShiftAssignment,
    specialEvents: SpecialEvents,
    allTasks: CombinedTaskForPDF[]
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
        page.drawText(`Agenda Semanal - Semana ${weekNumber} (cont.)`, { x: margin, y: y, font: fontBold, size: 18, color: rgb(0.96, 0.45, 0.09) });
        y -= 30;
    };

    page.drawText(`Agenda Semanal - Semana ${weekNumber}`, { x: margin, y: y, font: fontBold, size: 24, color: rgb(0.96, 0.45, 0.09) });
    y -= 20;
    page.drawText(`${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`, { x: margin, y: y, font: font, size: 14, color: rgb(0.5, 0.5, 0.5) });
    y -= 25;

    const weekStartStr = formatDateForBookingKey(weekDays[0]);
    const weekEndStr = formatDateForBookingKey(weekDays[6]);
    const eventsThisWeek = Object.values(specialEvents).filter(event => 
        (event.startDate <= weekEndStr && event.endDate >= weekStartStr)
    );

    if (eventsThisWeek.length > 0) {
        y -= 10;
        page.drawText('Eventos Especiales de la Semana:', { x: margin, y: y, font: fontBold, size: 14, color: rgb(0.5, 0.2, 0.8) }); // Purple
        y -= 20;

        eventsThisWeek.forEach(event => {
            const startDate = new Date(`${event.startDate}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            const endDate = new Date(`${event.endDate}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            const dateRange = event.startDate === event.endDate ? startDate : `${startDate} - ${endDate}`;
            const eventText = `- ${event.name} (${dateRange})`;
            page.drawText(eventText, { x: margin + 10, y: y, font: font, size: 10, color: rgb(0.2, 0.2, 0.2) });
            y -= 15;
        });
    }
    y -= 20;

    weekDays.forEach((day, index) => {
        const dayBookings = consolidateBookingsForDay(bookings, day);
        const dayKey = formatDateForBookingKey(day);
        const eventsForDay = Object.values(specialEvents).filter((event: SpecialEvent) => dayKey >= event.startDate && dayKey <= event.endDate);
        
        const maxWidth = width - margin * 2 - 10;
        const lineHeightBooking = font.heightAtSize(9) * 1.2;
        const lineHeightEvent = fontBold.heightAtSize(9) * 1.2;

        let neededHeight = 40; // Title and padding
        eventsForDay.forEach(event => {
            const eventText = `EVENTO: ${event.name}`;
            neededHeight += getLinesOfText(eventText, fontBold, 9, maxWidth).length * lineHeightEvent + 5;
        });
        if (dayBookings.length > 0) {
            dayBookings.forEach(booking => {
                const text = `${booking.startTime}-${booking.endTime}: ${booking.details.name} (${booking.space})`;
                neededHeight += getLinesOfText(text, font, 9, maxWidth).length * lineHeightBooking + 5;
            });
        } else if (eventsForDay.length === 0) {
            neededHeight += 12; // "Sin reservas"
        }

        if (y < margin + neededHeight) {
            addNewPage();
        }

        if (index > 0) {
            page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
        }
        
        page.drawText(day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }), { x: margin, y: y, font: fontBold, size: 14, color: rgb(0.047, 0.102, 0.18) });
        y -= 25;

        if (eventsForDay.length > 0) {
            eventsForDay.forEach(event => {
                const eventText = `EVENTO: ${event.name}`;
                page.drawText(eventText, {
                    x: margin + 10, y: y, font: fontBold, size: 9, color: rgb(0.5, 0.2, 0.8), lineHeight: lineHeightEvent, maxWidth
                });
                const lines = getLinesOfText(eventText, fontBold, 9, maxWidth);
                y -= lines.length * lineHeightEvent + 5;
            });
        }
        
        if (dayBookings.length > 0) {
            dayBookings.forEach(booking => {
                const text = `${booking.startTime}-${booking.endTime}: ${booking.details.name} (${booking.space})`;
                page.drawText(text, {
                    x: margin + 10, y: y, font: font, size: 9, color: rgb(0.2, 0.2, 0.2), lineHeight: lineHeightBooking, maxWidth
                });
                const lines = getLinesOfText(text, font, 9, maxWidth);
                y -= lines.length * lineHeightBooking + 5;
            });
        } else if (eventsForDay.length === 0) {
             page.drawText('Sin reservas', { x: margin + 10, y: y, font: font, size: 9, color: rgb(0.5, 0.5, 0.5) });
             y -= 12;
        }
    });

    y -= 40;

    // Tasks section
    if (allTasks && allTasks.length > 0) {
        if (y < margin + 40) addNewPage();

        page.drawText('Tareas de la Semana:', { x: margin, y: y, font: fontBold, size: 16, color: rgb(0.96, 0.45, 0.09) });
        y -= 25;

        allTasks.forEach(task => {
            const isEventTask = task.type === 'event';
            const taskText = isEventTask ? `[${task.eventName}] ${task.text}` : task.text;
            const assignees = Array.isArray(task.assignedTo) ? task.assignedTo.join(', ') : task.assignedTo;
            const fullText = `${taskText} (Asignado a: ${assignees})`;
            const maxWidthTasks = width - margin * 2 - 20;
            
            const lines = getLinesOfText(fullText, font, 10, maxWidthTasks);
            const neededHeight = lines.length * 12 + 8;
            
            if (y < margin + neededHeight) addNewPage();

            const taskColor = task.completed ? rgb(0.5, 0.5, 0.5) : (isEventTask ? rgb(0.5, 0.2, 0.8) : rgb(0, 0, 0));
            const boxSize = 10;
            const boxY = y + 1;

            page.drawRectangle({ x: margin, y: boxY, width: boxSize, height: boxSize, borderWidth: 1, borderColor: taskColor });
            if (task.completed) {
                page.drawLine({ start: { x: margin + 2, y: boxY + 5 }, end: { x: margin + 4, y: boxY + 2 }, thickness: 1.5, color: taskColor });
                page.drawLine({ start: { x: margin + 4, y: boxY + 2 }, end: { x: margin + 8, y: boxY + 8 }, thickness: 1.5, color: taskColor });
            }

            page.drawText(fullText, {
                x: margin + boxSize + 5, y: y, font: font, size: 10, color: taskColor, maxWidth: maxWidthTasks, lineHeight: 12,
            });
            y -= neededHeight;
        });
        y -= 15;
    }

    // Observations section
    if (shifts.observations) {
        const lines = getLinesOfText(shifts.observations, font, 10, width - 2 * margin);
        const neededHeight = 16 + 20 + lines.length * 13;
        if (y < margin + neededHeight) addNewPage();
        
        y -= 10;
        page.drawText('Observaciones:', { x: margin, y: y, font: fontBold, size: 16, color: rgb(0.96, 0.45, 0.09) });
        y -= 20;

        page.drawText(shifts.observations, {
            x: margin, y: y, font: font, size: 10, lineHeight: 13, color: rgb(0.2, 0.2, 0.2), maxWidth: width - 2 * margin,
        });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Agenda_Semana_${weekNumber}_${year}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
};

export const generateCalendarPDF = async (days: Date[], month: Date, bookings: Bookings, specialEvents: SpecialEvents) => {
    const { PDFDocument, rgb, StandardFonts } = (window as any).PDFLib;
    const pdfDoc = await PDFDocument.create();
    // FIX: Create a landscape A4 page using explicit dimensions.
    const page = pdfDoc.addPage([841.89, 595.28]);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 40;
    let y = height - margin;
    
    page.drawText(month.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase(), { x: margin, y: y, font: fontBold, size: 28, color: rgb(0.96, 0.45, 0.09) });
    y -= 40;

    const colWidth = (width - 2 * margin) / 7;
    const headerRowHeight = 20;

    ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'].forEach((text, i) => {
        page.drawText(text, { x: margin + i * colWidth + 5, y: y - 15, font: fontBold, size: 10, color: rgb(0.3, 0.3, 0.3) });
    });
    y -= headerRowHeight;

    const numWeeks = Math.ceil(days.length / 7);
    const rowHeight = (y - margin) / numWeeks;

    for (let week = 0; week < numWeeks; week++) {
        for (let day = 0; day < 7; day++) {
            const date = days[week * 7 + day];
            if (!date) continue;

            const dayKey = formatDateForBookingKey(date);
            const isCurrentMonth = date.getMonth() === month.getMonth();
            const cellX = margin + day * colWidth;
            const cellY = y - week * rowHeight;

            page.drawRectangle({ x: cellX, y: cellY - rowHeight, width: colWidth, height: rowHeight, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
            page.drawText(date.getDate().toString(), { x: cellX + 5, y: cellY - 15, font: fontBold, size: 12, color: isCurrentMonth ? rgb(0, 0, 0) : rgb(0.6, 0.6, 0.6) });

            const eventsForDay = Object.values(specialEvents).filter((event: SpecialEvent) => dayKey >= event.startDate && dayKey <= event.endDate);
            const dayBookings = consolidateBookingsForDay(bookings, date);

            const itemsToDisplay = [
                ...eventsForDay.map(e => ({ type: 'event', data: e })),
                ...dayBookings.map(b => ({ type: 'booking', data: b }))
            ];
            
            let contentY = cellY - 30;
            const contentLimit = cellY - rowHeight + 10;
            const maxItems = 4;

            itemsToDisplay.slice(0, maxItems).forEach(item => {
                if (contentY > contentLimit) {
                    let text: string;
                    let drawOptions: any;

                    if (item.type === 'event') {
                        const event = item.data as SpecialEvent;
                        text = `* ${event.name}`;
                        drawOptions = { font: fontBold, size: 7, color: isCurrentMonth ? rgb(0.5, 0.2, 0.8) : rgb(0.7, 0.6, 0.8) };
                    } else {
                        const booking = item.data as ConsolidatedBooking;
                        text = `${booking.startTime} ${booking.details.name}`;
                        drawOptions = { font: font, size: 7, color: isCurrentMonth ? rgb(0.2, 0.2, 0.2) : rgb(0.7, 0.7, 0.7) };
                    }

                    page.drawText(text, {
                        x: cellX + 5,
                        y: contentY,
                        ...drawOptions,
                        maxWidth: colWidth - 10,
                    });
                    contentY -= 9;
                }
            });

            if (itemsToDisplay.length > maxItems && contentY > contentLimit) {
                page.drawText('...', { x: cellX + 5, y: contentY, font: font, size: 8, color: rgb(0.5, 0.5, 0.5) });
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

export const generateCleaningPDF = async (weekNumber: number, year: number, weekDays: Date[], cleaningAssignments: CleaningAssignments, cleaningObservation?: { observations: string }) => {
    const { PDFDocument, rgb, StandardFonts } = (window as any).PDFLib;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    let y = height - margin;

    page.drawText(`Agenda de Limpieza - Semana ${weekNumber}`, { x: margin, y: y, font: fontBold, size: 24, color: rgb(0.96, 0.45, 0.09) });
    y -= 20;
    page.drawText(`${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`, { x: margin, y: y, font: font, size: 14, color: rgb(0.5, 0.5, 0.5) });
    y -= 40;

    const colWidths = [200, 200];
    const headerTexts = ['Día', 'Hora de Inicio'];
    page.drawRectangle({ x: margin, y: y - 25, width: colWidths.reduce((a, b) => a + b, 0), height: 25, color: rgb(0.047, 0.102, 0.18) });
    headerTexts.forEach((text, i) => {
        page.drawText(text, { x: margin + (colWidths.slice(0, i).reduce((a, b) => a + b, 0)) + 10, y: y - 17, font: fontBold, size: 12, color: rgb(1, 1, 1) });
    });
    y -= 25;

    const rowHeight = 35;
    weekDays.forEach((day, dayIndex) => {
        const dayKey = `${day.getFullYear()}-${(day.getMonth() + 1).toString().padStart(2, '0')}-${day.getDate().toString().padStart(2, '0')}`;
        const assignment = cleaningAssignments[dayKey];
        page.drawRectangle({ x: margin, y: y - rowHeight, width: colWidths.reduce((a, b) => a + b, 0), height: rowHeight, color: dayIndex % 2 === 0 ? rgb(0.9, 0.93, 0.98) : rgb(1, 1, 1) });
        page.drawText(day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'numeric' }), { x: margin + 10, y: y - (rowHeight / 2) - 5, font: fontBold, size: 11, color: rgb(0, 0, 0) });
        page.drawText(assignment?.startTime || 'Sin asignar', { x: margin + colWidths[0] + 10, y: y - (rowHeight / 2) - 5, font: font, size: 11, color: assignment?.startTime ? rgb(0, 0, 0) : rgb(0.5, 0.5, 0.5) });
        y -= rowHeight;
    });

    if (cleaningObservation?.observations) {
        y -= 25;
        page.drawText('Observaciones:', {
            x: margin,
            y: y,
            font: fontBold,
            size: 16,
            color: rgb(0.96, 0.45, 0.09)
        });
        y -= 20;
        
        page.drawText(cleaningObservation.observations, {
            x: margin,
            y: y,
            font: font,
            size: 12,
            lineHeight: 15,
            color: rgb(0.2, 0.2, 0.2),
            maxWidth: width - 2 * margin,
        });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Limpieza_Semana_${weekNumber}_${year}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
};