export const convertToFHIR = async (documentText, documentType = 'medical_record') => {
  try {
    // Calls your Firebase Function instead of Anthropic directly
    const functionUrl = 'https://us-central1-belrose-757fe.cloudfunctions.net/convertToFHIR';
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentText,
        documentType
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const fhirData = await response.json();
    return fhirData;

  } catch (error) {
    console.error('FHIR conversion error:', error);
    throw new Error(`Failed to convert to FHIR: ${error.message}`);
  }
};

// Optional: Add a function to check if the service is available
export const checkFHIRServiceHealth = async () => {
  try {
    const functionUrl = 'https://us-central1-belrose-757fe.cloudfunctions.net/health';
    const response = await fetch(functionUrl);
    return response.ok;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
};