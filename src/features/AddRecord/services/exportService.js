export class ExportService {
    generateExportData(processedFiles, fhirData, firestoreData, deduplicationStats) {
        return {
            exportedAt: new Date().toISOString(),
            summary: {
                totalFiles: processedFiles.length,
                totalWords: processedFiles.reduce((sum, f) => sum + (f.wordCount || 0), 0),
                fhirConversions: fhirData.size,
                savedToFirestore: firestoreData.size,
                deduplicationInfo: deduplicationStats
            },
            files: processedFiles.map(file => ({
                fileName: file.name,
                fileId: file.id,
                fileHash: file.fileHash,
                extractedText: file.extractedText,
                wordCount: file.wordCount,
                fhirData: fhirData.get(file.id),
                firestoreInfo: firestoreData.get(file.id)
            }))
        };
    }

    downloadData(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}