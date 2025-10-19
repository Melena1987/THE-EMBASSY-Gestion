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

import type { ShiftAssignment } from '../types';
import { getDefaultDailyShift } from './shiftUtils';

/**
 * Generates and downloads a PDF document for the weekly shifts using pdf-lib.
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
    const headerFill = rgb(55/255, 65/255, 81/255);
    const headerColor = rgb(0.95, 0.95, 0.95);
    const morningFill = rgb(255/255, 249/255, 230/255);
    const eveningFill = rgb(229/255, 239/255, 255/255);

    let y = height - 40;

    page.drawText(`Horario Semanal - Semana ${weekNumber}`, {
        x: 50, y, font: boldFont, size: 18, color: orange,
    });
    y -= 20;

    const dateRange = `${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    page.drawText(dateRange, {
        x: 50, y, font: font, size: 11, color: grey,
    });
    y -= 30;

    const tableTop = y;
    const leftMargin = 50;
    const tableWidth = width - 100;
    const colWidths = [130, 80, 120, 120];
    const rowHeight = 22;
    const header = ['Día', 'Turno', 'Personal', 'Horario'];

    page.drawRectangle({
        x: leftMargin, y: y - rowHeight, width: tableWidth, height: rowHeight, color: headerFill,
    });
    let currentX = leftMargin;
    header.forEach((text, i) => {
        page.drawText(text, { x: currentX + 5, y: y - 15, font: boldFont, size: 10, color: headerColor });
        currentX += colWidths[i];
    });
    y -= rowHeight;

    const tableData = weekDays.flatMap((day, dayIndex) => {
        const effectiveShifts = currentShifts.dailyOverrides?.[dayIndex] || getDefaultDailyShift(dayIndex, currentShifts.morning, currentShifts.evening);
        const dayString = day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });
        return [
            [dayString, 'Mañana', effectiveShifts.morning.active ? effectiveShifts.morning.worker : 'Cerrado', effectiveShifts.morning.active ? `${effectiveShifts.morning.start} - ${effectiveShifts.morning.end}` : '-'],
            ['', 'Tarde', effectiveShifts.evening.active ? effectiveShifts.evening.worker : 'Cerrado', effectiveShifts.evening.active ? `${effectiveShifts.evening.start} - ${effectiveShifts.evening.end}` : '-']
        ];
    });

    tableData.forEach((row, rowIndex) => {
        const isMorning = rowIndex % 2 === 0;
        const fillColor = isMorning ? morningFill : eveningFill;
        page.drawRectangle({ x: leftMargin + colWidths[0], y: y - rowHeight, width: colWidths[1], height: rowHeight, color: fillColor });
        
        currentX = leftMargin;
        row.forEach((cell, cellIndex) => {
            const cellFont = (cellIndex === 0 && isMorning) ? boldFont : font;
            page.drawText(String(cell), { x: currentX + 5, y: y - 15, font: cellFont, size: 9, color: black });
            currentX += colWidths[cellIndex];
        });
        page.drawLine({ start: { x: leftMargin, y: y - rowHeight }, end: { x: leftMargin + tableWidth, y: y - rowHeight }, thickness: 0.5, color: grey });
        y -= rowHeight;
    });

    currentX = leftMargin;
    [...colWidths, 0].forEach((w, i) => {
        if (i <= colWidths.length) {
            page.drawLine({ start: { x: currentX, y: tableTop }, end: { x: currentX, y: y + rowHeight }, thickness: 0.5, color: grey });
            currentX += w;
        }
    });

    if (currentShifts.observations) {
        y -= 25;
        page.drawText('Observaciones:', { x: leftMargin, y, font: boldFont, size: 12, color: orange });
        y -= 20;

        const text = currentShifts.observations;
        const maxWidth = tableWidth;
        const fontSize = 10;
        const paragraphs = text.split('\n');
        
        for (const p of paragraphs) {
            let currentLine = '';
            const words = p.split(' ');
            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                if (font.widthOfTextAtSize(testLine, fontSize) < maxWidth) {
                    currentLine = testLine;
                } else {
                    page.drawText(currentLine, { x: leftMargin, y, font, size: fontSize, color: black });
                    y -= (fontSize * 1.2);
                    currentLine = word;
                }
            }
            page.drawText(currentLine, { x: leftMargin, y, font, size: fontSize, color: black });
            y -= (fontSize * 1.2);
        }
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
