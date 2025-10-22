import { GoogleGenAI, Type } from "@google/genai";

// Declare pdfjsLib as it's loaded from a script tag in index.html
declare const pdfjsLib: any;

interface ExtractedSponsorData {
    name?: string;
    allianceDate?: string;
    annualContribution?: number;
    contactPhone?: string;
    instagramUrl?: string;
    observations?: string;
    tasks?: string[];
}

/**
 * Extracts text content from a PDF file using pdf.js.
 * @param file The PDF file to process.
 * @returns A promise that resolves with the extracted text content as a single string.
 */
async function extractTextFromPDF(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
    }

    return fullText;
}

/**
 * Analyzes the text of a sponsor contract using the Gemini API.
 * @param file The PDF contract file.
 * @returns A promise that resolves with the structured sponsor data extracted by the AI.
 */
export async function analyzeSponsorContract(file: File): Promise<ExtractedSponsorData> {
    try {
        const contractText = await extractTextFromPDF(file);

        if (!contractText.trim()) {
            throw new Error("El PDF está vacío o no se pudo extraer texto.");
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const schema = {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: 'Nombre de la empresa patrocinadora.' },
                allianceDate: { type: Type.STRING, description: 'Fecha de inicio del acuerdo en formato YYYY-MM-DD.' },
                annualContribution: { type: Type.NUMBER, description: 'Aportación económica anual en euros, solo el número.' },
                contactPhone: { type: Type.STRING, description: 'Teléfono de contacto principal si se menciona.' },
                instagramUrl: { type: Type.STRING, description: 'URL completa de la cuenta de Instagram si se menciona.' },
                observations: { type: Type.STRING, description: 'Cualquier otra observación, cláusula o detalle relevante del contrato.' },
                tasks: {
                    type: Type.ARRAY,
                    description: 'Lista de todas las contraprestaciones, entregables o acciones que THE EMBASSY debe realizar para el patrocinador.',
                    items: { type: Type.STRING }
                },
            },
            required: ['name', 'tasks']
        };

        const prompt = `Analiza el siguiente texto de un contrato de patrocinio. Extrae la información clave y las contraprestaciones (obligaciones de nuestra parte) y devuélvela como un objeto JSON que se ajuste al esquema proporcionado.

        Texto del Contrato:
        ---
        ${contractText}
        ---
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error al procesar con Gemini:", error);
        if (error instanceof SyntaxError) {
             throw new Error("La IA devolvió una respuesta inesperada. Por favor, inténtelo de nuevo.");
        }
        if (error instanceof Error) {
            throw error; // Re-throw known errors
        }
        throw new Error("Ocurrió un error desconocido durante el análisis.");
    }
}