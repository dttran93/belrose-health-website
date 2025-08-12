import {
  AIProcessingInput,
  AIProcessingResult,
  AIProcessingConfig,
  AIProcessingError,
  AIProcessingErrorCode,
  DEFAULT_AI_CONFIG,
  FHIRAnalysis,
  ProcessingContext,
  IAIRecordProcessingService,
  MockConfig
} from './aiRecordProcessingService.type';

// ==================== AI RECORD PROCESSING SERVICE ====================

/**
 * Service for processing FHIR records with AI to extract clean metadata
 */
export class AIRecordProcessingService implements IAIRecordProcessingService {
  private config: Required<AIProcessingConfig>;
  private mockConfig?: MockConfig;

  constructor(config: AIProcessingConfig = {}, mockConfig?: MockConfig) {
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
    this.mockConfig = mockConfig;
  }

  /**
   * Main method to process a FHIR record with AI
   */
  async processRecord(input: AIProcessingInput): Promise<AIProcessingResult> {
    console.log('🤖 Starting AI processing for record...');

    // Validate input
    this.validateInput(input);

    let lastError: any;
    
    // Retry logic
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`🔄 AI processing attempt ${attempt}/${this.config.retryAttempts}`);
        
        const result = await this.processWithTimeout(input, attempt);
        
        console.log('✅ AI processing completed successfully');
        return result;
        
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ AI processing attempt ${attempt} failed:`, error);
        
        // Don't retry for certain error types
        if (this.isNonRetryableError(error)) {
          break;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < this.config.retryAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw this.createProcessingError(lastError);
  }

  /**
   * Process with timeout wrapper
   */
  private async processWithTimeout(input: AIProcessingInput, attempt: number): Promise<AIProcessingResult> {
    const context: ProcessingContext = {
      input,
      analysis: this.analyzeFHIRStructure(input.fhirData),
      attempt,
      startTime: Date.now()
    };

    return Promise.race([
      this.performAIProcessing(context),
      this.createTimeoutPromise()
    ]);
  }

  /**
   * The actual AI processing logic - replace this with your AI service
   */
  private async performAIProcessing(context: ProcessingContext): Promise<AIProcessingResult> {
    console.log('🧠 Calling AI service...');

    // Use mock if enabled
    if (this.mockConfig?.enabled) {
      return this.mockAIProcessing(context);
    }

    // TODO: Replace this with your actual AI service call
    try {
      // Example real AI service call:
      // const response = await fetch(this.config.apiEndpoint, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.config.apiKey}`
      //   },
      //   body: JSON.stringify({
      //     fhirData: context.input.fhirData,
      //     analysis: context.analysis,
      //     model: this.config.model
      //   })
      // });
      //
      // if (!response.ok) {
      //   throw new Error(`AI API returned ${response.status}: ${response.statusText}`);
      // }
      //
      // return response.json();

      // For now, use sophisticated mock analysis
      return this.mockAIProcessing(context);

    } catch (error) {
      throw new AIProcessingError(
        'AI service call failed',
        'AI_SERVICE_UNAVAILABLE',
        error
      );
    }
  }

  /**
   * Mock AI processing with sophisticated FHIR analysis
   */
  private async mockAIProcessing(context: ProcessingContext): Promise<AIProcessingResult> {
    const { input, analysis } = context;
    
    // Simulate processing time
    const delay = this.mockConfig?.delay || (2000 + Math.random() * 3000);
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate random failures for testing
    if (this.mockConfig?.failureRate && Math.random() < this.mockConfig.failureRate) {
      throw new AIProcessingError('Mock failure for testing', 'PROCESSING_FAILED');
    }

    console.log('🔍 Mock analyzing FHIR data structure...');

    // Start with defaults
    let visitType = 'Medical Record';
    let title = input.fileName || 'Health Record';
    let summary = 'Medical record processed.';
    let completedDate = new Date().toISOString().split('T')[0];
    let provider = 'Healthcare Provider';
    let institution = 'Medical Center';

    try {
      // Determine visit type based on resources
      if (analysis.diagnosticReports.length > 0) {
        visitType = 'Diagnostic Report';
        const report = analysis.diagnosticReports[0];
        title = `${report.resource?.code?.text || 'Diagnostic'} Report`;
      } else if (analysis.observations.length > 0) {
        visitType = 'Lab Results';
        const obs = analysis.observations[0];
        title = `${obs.resource?.code?.text || 'Lab'} Results`;
      } else if (analysis.encounters.length > 0) {
        visitType = 'Clinical Encounter';
        const encounter = analysis.encounters[0];
        title = encounter.resource?.type?.[0]?.text || 'Clinical Visit';
      }

      // Extract provider information
      if (analysis.practitioners.length > 0) {
        const practitioner = analysis.practitioners[0].resource;
        const name = practitioner?.name?.[0];
        if (name) {
          provider = `${name.prefix?.[0] || ''} ${name.given?.[0] || ''} ${name.family || ''}`.trim();
        }
      }

      // Extract institution
      if (analysis.organizations.length > 0) {
        institution = analysis.organizations[0].resource?.name || institution;
      }

      // Use best extracted date
      if (analysis.extractedDates.length > 0) {
        completedDate: analysis.extractedDates[0]?.split('T')[0] || new Date().toISOString().split('T')[0]
      }

      // Generate summary
      summary = `${visitType} containing ${analysis.resourceTypes.length} resource types: ${analysis.resourceTypes.join(', ')}.`;

      // Apply custom mock responses if provided
      if (this.mockConfig?.customResponses) {
        visitType = this.mockConfig.customResponses.visitType || visitType;
        title = this.mockConfig.customResponses.title || title;
        summary = this.mockConfig.customResponses.summary || summary;
        completedDate = this.mockConfig.customResponses.completedDate || completedDate;
        provider = this.mockConfig.customResponses.provider || provider;
        institution = this.mockConfig.customResponses.institution || institution;
      }

    } catch (error) {
      console.warn('⚠️ Error analyzing FHIR structure, using defaults:', error);
    }

    return {
      visitType,
      title: this.truncateString(title, 100),
      summary: this.truncateString(summary, 250),
      completedDate,
      provider: this.truncateString(provider, 100),
      institution: this.truncateString(institution, 100)
    };
  }

  /**
   * Analyze FHIR bundle structure
   */
  private analyzeFHIRStructure(fhirData: any): FHIRAnalysis {
    const entries = fhirData?.entry || [];
    
    const analysis: FHIRAnalysis = {
      resourceTypes: [],
      observations: [],
      encounters: [],
      diagnosticReports: [],
      practitioners: [],
      organizations: [],
      patients: [],
      extractedDates: []
    };

    for (const entry of entries) {
      const resource = entry.resource;
      if (!resource?.resourceType) continue;

      // Collect resource types
      if (!analysis.resourceTypes.includes(resource.resourceType)) {
        analysis.resourceTypes.push(resource.resourceType);
      }

      // Categorize resources
      switch (resource.resourceType) {
        case 'Observation':
          analysis.observations.push(entry);
          break;
        case 'Encounter':
          analysis.encounters.push(entry);
          break;
        case 'DiagnosticReport':
          analysis.diagnosticReports.push(entry);
          break;
        case 'Practitioner':
          analysis.practitioners.push(entry);
          break;
        case 'Organization':
          analysis.organizations.push(entry);
          break;
        case 'Patient':
          analysis.patients.push(entry);
          break;
      }

      // Extract dates
      const potentialDates = [
        resource.effectiveDateTime,
        resource.issued,
        resource.date,
        resource.period?.start
      ];

      const validDates = potentialDates.filter((date): date is string => 
        typeof date === 'string' && date.length > 0
      );

      analysis.extractedDates.push(...validDates);
    }

    // Sort dates to get most recent/relevant first
    analysis.extractedDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return analysis;
  }

  /**
   * Validate input data
   */
  private validateInput(input: AIProcessingInput): void {
    if (!input.fhirData) {
      throw new AIProcessingError(
        'FHIR data is required for AI processing',
        'INVALID_FHIR_DATA'
      );
    }

    if (typeof input.fhirData !== 'object') {
      throw new AIProcessingError(
        'FHIR data must be a valid object',
        'INVALID_FHIR_DATA'
      );
    }

    // Check if it looks like a FHIR bundle
    if (!input.fhirData.resourceType || !input.fhirData.entry) {
      console.warn('⚠️ Input data does not appear to be a valid FHIR bundle');
    }
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new AIProcessingError(
          `AI processing timed out after ${this.config.timeout}ms`,
          'TIMEOUT'
        ));
      }, this.config.timeout);
    });
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
    if (error instanceof AIProcessingError) {
      return ['INVALID_FHIR_DATA', 'INSUFFICIENT_DATA'].includes(error.code);
    }
    return false;
  }

  /**
   * Create appropriate error from caught error
   */
  private createProcessingError(error: any): AIProcessingError {
    if (error instanceof AIProcessingError) {
      return error;
    }

    return new AIProcessingError(
      error?.message || 'Unknown AI processing error',
      'UNKNOWN_ERROR',
      error
    );
  }

  /**
   * Utility to truncate strings safely
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }
}

// ==================== EXPORTED FUNCTIONS ====================

/**
 * Convenience function for single record processing
 */
export async function processRecordWithAI(
  fhirData: any, 
  options: { fileName?: string; extractedText?: string; config?: AIProcessingConfig } = {}
): Promise<AIProcessingResult> {
  const service = new AIRecordProcessingService(options.config, { enabled: true });
  
  return service.processRecord({
    fhirData,
    fileName: options.fileName,
    extractedText: options.extractedText
  });
}

/**
 * Create a configured service instance
 */
export function createAIProcessingService(
  config?: AIProcessingConfig, 
  mockConfig?: MockConfig
): AIRecordProcessingService {
  return new AIRecordProcessingService(config, mockConfig);
}

// ==================== DEFAULT EXPORT ====================

export default AIRecordProcessingService;