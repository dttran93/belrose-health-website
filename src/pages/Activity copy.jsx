import React from 'react';
import HealthRecordCard from '@/components/ui/HealthRecordCard';
import DocumentUploader from '@/components/ui/DocumentUploader';

const notesOne = {
    /*
    "resourceType": "VisionPrescription",
    "status": "active",
    "created": "2025-02-23",
    "extension":[{
      "url": "http://hl7.org/fhir/StructureDefinition/expirationDate",
      "valueDate": "2027-02-23"
    }],
    "patient": { "reference": "Patient/123" },
    "prescriber": { "reference": "Practitioner/456" },
    "lensSpecification": [
      {
        "eye": "right",
        "sphere": -2.50,
        "cylinder": -0.25,
        "axis": 155
      },
      {
        "eye": "left",
        "sphere": -2.00,
        "cylinder": -0.25,
        "axis": 20
      }
    ] */
   subject: "Annual Vision Prescription",
    provider: "Dr. Sarah Mahrez",
    institutionName: "Spec Savers",
    institutionAddress: "158A Cromwell Road, Kensington, London SW7 4EJ",
    date: "2025-23-02",
    clinicNotes: `lensSpecification
        "eye: "right",
        "sphere": -2.50,
        "cylinder": -0.25,
        "axis": 155
        "eye": "left",
        "sphere": -2.00,
        "cylinder": -0.25,
        "axis": 20`,
    attachments: [
    {
      name: "SpecSavers - Prescription.jpg", // Just the filename
      size: "119KB"
    }
     ],
    isBlockchainVerified: true,
    };

    

const Activity = ({ user = null }) => {

  return (
    <div className="space-y-6">
      <HealthRecordCard 
        subject={notesOne.subject}
        provider={notesOne.provider}
        institutionName={notesOne.institutionName}
        institutionAddress={notesOne.institutionAddress}
        date={notesOne.date}
        clinicNotes={notesOne.clinicNotes}
        attachments={notesOne.attachments}
        isBlockchainVerified={notesOne.isBlockchainVerified}/>
      <DocumentUploader />
    </div>
  );
};

export default Activity;