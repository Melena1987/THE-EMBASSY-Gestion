import type { ShiftAssignment, Bookings, ConsolidatedBooking, CleaningAssignments } from '../types';
import { getDefaultDailyShift } from './shiftUtils';
import { consolidateBookingsForDay } from './bookingUtils';

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

export const generateShiftsPDF = async (weekNumber: number, year: number, weekDays: Date[], shifts: ShiftAssignment) => {
    const { PDFDocument, rgb, StandardFonts } = (window as any).PDFLib;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    let y = height - margin;

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
    if (shifts.tasks && shifts.tasks.length > 0) {
        y -= 10;
        page.drawText('Tareas de la Semana:', { x: margin, y: y, font: fontBold, size: 16, color: rgb(0.96, 0.45, 0.09) });
        y -= 20;

        shifts.tasks.forEach(task => {
            const taskColor = task.completed ? rgb(0.5, 0.5, 0.5) : rgb(0, 0, 0);
            const assignees = Array.isArray(task.assignedTo) ? task.assignedTo.join(', ') : task.assignedTo;
            page.drawText(task.completed ? '☑' : '☐', { x: margin, y: y, font: font, size: 12, color: taskColor });
            page.drawText(`${task.text} (Asignado a: ${assignees})`, { x: margin + 20, y: y, font: font, size: 12, color: taskColor });
            y -= 18;
        });
        y -= 15;
    }

    if (shifts.observations) {
        y -= 10;
        page.drawText('Observaciones:', { x: margin, y: y, font: fontBold, size: 16, color: rgb(0.96, 0.45, 0.09) });
        y -= 20;

        page.drawText(shifts.observations, {
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
    link.download = `Horario_Semana_${weekNumber}_${year}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
};

export const generateAgendaPDF = async (weekNumber: number, year: number, weekDays: Date[], bookings: Bookings) => {
    const { PDFDocument, rgb, StandardFonts } = (window as any).PDFLib;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const margin = 50;
    let y = height - margin;

    page.drawText(`Agenda Semanal - Semana ${weekNumber}`, { x: margin, y: y, font: fontBold, size: 24, color: rgb(0.96, 0.45, 0.09) });
    y -= 20;
    page.drawText(`${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`, { x: margin, y: y, font: font, size: 14, color: rgb(0.5, 0.5, 0.5) });
    y -= 40;

    let columnBottomY = y;
    
    weekDays.forEach((day, index) => {
        const dayBookings = consolidateBookingsForDay(bookings, day);
        let currentY = y;
        let currentX = margin + (index % 2) * (width / 2 - margin);
        
        if (index > 0 && index % 2 === 0) {
            y = columnBottomY - 20;
            currentY = y;
        }

        page.drawText(day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }), { x: currentX, y: currentY, font: fontBold, size: 14, color: rgb(0.047, 0.102, 0.18) });
        currentY -= 20;
        
        if (dayBookings.length > 0) {
            dayBookings.forEach(booking => {
                 if (currentY < margin) return;
                 const text = `${booking.startTime}-${booking.endTime}: ${booking.details.name} (${booking.space})`;
                 page.drawText(text, { x: currentX, y: currentY, font: font, size: 9, color: rgb(0.2, 0.2, 0.2), maxWidth: width / 2 - margin - 20 });
                 currentY -= font.heightAtSize(text, 9, { descender: false, maxWidth: width / 2 - margin - 20 }) + 5;
            });
        } else {
             page.drawText('Sin reservas', { x: currentX, y: currentY, font: font, size: 9, color: rgb(0.5, 0.5, 0.5) });
             currentY -= 12;
        }
        
        if (currentY < columnBottomY) {
            columnBottomY = currentY;
        }
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Agenda_Semana_${weekNumber}_${year}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
};

export const generateCalendarPDF = async (days: Date[], month: Date, bookings: Bookings) => {
    const { PDFDocument, rgb, StandardFonts } = (window as any).PDFLib;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage({ layout: 'landscape' });
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 40;
    let y = height - margin;
    
    page.drawText(month.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase(), { x: margin, y: y, font: fontBold, size: 28, color: rgb(0.96, 0.45, 0.09) });
    y -= 40;

    const tableTop = y;
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

            const isCurrentMonth = date.getMonth() === month.getMonth();
            const cellX = margin + day * colWidth;
            const cellY = y - week * rowHeight;

            page.drawRectangle({ x: cellX, y: cellY - rowHeight, width: colWidth, height: rowHeight, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
            page.drawText(date.getDate().toString(), { x: cellX + 5, y: cellY - 15, font: fontBold, size: 12, color: isCurrentMonth ? rgb(0, 0, 0) : rgb(0.6, 0.6, 0.6) });

            const dayBookings = consolidateBookingsForDay(bookings, date);
            let bookingY = cellY - 30;
            dayBookings.slice(0, 4).forEach(booking => {
                if (bookingY > cellY - rowHeight + 10) {
                     page.drawText(`${booking.startTime} ${booking.details.name}`, { x: cellX + 5, y: bookingY, font: font, size: 7, color: isCurrentMonth ? rgb(0.2, 0.2, 0.2) : rgb(0.7, 0.7, 0.7), maxWidth: colWidth - 10, wordBreaks: [' '] });
                    bookingY -= 9;
                }
            });
            if (dayBookings.length > 4) {
                 page.drawText('...', { x: cellX + 5, y: bookingY, font: font, size: 8, color: rgb(0.5, 0.5, 0.5) });
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

export const generateCleaningPDF = async (weekNumber: number, year: number, weekDays: Date[], cleaningAssignments: CleaningAssignments) => {
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

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Limpieza_Semana_${weekNumber}_${year}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
};