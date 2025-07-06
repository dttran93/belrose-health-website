const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

exports.convertToFHIR = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
      const { documentText, documentType = 'medical_record' } = req.body;

      // Validate input
      if (!documentText || typeof documentText !== 'string') {
        return res.status(400).json({ error: 'documentText is required and must be a string' });
      }

      // Get API key from Firebase config
      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_KEY;
      
      if (!ANTHROPIC_API_KEY) {
        console.error('Anthropic API key not configured');
        return res.status(500).json({ error: 'API key not configured' });
      }

      const prompt = `
        You are a medical data specialist. Convert the following medical document into a valid FHIR (Fast Healthcare Interoperability Resources) R4 format JSON.

        Document Type: ${documentType}
        Document Content:
        ${documentText}

        Requirements:
        1. Create appropriate FHIR resources (Patient, Observation, Condition, MedicationStatement, etc.)
        2. Use proper FHIR resource structure and data types
        3. Include all relevant medical information from the document
        4. Generate realistic but anonymous identifiers
        5. Follow FHIR R4 specification
        6. Return only valid JSON, no additional text

        Return the result as a FHIR Bundle resource containing all relevant resources.
      `;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          temperature: 0.1,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Anthropic API error:', errorData);
        throw new Error(`Claude API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      
      // Extract the JSON from Claude's response
      let fhirContent = data.content[0].text;
      
      // Sometimes Claude wraps JSON in markdown code blocks, so we need to extract it
      if (fhirContent.includes('```json')) {
        const jsonMatch = fhirContent.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          fhirContent = jsonMatch[1];
        }
      } else if (fhirContent.includes('```')) {
        const jsonMatch = fhirContent.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          fhirContent = jsonMatch[1];
        }
      }
      
      // Parse and validate the JSON
      const fhirJson = JSON.parse(fhirContent);
      
      // Basic validation that it's a FHIR Bundle
      if (!fhirJson.resourceType || fhirJson.resourceType !== 'Bundle') {
        throw new Error('Response is not a valid FHIR Bundle');
      }
      
      // Return the FHIR data
      res.json(fhirJson);

    } catch (error) {
      console.error('FHIR conversion error:', error);
      
      // Return appropriate error response
      if (error.message.includes('JSON')) {
        res.status(500).json({ error: 'Failed to parse FHIR response from Claude' });
      } else if (error.message.includes('Claude API')) {
        res.status(502).json({ error: 'External API error' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });
});

// Optional: Add a health check endpoint
exports.health = functions.https.onRequest((req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});