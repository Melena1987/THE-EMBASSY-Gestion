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
 * Ensures that jspdf and jspdf-autotable libraries are loaded into the window.
 * It loads them sequentially from a CDN if they are not already present.
 * @returns A promise that resolves to true if libraries are loaded, false otherwise.
 */
export const ensurePdfLibsLoaded = async (): Promise<boolean> => {
    try {
        // Load jspdf first if it's not available
        if (typeof (window as any).jspdf?.jsPDF !== 'function') {
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
        }
        // Then load jspdf-autotable if it's not available
        if (typeof (window as any).autoTable !== 'function') {
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js");
        }
        // Final check to confirm they are ready
        return typeof (window as any).jspdf?.jsPDF === 'function' && typeof (window as any).autoTable === 'function';
    } catch (error) {
        console.error("Error loading PDF libraries:", error);
        alert("No se pudieron cargar las librerías para generar el PDF. Revise su conexión a internet e inténtelo de nuevo.");
        return false;
    }
};

import type { ShiftAssignment } from '../types';
import { getDefaultDailyShift } from './shiftUtils';

/**
 * Generates and downloads a PDF document for the weekly shifts.
 * @param weekNumber The week number.
 * @param year The year.
 * @param weekDays An array of Date objects for the week.
 * @param currentShifts The shift assignment object for the week.
 */
export const generateShiftsPDF = (
    weekNumber: number,
    year: number,
    weekDays: Date[],
    currentShifts: ShiftAssignment
) => {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    const autoTable = (window as any).autoTable;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor('#E67E22');
    doc.text(`Horario Semanal - Semana ${weekNumber}`, 14, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100);
    const dateRange = `${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    doc.text(dateRange, 14, 30);
    
    const tableBody = weekDays.flatMap((day, dayIndex) => {
        const effectiveShifts = currentShifts.dailyOverrides?.[dayIndex] || getDefaultDailyShift(dayIndex, currentShifts.morning, currentShifts.evening);
        const dayString = day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });

        const morningRow = [
            { content: dayString, rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
            { content: 'Mañana', styles: { fillColor: [255, 249, 230] } },
            effectiveShifts.morning.active ? effectiveShifts.morning.worker : 'Cerrado',
            effectiveShifts.morning.active ? `${effectiveShifts.morning.start} - ${effectiveShifts.morning.end}` : '-'
        ];
        
        const eveningRow = [
            { content: 'Tarde', styles: { fillColor: [229, 239, 255] } },
            effectiveShifts.evening.active ? effectiveShifts.evening.worker : 'Cerrado',
            effectiveShifts.evening.active ? `${effectiveShifts.evening.start} - ${effectiveShifts.evening.end}` : '-'
        ];

        return [morningRow, eveningRow];
    });

    autoTable(doc, {
        head: [['Día', 'Turno', 'Personal', 'Horario']],
        body: tableBody,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: '#374151', textColor: '#F3F4F6', fontStyle: 'bold' },
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold' } }
    });

    if (currentShifts.observations) {
        const finalY = (doc as any).lastAutoTable.finalY;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#E67E22');
        doc.text('Observaciones:', 14, finalY + 15);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40);
        doc.text(currentShifts.observations, 14, finalY + 22, { maxWidth: 180 });
    }

    doc.save(`Turnos_Semana_${weekNumber}_${year}.pdf`);
};