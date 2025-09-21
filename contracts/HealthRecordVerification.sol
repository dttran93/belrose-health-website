// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title HealthRecordVerification
 * @dev Store and verify medical record hashes on blockchain
 */
contract HealthRecordVerification {
    
    // Event when a record is stored
    event RecordStored(
        string indexed recordHash,
        address indexed submitter,
        uint256 timestamp,
        string recordId
    );
    
    // Structure for each record
    struct RecordVerification {
        string recordHash;      // SHA-256 hash of medical data
        address submitter;      // Who submitted it (wallet address)
        uint256 timestamp;      // When it was submitted
        string recordId;        // Your app's internal record ID
        bool exists;           // Whether this record exists
    }
    
    // Storage: hash -> record info
    mapping(string => RecordVerification) public recordVerifications;
    
    // Array of all hashes (for counting/listing)
    string[] public allRecordHashes;
    
    // Total count
    uint256 public totalRecords;
    
    /**
     * Store a medical record hash on the blockchain
     * @param recordHash SHA-256 hash of the medical record
     * @param recordId Your internal record ID (like "patient-123-visit-456")
     */
    function storeRecordHash(
        string memory recordHash, 
        string memory recordId
    ) external {
        // Validation
        require(bytes(recordHash).length > 0, "Hash cannot be empty");
        require(bytes(recordId).length > 0, "Record ID cannot be empty");
        require(!recordVerifications[recordHash].exists, "Hash already exists");
        
        // Store the record
        recordVerifications[recordHash] = RecordVerification({
            recordHash: recordHash,
            submitter: msg.sender,
            timestamp: block.timestamp,
            recordId: recordId,
            exists: true
        });
        
        // Add to our list
        allRecordHashes.push(recordHash);
        totalRecords++;
        
        // Emit event so the world knows
        emit RecordStored(recordHash, msg.sender, block.timestamp, recordId);
    }
    
    /**
     * Check if a record hash exists and get its info
     * @param recordHash The hash to look up
     * @return exists Whether it exists
     * @return submitter Who submitted it
     * @return timestamp When it was submitted
     * @return recordId The internal record ID
     */
    function verifyRecordExists(string memory recordHash) 
        external 
        view 
        returns (
            bool exists, 
            address submitter, 
            uint256 timestamp, 
            string memory recordId
        ) 
    {
        RecordVerification memory record = recordVerifications[recordHash];
        return (record.exists, record.submitter, record.timestamp, record.recordId);
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
}