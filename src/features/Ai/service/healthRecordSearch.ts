import { FHIRBundle, FHIRResource } from '@/types/fhir';

interface SearchResult {
  relevantRecords: string[];
  context: string;
}

/**
 * Simple keyword-based search through FHIR records
 * This is Phase 1 - no embeddings, just text matching
 */
export class HealthRecordSearch {
  /**
   * Search through decrypted FHIR records for relevant context
   * @param fhirBundle - The user's decrypted FHIR bundle
   * @param query - The user's question
   * @returns Relevant records as formatted text
   */
  static searchRecords(fhirBundle: FHIRBundle | null, query: string): SearchResult {
    if (!fhirBundle || !fhirBundle.entry || fhirBundle.entry.length === 0) {
      return {
        relevantRecords: [],
        context: 'No health records available.',
      };
    }

    const queryLower = query.toLowerCase();
    const keywords = this.extractKeywords(queryLower);

    // Score each record based on keyword matches
    const scoredRecords = fhirBundle.entry
      .map(entry => ({
        resource: entry.resource,
        score: this.scoreResource(entry.resource, keywords, queryLower),
        text: this.formatResourceForContext(entry.resource),
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 most relevant

    const relevantRecords = scoredRecords.map(item => item.text);

    const context =
      relevantRecords.length > 0
        ? `Relevant health records:\n\n${relevantRecords.join('\n\n---\n\n')}`
        : 'No relevant health records found for this question.';

    return { relevantRecords, context };
  }

  /**
   * Extract meaningful keywords from query
   */
  private static extractKeywords(query: string): string[] {
    // Remove common words
    const stopWords = new Set([
      'what',
      'when',
      'where',
      'who',
      'how',
      'why',
      'is',
      'are',
      'was',
      'were',
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'my',
      'your',
      'their',
      'our',
      'have',
      'has',
      'had',
      'been',
      'can',
      'could',
      'should',
      'would',
    ]);

    return query.split(/\s+/).filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Score a FHIR resource based on keyword matches
   */
  private static scoreResource(
    resource: FHIRResource,
    keywords: string[],
    fullQuery: string
  ): number {
    const resourceText = JSON.stringify(resource).toLowerCase();
    let score = 0;

    // Check for exact phrase match (highest score)
    if (resourceText.includes(fullQuery)) {
      score += 10;
    }

    // Check for individual keyword matches
    keywords.forEach(keyword => {
      if (resourceText.includes(keyword)) {
        score += 2;
      }
    });

    // Boost score based on resource type relevance
    const resourceType = resource.resourceType?.toLowerCase() || '';

    // Medical keywords get higher priority for certain resource types
    if (this.isMedicalQuery(fullQuery)) {
      if (['observation', 'diagnosticreport', 'condition'].includes(resourceType)) {
        score += 3;
      }
    }

    if (this.isMedicationQuery(fullQuery)) {
      if (['medicationrequest', 'medicationstatement'].includes(resourceType)) {
        score += 3;
      }
    }

    return score;
  }

  /**
   * Check if query is about medical tests/results
   */
  private static isMedicalQuery(query: string): boolean {
    const medicalTerms = ['test', 'result', 'blood', 'pressure', 'cholesterol', 'glucose', 'lab'];
    return medicalTerms.some(term => query.includes(term));
  }

  /**
   * Check if query is about medications
   */
  private static isMedicationQuery(query: string): boolean {
    const medTerms = ['medication', 'medicine', 'drug', 'prescription', 'pill'];
    return medTerms.some(term => query.includes(term));
  }

  /**
   * Format a FHIR resource into human-readable text for context
   */
  private static formatResourceForContext(resource: FHIRResource): string {
    const type = resource.resourceType || 'Unknown';
    let summary = `[${type}]`;

    switch (type) {
      case 'Observation':
        summary += this.formatObservation(resource);
        break;
      case 'Condition':
        summary += this.formatCondition(resource);
        break;
      case 'MedicationRequest':
      case 'MedicationStatement':
        summary += this.formatMedication(resource);
        break;
      case 'Procedure':
        summary += this.formatProcedure(resource);
        break;
      case 'DiagnosticReport':
        summary += this.formatDiagnosticReport(resource);
        break;
      default:
        // Generic formatting
        summary += ` ${JSON.stringify(resource, null, 2)}`;
    }

    return summary;
  }

  private static formatObservation(obs: any): string {
    const code = obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown test';
    const value = obs.valueQuantity
      ? `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ''}`
      : obs.valueString || obs.valueCodeableConcept?.text || 'No value';
    const date = obs.effectiveDateTime || obs.issued || '';

    return ` ${code}: ${value}${date ? ` (${date})` : ''}`;
  }

  private static formatCondition(condition: any): string {
    const name =
      condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition';
    const onset = condition.onsetDateTime || condition.recordedDate || '';

    return ` ${name}${onset ? ` (since ${onset})` : ''}`;
  }

  private static formatMedication(med: any): string {
    const name =
      med.medicationCodeableConcept?.text ||
      med.medicationCodeableConcept?.coding?.[0]?.display ||
      'Unknown medication';
    const dosage = med.dosageInstruction?.[0]?.text || '';

    return ` ${name}${dosage ? ` - ${dosage}` : ''}`;
  }

  private static formatProcedure(proc: any): string {
    const name = proc.code?.text || proc.code?.coding?.[0]?.display || 'Unknown procedure';
    const date = proc.performedDateTime || proc.performedPeriod?.start || '';

    return ` ${name}${date ? ` (${date})` : ''}`;
  }

  private static formatDiagnosticReport(report: any): string {
    const name = report.code?.text || report.code?.coding?.[0]?.display || 'Unknown report';
    const date = report.effectiveDateTime || report.issued || '';

    return ` ${name}${date ? ` (${date})` : ''}`;
  }
}
