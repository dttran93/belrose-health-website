// src/features/RecordRefinement/types.ts

/**
 * Types for the record refinement feature.
 * Used by useRecordRefinement (hook), recordRefinementService (client),
 * and the refineRecord Cloud Function (backend).
 */

// ── Status ────────────────────────────────────────────────────────────────────

export type RefinementStatus =
  | 'idle' // hook initialized, startRefinement() not yet called
  | 'analyzing' // AI call in progress (either turn)
  | 'needs_review' // AI returned questions, waiting for user answers
  | 'complete' // refinement done, record updated
  | 'error'; // something failed

// ── Questions ─────────────────────────────────────────────────────────────────

export type RefinementQuestionType =
  | 'choice' // user picks from a list of options
  | 'text' // user types a free-text answer
  | 'confirm'; // user confirms or denies a statement (yes/no)

export type RefinementQuestionField =
  | 'fhir' // question is about structured FHIR data
  | 'belroseFields' // question is about the human-readable fields
  | 'metadata' // question is about record metadata (e.g. subjects)
  | 'split'; // AI is suggesting the record should be split

export interface RefinementQuestion {
  id: string; // unique ID used to match answers back to questions
  type: RefinementQuestionType;
  field: RefinementQuestionField;
  question: string; // the question text shown to the user
  options?: string[]; // only populated for 'choice' type
  context?: string; // optional supporting detail, e.g. "Found on page 2"
}

// ── Answers ───────────────────────────────────────────────────────────────────

export interface RefinementAnswer {
  questionId: string; // matches RefinementQuestion.id
  answer: string; // always a string — choices are the selected option text,
  // confirms are 'yes' or 'no', text is freeform
}

// ── AI Response ───────────────────────────────────────────────────────────────

// What the Cloud Function returns for both the analyze and refine turns.
// On the analyze turn: either complete (no issues found) or needs_clarification
// On the refine turn: always complete with updated data

export interface RefinementAIResponse {
  status: 'needs_clarification' | 'complete';
  questions: RefinementQuestion[]; // empty array if status is 'complete'
  updatedFhirData?: any; // populated on 'complete', null if no changes needed
  updatedBelroseFields?: any; // populated on 'complete', null if no changes needed
  recordTitle?: string;
}
