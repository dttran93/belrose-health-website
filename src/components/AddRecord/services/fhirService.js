import { uploadUserFile, updateFirestoreWithFHIR } from '@/firebase/uploadUtils';

export class FHIRService {
    async createFHIRFile(fhirResult, originalFileName) {
        const fhirJsonBlob = new Blob([JSON.stringify(fhirResult, null, 2)], {
            type: 'application/json'
        });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fhirFileName = `${originalFileName.split('.')[0]}_fhir_${timestamp}.json`;
        
        return new File([fhirJsonBlob], fhirFileName, {
            type: 'application/json',
            lastModified: Date.now()
        });
    }

    async saveFHIRData(fileId, fhirResult, firestoreRecord, originalFileName) {
        console.log('Starting FHIR save process for:', fileId);

        // 1. Create FHIR JSON file
        const fhirFile = await this.createFHIRFile(fhirResult, originalFileName);
        console.log('Created FHIR file:', fhirFile.name, 'Size:', fhirFile.size);

        // 2. Upload FHIR file to storage
        console.log('Uploading FHIR JSON file to Firebase Storage...');
        const { downloadURL: fhirDownloadURL, filePath: fhirFilePath } = 
            await uploadUserFile(fhirFile);
        console.log('FHIR file uploaded successfully:', fhirDownloadURL);

        // 3. Update Firestore with FHIR data
        console.log('Updating Firestore with FHIR data...');
        await updateFirestoreWithFHIR(firestoreRecord.firestoreId, {
            ...fhirResult,
            fhirStorageInfo: {
                downloadURL: fhirDownloadURL,
                filePath: fhirFilePath,
                uploadedAt: new Date().toISOString()
            }
        });

        console.log('FHIR process completed successfully for:', fileId);

        return {
            fhirSaved: true,
            fhirSavedAt: new Date().toISOString(),
            fhirDownloadURL,
            fhirFilePath
        };
    }

    calculateFHIRStats(fhirDataMap) {
        return Array.from(fhirDataMap.values()).reduce((sum, data) => 
            sum + (data.entry?.length || 0), 0
        );
    }
}
