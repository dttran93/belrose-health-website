// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title HealthRecordVerification
 * @dev Store and verify medical record hashes on blockchain with medical attestation
 */
contract HealthRecordVerification {
    
    // Event when a record is stored
    event RecordStored(
        string indexed recordHash,
        address indexed patient,
        address indexed submitter,
        uint256 timestamp,
        string recordId
    );
    
    // Event when a record gets medical verification
    event MedicalVerification(
        string indexed recordHash,
        address indexed medicalVerifier,
        uint256 timestamp
    );
    
    // Structure for each record
    struct RecordVerification {
        string recordHash;         // SHA-256 hash of medical data
        address patient;           // Patient this record belongs to
        address submitter;         // Who actually submitted it (could be patient, provider, etc.)
        address medicalVerifier;   // Healthcare provider who attests to this record
        uint256 timestamp;         // When it was submitted
        string recordId;          // Your app's internal record ID
        bool exists;             // Whether this record exists
        bool isVerified;         // Whether a medical verifier has attested to it
    }
    
    // Storage: hash -> record info
    mapping(string => RecordVerification) public recordVerifications;
    
    // Array of all hashes (for counting/listing)
    string[] public allRecordHashes;
    
    // Total count
    uint256 public totalRecords;
    
    // Records by patient address
    mapping(address => string[]) public recordsByPatient;
    
    // Records by medical verifier
    mapping(address => string[]) public recordsByVerifier;
    
    /**
     * Store a medical record hash on the blockchain
     * @param recordHash SHA-256 hash of the medical record
     * @param recordId Your internal record ID (like "patient-123-visit-456")
     * @param patientAddress The patient this record belongs to
     */
    function storeRecordHash(
        string memory recordHash, 
        string memory recordId,
        address patientAddress
    ) external {
        // Validation
        require(bytes(recordHash).length > 0, "Hash cannot be empty");
        require(bytes(recordId).length > 0, "Record ID cannot be empty");
        require(patientAddress != address(0), "Patient address cannot be zero");
        require(!recordVerifications[recordHash].exists, "Hash already exists");
        
        // Store the record
        recordVerifications[recordHash] = RecordVerification({
            recordHash: recordHash,
            patient: patientAddress,
            submitter: msg.sender,           // Who called this function
            medicalVerifier: address(0),     // No verifier yet
            timestamp: block.timestamp,
            recordId: recordId,
            exists: true,
            isVerified: false               // Not verified yet
        });
        
        // Add to our lists
        allRecordHashes.push(recordHash);
        recordsByPatient[patientAddress].push(recordHash);
        totalRecords++;
        
        // Emit event
        emit RecordStored(recordHash, patientAddress, msg.sender, block.timestamp, recordId);
    }
    
    /**
     * Allow a medical verifier to attest to a record
     * @param recordHash The hash of the record to verify
     */
    function verifyMedicalRecord(string memory recordHash) external {
        require(recordVerifications[recordHash].exists, "Record does not exist");
        require(!recordVerifications[recordHash].isVerified, "Already verified");
        require(msg.sender != address(0), "Invalid verifier address");
        
        // Update the record
        recordVerifications[recordHash].medicalVerifier = msg.sender;
        recordVerifications[recordHash].isVerified = true;
        
        // Add to verifier's list
        recordsByVerifier[msg.sender].push(recordHash);
        
        // Emit event
        emit MedicalVerification(recordHash, msg.sender, block.timestamp);
    }
    
    /**
     * Check if a record hash exists and get its info
     * @param recordHash The hash to look up
     * @return exists Whether it exists
     * @return patient Who the record belongs to
     * @return submitter Who submitted it
     * @return medicalVerifier Who verified it (address(0) if not verified)
     * @return timestamp When it was submitted
     * @return recordId The internal record ID
     * @return isVerified Whether it's been medically verified
     */
    function verifyRecordExists(string memory recordHash) 
        external 
        view 
        returns (
            bool exists, 
            address patient,
            address submitter, 
            address medicalVerifier,
            uint256 timestamp, 
            string memory recordId,
            bool isVerified
        ) 
    {
        RecordVerification memory record = recordVerifications[recordHash];
        return (
            record.exists, 
            record.patient, 
            record.submitter,
            record.medicalVerifier,
            record.timestamp, 
            record.recordId,
            record.isVerified
        );
    }
    
    /**
     * Get all records for a specific patient
     * @param patientAddress The patient's address
     * @return Array of record hashes
     */
    function getPatientRecords(address patientAddress) 
        external 
        view 
        returns (string[] memory) 
    {
        return recordsByPatient[patientAddress];
    }
    
    /**
     * Get all records verified by a specific medical provider
     * @param verifierAddress The verifier's address
     * @return Array of record hashes
     */
    function getVerifierRecords(address verifierAddress) 
        external 
        view 
        returns (string[] memory) 
    {
        return recordsByVerifier[verifierAddress];
    }
    
    /**
     * Get total number of records
     */
    function getTotalRecords() external view returns (uint256) {
        return totalRecords;
    }
    
    /**
     * Get a record hash by its index in the array
     */
    function getRecordByIndex(uint256 index) 
        external 
        view 
        returns (string memory) 
    {
        require(index < allRecordHashes.length, "Index out of bounds");
        return allRecordHashes[index];
    }
    
    /**
     * Get verification statistics for a patient
     * @param patientAddress The patient's address
     * @return total Total records for this patient
     * @return verified How many are medically verified
     */
    function getPatientStats(address patientAddress) 
        external 
        view 
        returns (uint256 total, uint256 verified) 
    {
        string[] memory patientRecords = recordsByPatient[patientAddress];
        total = patientRecords.length;
        verified = 0;
        
        for (uint256 i = 0; i < patientRecords.length; i++) {
            if (recordVerifications[patientRecords[i]].isVerified) {
                verified++;
            }
        }
        
        return (total, verified);
    }
}