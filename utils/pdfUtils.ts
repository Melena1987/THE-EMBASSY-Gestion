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
        alert("No se pudo cargar la librería para generar el PDF. Revise su conexión a internet e inténtelo de nuevo.");
        return false;
    }
};

const wrapText = (text: string, font: any, fontSize: number, maxWidth: number): string[] => {
    const lines: string[] = [];
    if (!text) return lines;
    
    const paragraphs = text.split('\n');
    for (const p of paragraphs) {
        let currentLine = '';
        const words = p.split(' ');
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (font.widthOfTextAtSize(testLine, fontSize) < maxWidth) {
                currentLine = testLine;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
    }
    return lines;
};

/**
 * Generates and downloads a visually improved PDF document for the weekly shifts.
 * @param weekNumber The week number.
 * @param year The year.
 * @param weekDays An array of Date objects for the week.
 * @param currentShifts The shift assignment object for the week.
 */
export const generateShiftsPDF = async (
    weekNumber: number,
    year: number,
    weekDays: Date[],
    currentShifts: ShiftAssignment
) => {
    const { PDFDocument, rgb, StandardFonts } = (window as any).PDFLib;
    
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const orange = rgb(230 / 255, 126 / 255, 34 / 255);
    const grey = rgb(0.6, 0.6, 0.6);
    const black = rgb(0.1, 0.1, 0.1);
    const headerFill = rgb(42/255, 52/255, 65/255);
    const headerColor = rgb(0.95, 0.95, 0.95);
    const morningFill = rgb(255/255, 249/255, 230/255);
    const eveningFill = rgb(229/255, 239/255, 255/255);

    let y = height - 40;

    page.drawText(`Horario Semanal - Semana ${weekNumber}`, {
        x: 50, y, font: boldFont, size: 20, color: orange,
    });
    y -= 20;

    const dateRange = `${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    page.drawText(dateRange, {
        x: 50, y, font: font, size: 12, color: grey,
    });
    y -= 40;

    const tableTop = y;
    const leftMargin = 50;
    const tableWidth = width - 100;
    const colWidths = [120, 80, 150, 150];
    const rowHeight = 22;
    const header = ['Día', 'Turno', 'Personal', 'Horario'];

    page.drawRectangle({
        x: leftMargin, y: y - rowHeight, width: tableWidth, height: rowHeight, color: headerFill,
    });
    let currentX = leftMargin;
    header.forEach((text, i) => {
        page.drawText(text, { x: currentX + 10, y: y - 15, font: boldFont, size: 11, color: headerColor });
        currentX += colWidths[i];
    });
    y -= rowHeight;

    weekDays.forEach((day, dayIndex) => {
        const dayString = day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });
        const effectiveShifts = currentShifts.dailyOverrides?.[dayIndex] || getDefaultDailyShift(dayIndex, currentShifts.morning, currentShifts.evening);

        const morningRow = ['Mañana', effectiveShifts.morning.active ? effectiveShifts.morning.worker : 'Cerrado', effectiveShifts.morning.active ? `${effectiveShifts.morning.start} - ${effectiveShifts.morning.end}` : '-'];
        const eveningRow = ['Tarde', effectiveShifts.evening.active ? effectiveShifts.evening.worker : 'Cerrado', effectiveShifts.evening.active ? `${effectiveShifts.evening.start} - ${effectiveShifts.evening.end}` : '-'];

        // Backgrounds
        page.drawRectangle({ x: leftMargin, y: y - (rowHeight * 2), width: tableWidth, height: rowHeight * 2, color: rgb(1,1,1) });
        page.drawRectangle({ x: leftMargin, y: y - rowHeight, width: tableWidth, height: rowHeight, color: morningFill });
        page.drawRectangle({ x: leftMargin, y: y - (rowHeight * 2), width: tableWidth, height: rowHeight, color: eveningFill });

        // Merged Day Cell
        page.drawText(dayString, { x: leftMargin + 10, y: y - rowHeight - 5, font: boldFont, size: 10, color: black });

        // Morning Row
        currentX = leftMargin + colWidths[0];
        morningRow.forEach((cell, i) => {
            page.drawText(String(cell), { x: currentX + 10, y: y - 15, font: font, size: 10, color: black });
            currentX += colWidths[i + 1];
        });
        
        // Evening Row
        currentX = leftMargin + colWidths[0];
        eveningRow.forEach((cell, i) => {
            page.drawText(String(cell), { x: currentX + 10, y: y - rowHeight - 15, font: font, size: 10, color: black });
            currentX += colWidths[i + 1];
        });

        // Horizontal line
        page.drawLine({ start: { x: leftMargin, y: y - (rowHeight * 2) }, end: { x: leftMargin + tableWidth, y: y - (rowHeight * 2) }, thickness: 0.5, color: grey });

        y -= (rowHeight * 2);
    });

    // Vertical Lines
    currentX = leftMargin;
    [...colWidths, 0].forEach((w, i) => {
        if (i <= colWidths.length) {
            page.drawLine({ start: { x: currentX, y: tableTop }, end: { x: currentX, y: y + (rowHeight * 2) }, thickness: 0.5, color: grey });
            currentX += w;
        }
    });

    y -= 20;

    // TASKS SECTION
    if (currentShifts.tasks && currentShifts.tasks.length > 0 && y > 100) {
        y -= 10;
        page.drawText('Tareas de la Semana:', { x: leftMargin, y, font: boldFont, size: 14, color: orange });
        y -= 25;

        for (const task of currentShifts.tasks) {
            const taskStartY = y;
            const taskTextMaxWidth = tableWidth - 25 - 70; // Reserve 25 for checkbox, 70 for assignee
            const taskLines = wrapText(task.text, font, 10, taskTextMaxWidth);
            const taskLineHeight = 14;
            const totalTaskHeight = taskLines.length * taskLineHeight;

            if (taskStartY - totalTaskHeight < 40) break; // Check if task fits on page

            // Draw Checkbox
            const boxSize = 10;
            const boxY = taskStartY;
            page.drawRectangle({
                x: leftMargin, y: boxY, width: boxSize, height: boxSize,
                borderColor: black, borderWidth: 1,
            });
            if (task.completed) {
                page.drawLine({ start: { x: leftMargin + 2, y: boxY + 5 }, end: { x: leftMargin + 4, y: boxY + 2 }, thickness: 1.5, color: black });
                page.drawLine({ start: { x: leftMargin + 4, y: boxY + 2 }, end: { x: leftMargin + 8, y: boxY + 8 }, thickness: 1.5, color: black });
            }

            // Draw Assignee
            const assigneeText = `(${task.assignedTo})`;
            const assigneeWidth = font.widthOfTextAtSize(assigneeText, 10);
            page.drawText(assigneeText, { 
                x: leftMargin + tableWidth - assigneeWidth, y: taskStartY, font: font, size: 10, color: grey 
            });

            // Draw Task Text Lines
            const textColor = task.completed ? grey : black;
            taskLines.forEach((line, i) => {
                page.drawText(line, { 
                    x: leftMargin + 20, y: taskStartY - (i * taskLineHeight), font: font, size: 10, color: textColor
                });
            });

            y = taskStartY - totalTaskHeight - 4; // Move y down for next task
        }
    }


    if (currentShifts.observations && y > 100) {
        y -= 30;
        page.drawText('Observaciones:', { x: leftMargin, y, font: boldFont, size: 14, color: orange });
        y -= 25;

        const lines = wrapText(currentShifts.observations, font, 10, tableWidth);
        lines.forEach(line => {
            if (y < 40) return;
            page.drawText(line, { x: leftMargin, y, font: font, size: 10, color: black });
            y -= 14;
        });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Turnos_Semana_${weekNumber}_${year}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};


export const generateCalendarPDF = async (
    daysInMonth: Date[],
    currentMonth: Date,
    bookings: Bookings
) => {
    const { PDFDocument, rgb, StandardFonts } = (window as any).PDFLib;
    
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const orange = rgb(230 / 255, 126 / 255, 34 / 255);
    const grey = rgb(0.6, 0.6, 0.6);
    const lightGrey = rgb(0.85, 0.85, 0.85);
    const black = rgb(0.1, 0.1, 0.1);
    
    const margin = 40;
    let y = height - margin;

    const monthName = currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    page.drawText(monthName.toUpperCase(), {
        x: margin, y, font: boldFont, size: 24, color: orange,
    });
    y -= 40;

    const tableTop = y;
    const tableWidth = width - (margin * 2);
    const colWidth = tableWidth / 7;
    const dayHeaders = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    // Draw day headers
    dayHeaders.forEach((header, i) => {
        page.drawText(header, { x: margin + (i * colWidth) + 5, y: y - 15, font: boldFont, size: 10, color: black });
    });
    y -= 25;
    
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: grey });
    
    const numWeeks = Math.ceil(daysInMonth.length / 7);
    const rowHeight = (y - margin) / numWeeks;
    
    daysInMonth.forEach((day, index) => {
        const weekIndex = Math.floor(index / 7);
        const dayIndex = index % 7;
        
        const x = margin + (dayIndex * colWidth);
        const cellY = y - (weekIndex * rowHeight);

        const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
        const dayColor = isCurrentMonth ? black : grey;

        // Draw day number
        page.drawText(String(day.getDate()), { x: x + 5, y: cellY - 15, font: boldFont, size: 12, color: dayColor });

        // Draw bookings
        if (isCurrentMonth) {
            const dayBookings = consolidateBookingsForDay(bookings, day);
            let bookingY = cellY - 30;
            const bookingFontSize = 6;
            const bookingLineHeight = 8;
            
            dayBookings.forEach(booking => {
                if (bookingY < cellY - rowHeight + 10) return;
                const bookingText = `${booking.startTime} ${booking.details.name}`;
                const lines = wrapText(bookingText, font, bookingFontSize, colWidth - 10);
                
                lines.forEach(line => {
                    if (bookingY < cellY - rowHeight + 10) return;
                    page.drawText(line, { x: x + 5, y: bookingY, font, size: bookingFontSize, color: black });
                    bookingY -= bookingLineHeight;
                });
            });
        }
    });

    // Draw grid lines
    for (let i = 0; i <= numWeeks; i++) {
        page.drawLine({ start: { x: margin, y: y - (i * rowHeight) }, end: { x: width - margin, y: y - (i * rowHeight) }, thickness: 0.5, color: lightGrey });
    }
    for (let i = 0; i <= 7; i++) {
        page.drawLine({ start: { x: margin + (i * colWidth), y: tableTop }, end: { x: margin + (i * colWidth), y: y - (numWeeks * rowHeight) }, thickness: 0.5, color: lightGrey });
    }
    
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Calendario_${monthName.replace(' ', '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};

const loadCustomFont = async (pdfDoc: any) => {
    try {
        const fontUrl = 'https://fonts.gstatic.com/s/orbitron/v25/yMJRMIlzdpvBhQQL_Qq7dy0.ttf';
        const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
        const customFont = await pdfDoc.embedFont(fontBytes);

        const boldFontUrl = 'https://fonts.gstatic.com/s/orbitron/v25/yMJZMIlzdpvBhQQL_QJSPP_9_g.ttf';
        const boldFontBytes = await fetch(boldFontUrl).then(res => res.arrayBuffer());
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);
        
        return { font: customFont, boldFont: customBoldFont };
    } catch (e) {
        console.error("Failed to load custom font, falling back to Helvetica.", e);
        const { StandardFonts } = (window as any).PDFLib;
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        return { font, boldFont };
    }
}


export const generateAgendaPDF = async (
    weekNumber: number,
    year: number,
    weekDays: Date[],
    bookings: Bookings
) => {
    const { PDFDocument, rgb } = (window as any).PDFLib;
    
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    const { font, boldFont } = await loadCustomFont(pdfDoc);
    
    const orange = rgb(0.9, 0.49, 0.13);
    const darkGrey = rgb(0.2, 0.2, 0.2);
    const mediumGrey = rgb(0.5, 0.5, 0.5);
    const lightGrey = rgb(0.95, 0.95, 0.95);

    const margin = 50;
    let y = height - margin;

    const checkY = (requiredHeight: number, newPageCallback = () => {}) => {
        if (y < margin + requiredHeight) {
            page = pdfDoc.addPage();
            y = height - margin;
            newPageCallback();
        }
    };

    const drawHeader = () => {
        page.drawText('THE EMBASSY', {
            x: margin, y, font: boldFont, size: 16, color: orange,
        });
        
        const title = `Agenda Semanal - Semana ${weekNumber}`;
        const titleWidth = boldFont.widthOfTextAtSize(title, 12);
        page.drawText(title, {
            x: width - margin - titleWidth, y: y + 4, font: boldFont, size: 12, color: darkGrey
        });
        
        const dateRange = `${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        const dateRangeWidth = font.widthOfTextAtSize(dateRange, 9);
        page.drawText(dateRange, {
             x: width - margin - dateRangeWidth, y: y - 10, font: font, size: 9, color: mediumGrey,
        });
        y -= 40;
    };

    const drawFooter = () => {
        const pageCount = pdfDoc.getPageCount();
        for (let i = 0; i < pageCount; i++) {
            const pdfPage = pdfDoc.getPage(i);
            const generationDate = `Generado el ${new Date().toLocaleString('es-ES')}`;
            const dateWidth = font.widthOfTextAtSize(generationDate, 8);
            pdfPage.drawText(generationDate, {
                x: margin, y: margin / 2, font: font, size: 8, color: mediumGrey,
            });
            const pageNumText = `Página ${i + 1} de ${pageCount}`;
            const pageNumWidth = font.widthOfTextAtSize(pageNumText, 8);
            pdfPage.drawText(pageNumText, {
                x: width - margin - pageNumWidth, y: margin / 2, font: font, size: 8, color: mediumGrey,
            });
        }
    };

    drawHeader();

    for (const day of weekDays) {
        const dayBookings = consolidateBookingsForDay(bookings, day);
        if (dayBookings.length === 0) continue;

        checkY(50, drawHeader);

        y -= 15;
        const dayHeaderText = day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
        page.drawRectangle({
            x: margin, y: y - 5, width: width - (margin * 2), height: 22, color: lightGrey
        });
        page.drawText(dayHeaderText, {
            x: margin + 10, y, font: boldFont, size: 11, color: darkGrey
        });
        y -= 35;
        
        for (const [index, booking] of dayBookings.entries()) {
            const obsLines = booking.details.observations ? wrapText(booking.details.observations, font, 9, width - (margin * 2) - 90) : [];
            const bookingHeight = 35 + (obsLines.length * 12);
            checkY(bookingHeight, drawHeader);

            // Time Column
            page.drawText(`${booking.startTime} - ${booking.endTime}`, {
                x: margin, y, font: boldFont, size: 10, color: orange
            });

            // Details Column
            const detailsX = margin + 80;
            const detailsWidth = width - margin - detailsX;
            page.drawText(booking.details.name, {
                x: detailsX, y, font: boldFont, size: 10, color: darkGrey
            });
            
            y -= 14;
            page.drawText(`Espacio: ${booking.space}`, {
                x: detailsX, y, font: font, size: 9, color: mediumGrey
            });
            y -= 12;

            if (booking.details.observations) {
                obsLines.forEach(line => {
                    page.drawText(line, { x: detailsX + 10, y, font: font, size: 9, color: mediumGrey });
                    y -= 12;
                });
            }
            
            y -= 8;
            
            // Dotted Separator
            if (index < dayBookings.length - 1) {
                 page.drawLine({
                    start: { x: margin, y },
                    end: { x: width - margin, y },
                    thickness: 0.5,
                    color: lightGrey,
                    dashArray: [2, 2],
                    dashPhase: 0,
                });
                y -= 10;
            }
        }
    }
    
    drawFooter();

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Agenda_Semana_${weekNumber}_${year}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};

export const generateCleaningPDF = async (
    weekNumber: number,
    year: number,
    weekDays: Date[],
    cleaningAssignments: CleaningAssignments
) => {
    const { PDFDocument, rgb, StandardFonts } = (window as any).PDFLib;
    
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const orange = rgb(230 / 255, 126 / 255, 34 / 255);
    const grey = rgb(0.6, 0.6, 0.6);
    const black = rgb(0.1, 0.1, 0.1);
    const headerFill = rgb(42/255, 52/255, 65/255);
    const headerColor = rgb(0.95, 0.95, 0.95);
    const rowFill = rgb(0.98, 0.98, 0.98);

    let y = height - 40;

    page.drawText(`THE EMBASSY - Horario de Limpieza - Semana ${weekNumber}`, {
        x: 50, y, font: boldFont, size: 18, color: orange,
    });
    y -= 20;

    const dateRange = `${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    page.drawText(dateRange, {
        x: 50, y, font: font, size: 12, color: grey,
    });
    y -= 40;

    const tableTop = y;
    const leftMargin = 50;
    const tableWidth = width - 100;
    const colWidths = [200, 150, 150];
    const rowHeight = 25;
    const header = ['Día', 'Fecha', 'Hora de Inicio'];

    page.drawRectangle({
        x: leftMargin, y: y - rowHeight, width: tableWidth, height: rowHeight, color: headerFill,
    });
    let currentX = leftMargin;
    header.forEach((text, i) => {
        page.drawText(text, { x: currentX + 10, y: y - 17, font: boldFont, size: 11, color: headerColor });
        currentX += colWidths[i];
    });
    y -= rowHeight;

    const formatDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    weekDays.forEach((day, dayIndex) => {
        const dayKey = formatDate(day);
        const assignment = cleaningAssignments[dayKey];
        const startTime = assignment?.startTime || '---';

        const dayString = day.toLocaleDateString('es-ES', { weekday: 'long' });
        const dateString = day.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        const row = [dayString, dateString, startTime];

        page.drawRectangle({ x: leftMargin, y: y - rowHeight, width: tableWidth, height: rowHeight, color: dayIndex % 2 === 0 ? rowFill : rgb(1,1,1) });

        currentX = leftMargin;
        row.forEach((cell, i) => {
            page.drawText(String(cell), { x: currentX + 10, y: y - 17, font: font, size: 10, color: black });
            currentX += colWidths[i];
        });
        
        y -= rowHeight;
    });

    // Draw grid lines
    page.drawLine({ start: { x: leftMargin, y: tableTop }, end: { x: leftMargin + tableWidth, y: tableTop }, thickness: 1, color: black });
    page.drawLine({ start: { x: leftMargin, y: y + rowHeight }, end: { x: leftMargin + tableWidth, y: y + rowHeight }, thickness: 1, color: black });
    
    currentX = leftMargin;
    [...colWidths, 0].forEach((w, i) => {
        if (i <= colWidths.length) {
            page.drawLine({ start: { x: currentX, y: tableTop }, end: { x: currentX, y: y + rowHeight }, thickness: 0.5, color: grey });
            currentX += w;
        }
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Limpieza_Semana_${weekNumber}_${year}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};