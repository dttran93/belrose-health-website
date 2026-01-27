# Belrose Health - Personal Sovereignty Protocol

A technology and incentivization infrastructure to encourage people to own and manage their own health records

## The Problem

Health records do not truly exist. Records are siloed across multiple providers, devices, and countries who do not talk to each other.

- This results in the people not having basic health information about themselves
- Without comprehensive records, we will never unlock the potential of technology in healthcare

## Our Solution

**Patient-Owned Records**: Allow patients sovereignty over their data and the ability to capture the economics and value that comes from it.
**Interoperability Standards**: Transform those records into standardize FHIR format so data can work across healthcare systems.
**Client-Side Encryption**: Records are encrypted with a user's encryption key before uploading. Therefore only the patient has access
**Blockchain Verification**: Health data is hashed and stored on the blockchain along with verifications and disputes from third-parties.
**Incentivization**: Build resources and infrastructure around these records to make people healthier.

## Tech Stack

- React + Vite (frontend)
- End-to-End encryption (E2EE)
  - AES for encrypting records
  - RSA for passing encrypted keys
- Blockchain (Solidity) for data verification
- Pimlico - Account Abstraction for gasless blockchain transactions
- Firebase (backend database, authentication, and file storage)

## Project Status

This is a research and MVP development project.

## Author

Dennis Tran
London, United Kingdom
dennis@belrosehealth.com
