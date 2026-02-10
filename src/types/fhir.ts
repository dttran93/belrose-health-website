// src/types/fhir.ts - Complete FHIR Type Definitions

// ============================================================================
// BASE FHIR TYPES
// ============================================================================

export interface FHIRBundle {
  resourceType: 'Bundle';
  id: string;
  type:
    | 'document'
    | 'collection'
    | 'searchset'
    | 'history'
    | 'transaction'
    | 'transaction-response'
    | 'batch'
    | 'batch-response';
  timestamp?: string;
  total?: number;
  entry: FHIREntry[];
}

export interface FHIREntry {
  fullUrl?: string;
  resource: FHIRResource;
  search?: {
    mode: 'match' | 'include';
    score?: number;
  };
}

// Union type of all FHIR resources you'll use
export type FHIRResource =
  | PatientResource
  | ObservationResource
  | DocumentReferenceResource
  | PractitionerResource
  | OrganizationResource
  | ConditionResource
  | ProcedureResource
  | MedicationRequestResource
  | MedicationStatementResource
  | DiagnosticReportResource
  | AllergyIntoleranceResource
  | ImmunizationResource;

// ============================================================================
// SHARED/COMMON FHIR TYPES
// ============================================================================

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface Coding {
  system?: string;
  code: string;
  display?: string;
  version?: string;
}

export interface Quantity {
  value: number;
  unit?: string;
  system?: string;
  code?: string;
  comparator?: '<' | '<=' | '>=' | '>';
}

export interface Reference {
  reference: string;
  display?: string;
  type?: string;
}

export interface ContactPoint {
  system: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: Period;
}

export interface Address {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: Period;
}

export interface Period {
  start?: string; // DateTime
  end?: string; // DateTime
}

export interface HumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: Period;
}

export interface Identifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: CodeableConcept;
  system?: string;
  value?: string;
  period?: Period;
  assigner?: Reference;
}

export interface Attachment {
  contentType?: string;
  language?: string;
  data?: string; // base64Binary
  url?: string;
  size?: number;
  hash?: string; // base64Binary
  title?: string;
  creation?: string; // DateTime
}

// ============================================================================
// PATIENT RESOURCE
// ============================================================================

export interface PatientResource {
  resourceType: 'Patient';
  id: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];

  // Patient-specific fields
  identifier?: Identifier[];
  active?: boolean;
  name: HumanName[];
  telecom?: ContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string; // YYYY-MM-DD format
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: Address[];
  maritalStatus?: CodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  photo?: Attachment[];
  contact?: PatientContact[];
  communication?: PatientCommunication[];
  generalPractitioner?: Reference[];
  managingOrganization?: Reference;
  link?: PatientLink[];
}

export interface PatientContact {
  relationship?: CodeableConcept[];
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  organization?: Reference;
  period?: Period;
}

export interface PatientCommunication {
  language: CodeableConcept;
  preferred?: boolean;
}

export interface PatientLink {
  other: Reference;
  type: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
}

// ============================================================================
// OBSERVATION RESOURCE
// ============================================================================

export interface ObservationResource {
  resourceType: 'Observation';
  id: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];

  // Observation-specific fields
  identifier?: Identifier[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status:
    | 'registered'
    | 'preliminary'
    | 'final'
    | 'amended'
    | 'corrected'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown';
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject?: Reference;
  focus?: Reference[];
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  effectiveTiming?: Timing;
  effectiveInstant?: string;
  issued?: string;
  performer?: Reference[];
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueSampledData?: SampledData;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  note?: Annotation[];
  bodySite?: CodeableConcept;
  method?: CodeableConcept;
  specimen?: Reference;
  device?: Reference;
  referenceRange?: ObservationReferenceRange[];
  hasMember?: Reference[];
  derivedFrom?: Reference[];
  component?: ObservationComponent[];
}

// This was missing - that's why you got the error!
export interface ObservationComponent {
  code: CodeableConcept;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueSampledData?: SampledData;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  referenceRange?: ObservationReferenceRange[];
}

export interface ObservationReferenceRange {
  low?: Quantity;
  high?: Quantity;
  type?: CodeableConcept;
  appliesTo?: CodeableConcept[];
  age?: Range;
  text?: string;
}

// ============================================================================
// DOCUMENT REFERENCE RESOURCE
// ============================================================================

export interface DocumentReferenceResource {
  resourceType: 'DocumentReference';
  id: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];

  // DocumentReference-specific fields
  masterIdentifier?: Identifier;
  identifier?: Identifier[];
  status: 'current' | 'superseded' | 'entered-in-error';
  docStatus?: 'preliminary' | 'final' | 'amended' | 'entered-in-error';
  type?: CodeableConcept;
  category?: CodeableConcept[];
  subject?: Reference;
  date?: string;
  author?: Reference[];
  authenticator?: Reference;
  custodian?: Reference;
  relatesTo?: DocumentReferenceRelatesTo[];
  description?: string;
  securityLabel?: CodeableConcept[];
  content: DocumentReferenceContent[];
  context?: DocumentReferenceContext;
}

export interface DocumentReferenceContent {
  attachment: Attachment;
  format?: Coding;
}

export interface DocumentReferenceRelatesTo {
  code: 'replaces' | 'transforms' | 'signs' | 'appends';
  target: Reference;
}

export interface DocumentReferenceContext {
  encounter?: Reference[];
  event?: CodeableConcept[];
  period?: Period;
  facilityType?: CodeableConcept;
  practiceSetting?: CodeableConcept;
  sourcePatientInfo?: Reference;
  related?: Reference[];
}

// ============================================================================
// PRACTITIONER RESOURCE
// ============================================================================

export interface PractitionerResource {
  resourceType: 'Practitioner';
  id: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];

  // Practitioner-specific fields
  identifier?: Identifier[];
  active?: boolean;
  name?: HumanName[];
  telecom?: ContactPoint[];
  address?: Address[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  photo?: Attachment[];
  qualification?: PractitionerQualification[];
  communication?: CodeableConcept[];
}

export interface PractitionerQualification {
  identifier?: Identifier[];
  code: CodeableConcept;
  period?: Period;
  issuer?: Reference;
}

// ============================================================================
// ORGANIZATION RESOURCE
// ============================================================================

export interface OrganizationResource {
  resourceType: 'Organization';
  id: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];

  // Organization-specific fields
  identifier?: Identifier[];
  active?: boolean;
  type?: CodeableConcept[];
  name?: string;
  alias?: string[];
  telecom?: ContactPoint[];
  address?: Address[];
  partOf?: Reference;
  contact?: OrganizationContact[];
  endpoint?: Reference[];
}

export interface OrganizationContact {
  purpose?: CodeableConcept;
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
}

// ============================================================================
// CONDITION RESOURCE (Diagnoses, Problems)
// ============================================================================

export interface ConditionResource {
  resourceType: 'Condition';
  id: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];

  // Condition-specific fields
  identifier?: Identifier[];
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  category?: CodeableConcept[];
  severity?: CodeableConcept;
  code?: CodeableConcept;
  bodySite?: CodeableConcept[];
  subject: Reference;
  encounter?: Reference;
  onsetDateTime?: string;
  onsetAge?: Age;
  onsetPeriod?: Period;
  onsetRange?: Range;
  onsetString?: string;
  abatementDateTime?: string;
  abatementAge?: Age;
  abatementPeriod?: Period;
  abatementRange?: Range;
  abatementString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  stage?: ConditionStage[];
  evidence?: ConditionEvidence[];
  note?: Annotation[];
}

export interface ConditionStage {
  summary?: CodeableConcept;
  assessment?: Reference[];
  type?: CodeableConcept;
}

export interface ConditionEvidence {
  code?: CodeableConcept[];
  detail?: Reference[];
}

// ============================================================================
// PROCEDURE RESOURCE (Surgeries, Treatments)
// ============================================================================

export interface ProcedureResource {
  resourceType: 'Procedure';
  id: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];

  // Procedure-specific fields
  identifier?: Identifier[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status:
    | 'preparation'
    | 'in-progress'
    | 'not-done'
    | 'on-hold'
    | 'stopped'
    | 'completed'
    | 'entered-in-error'
    | 'unknown';
  statusReason?: CodeableConcept;
  category?: CodeableConcept;
  code?: CodeableConcept;
  subject: Reference;
  encounter?: Reference;
  performedDateTime?: string;
  performedPeriod?: Period;
  performedString?: string;
  performedAge?: Age;
  performedRange?: Range;
  recorder?: Reference;
  asserter?: Reference;
  performer?: ProcedurePerformer[];
  location?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  bodySite?: CodeableConcept[];
  outcome?: CodeableConcept;
  report?: Reference[];
  complication?: CodeableConcept[];
  complicationDetail?: Reference[];
  followUp?: CodeableConcept[];
  note?: Annotation[];
  focalDevice?: ProcedureFocalDevice[];
  usedReference?: Reference[];
  usedCode?: CodeableConcept[];
}

export interface ProcedurePerformer {
  function?: CodeableConcept;
  actor: Reference;
  onBehalfOf?: Reference;
}

export interface ProcedureFocalDevice {
  action?: CodeableConcept;
  manipulated: Reference;
}

// ============================================================================
// MEDICATION REQUEST RESOURCE (Prescriptions)
// ============================================================================

export interface MedicationRequestResource {
  resourceType: 'MedicationRequest';
  id: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];

  // MedicationRequest-specific fields
  identifier?: Identifier[];
  status:
    | 'active'
    | 'on-hold'
    | 'cancelled'
    | 'completed'
    | 'entered-in-error'
    | 'stopped'
    | 'draft'
    | 'unknown';
  statusReason?: CodeableConcept;
  intent:
    | 'proposal'
    | 'plan'
    | 'order'
    | 'original-order'
    | 'reflex-order'
    | 'filler-order'
    | 'instance-order'
    | 'option';
  category?: CodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  doNotPerform?: boolean;
  reportedBoolean?: boolean;
  reportedReference?: Reference;
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: Reference;
  subject: Reference;
  encounter?: Reference;
  supportingInformation?: Reference[];
  authoredOn?: string;
  requester?: Reference;
  performer?: Reference;
  performerType?: CodeableConcept;
  recorder?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: Reference[];
  groupIdentifier?: Identifier;
  courseOfTherapyType?: CodeableConcept;
  insurance?: Reference[];
  note?: Annotation[];
  dosageInstruction?: Dosage[];
  dispenseRequest?: MedicationRequestDispenseRequest;
  substitution?: MedicationRequestSubstitution;
  priorPrescription?: Reference;
  detectedIssue?: Reference[];
  eventHistory?: Reference[];
}

export interface MedicationRequestDispenseRequest {
  initialFill?: {
    quantity?: Quantity;
    duration?: Duration;
  };
  dispenseInterval?: Duration;
  validityPeriod?: Period;
  numberOfRepeatsAllowed?: number;
  quantity?: Quantity;
  expectedSupplyDuration?: Duration;
  performer?: Reference;
}

export interface MedicationRequestSubstitution {
  allowedBoolean?: boolean;
  allowedCodeableConcept?: CodeableConcept;
  reason?: CodeableConcept;
}

// ============================================================================
// MEDICATION STATEMENT RESOURCE (What patient is taking)
// ============================================================================

export interface MedicationStatementResource {
  resourceType: 'MedicationStatement';
  id: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];

  // MedicationStatement-specific fields
  identifier?: Identifier[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status:
    | 'active'
    | 'completed'
    | 'entered-in-error'
    | 'intended'
    | 'stopped'
    | 'on-hold'
    | 'unknown'
    | 'not-taken';
  statusReason?: CodeableConcept[];
  category?: CodeableConcept;
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: Reference;
  subject: Reference;
  context?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  dateAsserted?: string;
  informationSource?: Reference;
  derivedFrom?: Reference[];
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  note?: Annotation[];
  dosage?: Dosage[];
}

// ============================================================================
// DIAGNOSTIC REPORT RESOURCE (Lab/Imaging Reports)
// ============================================================================

export interface DiagnosticReportResource {
  resourceType: 'DiagnosticReport';
  id: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];

  // DiagnosticReport-specific fields
  identifier?: Identifier[];
  basedOn?: Reference[];
  status:
    | 'registered'
    | 'partial'
    | 'preliminary'
    | 'final'
    | 'amended'
    | 'corrected'
    | 'appended'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown';
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject?: Reference;
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  issued?: string;
  performer?: Reference[];
  resultsInterpreter?: Reference[];
  specimen?: Reference[];
  result?: Reference[]; // References to Observations
  imagingStudy?: Reference[];
  media?: DiagnosticReportMedia[];
  conclusion?: string;
  conclusionCode?: CodeableConcept[];
  presentedForm?: Attachment[];
}

export interface DiagnosticReportMedia {
  comment?: string;
  link: Reference;
}

// ============================================================================
// ALLERGY INTOLERANCE RESOURCE
// ============================================================================

export interface AllergyIntoleranceResource {
  resourceType: 'AllergyIntolerance';
  id: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];

  // AllergyIntolerance-specific fields
  identifier?: Identifier[];
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  type?: 'allergy' | 'intolerance';
  category?: ('food' | 'medication' | 'environment' | 'biologic')[];
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code?: CodeableConcept;
  patient: Reference;
  encounter?: Reference;
  onsetDateTime?: string;
  onsetAge?: Age;
  onsetPeriod?: Period;
  onsetRange?: Range;
  onsetString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  lastOccurrence?: string;
  note?: Annotation[];
  reaction?: AllergyIntoleranceReaction[];
}

export interface AllergyIntoleranceReaction {
  substance?: CodeableConcept;
  manifestation: CodeableConcept[];
  description?: string;
  onset?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  exposureRoute?: CodeableConcept;
  note?: Annotation[];
}

// ============================================================================
// IMMUNIZATION RESOURCE (Vaccines)
// ============================================================================

export interface ImmunizationResource {
  resourceType: 'Immunization';
  id: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: FHIRResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];

  // Immunization-specific fields
  identifier?: Identifier[];
  status: 'completed' | 'entered-in-error' | 'not-done';
  statusReason?: CodeableConcept;
  vaccineCode: CodeableConcept;
  patient: Reference;
  encounter?: Reference;
  occurrenceDateTime?: string;
  occurrenceString?: string;
  recorded?: string;
  primarySource?: boolean;
  reportOrigin?: CodeableConcept;
  location?: Reference;
  manufacturer?: Reference;
  lotNumber?: string;
  expirationDate?: string;
  site?: CodeableConcept;
  route?: CodeableConcept;
  doseQuantity?: Quantity;
  performer?: ImmunizationPerformer[];
  note?: Annotation[];
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  isSubpotent?: boolean;
  subpotentReason?: CodeableConcept[];
  education?: ImmunizationEducation[];
  programEligibility?: CodeableConcept[];
  fundingSource?: CodeableConcept;
  reaction?: ImmunizationReaction[];
  protocolApplied?: ImmunizationProtocolApplied[];
}

export interface ImmunizationPerformer {
  function?: CodeableConcept;
  actor: Reference;
}

export interface ImmunizationEducation {
  documentType?: string;
  reference?: string;
  publicationDate?: string;
  presentationDate?: string;
}

export interface ImmunizationReaction {
  date?: string;
  detail?: Reference;
  reported?: boolean;
}

export interface ImmunizationProtocolApplied {
  series?: string;
  authority?: Reference;
  targetDisease?: CodeableConcept[];
  doseNumberPositiveInt?: number;
  doseNumberString?: string;
  seriesDosesPositiveInt?: number;
  seriesDosesString?: string;
}

// ============================================================================
// ADDITIONAL SUPPORTING TYPES
// ============================================================================

export interface Meta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  security?: Coding[];
  tag?: Coding[];
}

export interface Narrative {
  status: 'generated' | 'extensions' | 'additional' | 'empty';
  div: string; // xhtml
}

export interface Extension {
  url: string;
  valueBase64Binary?: string;
  valueBoolean?: boolean;
  valueCanonical?: string;
  valueCode?: string;
  valueDate?: string;
  valueDateTime?: string;
  valueDecimal?: number;
  valueId?: string;
  valueInstant?: string;
  valueInteger?: number;
  valueMarkdown?: string;
  valueOid?: string;
  valuePositiveInt?: number;
  valueString?: string;
  valueTime?: string;
  valueUnsignedInt?: number;
  valueUri?: string;
  valueUrl?: string;
  valueUuid?: string;
  valueAddress?: Address;
  valueAge?: Age;
  valueAnnotation?: Annotation;
  valueAttachment?: Attachment;
  valueCodeableConcept?: CodeableConcept;
  valueCoding?: Coding;
  valueContactPoint?: ContactPoint;
  valueCount?: Count;
  valueDistance?: Distance;
  valueDuration?: Duration;
  valueHumanName?: HumanName;
  valueIdentifier?: Identifier;
  valueMoney?: Money;
  valuePeriod?: Period;
  valueQuantity?: Quantity;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueReference?: Reference;
  valueSampledData?: SampledData;
  valueSignature?: Signature;
  valueTiming?: Timing;
  valueContactDetail?: ContactDetail;
  valueContributor?: Contributor;
  valueDataRequirement?: DataRequirement;
  valueExpression?: Expression;
  valueParameterDefinition?: ParameterDefinition;
  valueRelatedArtifact?: RelatedArtifact;
  valueTriggerDefinition?: TriggerDefinition;
  valueUsageContext?: UsageContext;
  valueDosage?: Dosage;
}

// Simplified versions of complex types for your use case
export interface Range {
  low?: Quantity;
  high?: Quantity;
}

export interface Ratio {
  numerator?: Quantity;
  denominator?: Quantity;
}

export interface SampledData {
  origin: Quantity;
  period: number;
  factor?: number;
  lowerLimit?: number;
  upperLimit?: number;
  dimensions: number;
  data?: string;
}

export interface Annotation {
  authorReference?: Reference;
  authorString?: string;
  time?: string;
  text: string;
}

export interface Timing {
  event?: string[];
  repeat?: TimingRepeat;
  code?: CodeableConcept;
}

export interface TimingRepeat {
  boundsDuration?: Duration;
  boundsRange?: Range;
  boundsPeriod?: Period;
  count?: number;
  countMax?: number;
  duration?: number;
  durationMax?: number;
  durationUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
  frequency?: number;
  frequencyMax?: number;
  period?: number;
  periodMax?: number;
  periodUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
  dayOfWeek?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  timeOfDay?: string[];
  when?: (
    | 'MORN'
    | 'MORN.early'
    | 'MORN.late'
    | 'NOON'
    | 'AFT'
    | 'AFT.early'
    | 'AFT.late'
    | 'EVE'
    | 'EVE.early'
    | 'EVE.late'
    | 'NIGHT'
    | 'PHS'
    | 'HS'
    | 'WAKE'
    | 'C'
    | 'CM'
    | 'CD'
    | 'CV'
    | 'AC'
    | 'ACM'
    | 'ACD'
    | 'ACV'
    | 'PC'
    | 'PCM'
    | 'PCD'
    | 'PCV'
  )[];
  offset?: number;
}

// Simple quantity-based types
export interface Age extends Quantity {}
export interface Count extends Quantity {}
export interface Distance extends Quantity {}
export interface Duration extends Quantity {}
export interface Money extends Quantity {}

// Placeholder types for less commonly used complex types
// You can expand these if/when you need them
export interface Signature {
  type: Coding[];
  when: string;
  who: Reference;
  onBehalfOf?: Reference;
  targetFormat?: string;
  sigFormat?: string;
  data?: string;
}

export interface ContactDetail {
  name?: string;
  telecom?: ContactPoint[];
}

export interface Contributor {
  type: 'author' | 'editor' | 'reviewer' | 'endorser';
  name: string;
  contact?: ContactDetail[];
}

export interface DataRequirement {
  type: string;
  profile?: string[];
  subjectCodeableConcept?: CodeableConcept;
  subjectReference?: Reference;
  mustSupport?: string[];
  codeFilter?: DataRequirementCodeFilter[];
  dateFilter?: DataRequirementDateFilter[];
  limit?: number;
  sort?: DataRequirementSort[];
}

export interface DataRequirementCodeFilter {
  path?: string;
  searchParam?: string;
  valueSet?: string;
  code?: Coding[];
}

export interface DataRequirementDateFilter {
  path?: string;
  searchParam?: string;
  valueDateTime?: string;
  valuePeriod?: Period;
  valueDuration?: Duration;
}

export interface DataRequirementSort {
  path: string;
  direction: 'ascending' | 'descending';
}

export interface Expression {
  description?: string;
  name?: string;
  language: string;
  expression?: string;
  reference?: string;
}

export interface ParameterDefinition {
  name?: string;
  use: 'in' | 'out';
  min?: number;
  max?: string;
  documentation?: string;
  type: string;
  profile?: string;
}

export interface RelatedArtifact {
  type:
    | 'documentation'
    | 'justification'
    | 'citation'
    | 'predecessor'
    | 'successor'
    | 'derived-from'
    | 'depends-on'
    | 'composed-of';
  label?: string;
  display?: string;
  citation?: string;
  url?: string;
  document?: Attachment;
  resource?: string;
}

export interface TriggerDefinition {
  type:
    | 'named-event'
    | 'periodic'
    | 'data-changed'
    | 'data-added'
    | 'data-modified'
    | 'data-removed'
    | 'data-accessed'
    | 'data-access-ended';
  name?: string;
  timingTiming?: Timing;
  timingReference?: Reference;
  timingDate?: string;
  timingDateTime?: string;
  data?: DataRequirement[];
  condition?: Expression;
}

export interface UsageContext {
  code: Coding;
  valueCodeableConcept?: CodeableConcept;
  valueQuantity?: Quantity;
  valueRange?: Range;
  valueReference?: Reference;
}

export interface Dosage {
  sequence?: number;
  text?: string;
  additionalInstruction?: CodeableConcept[];
  patientInstruction?: string;
  timing?: Timing;
  asNeededBoolean?: boolean;
  asNeededCodeableConcept?: CodeableConcept;
  site?: CodeableConcept;
  route?: CodeableConcept;
  method?: CodeableConcept;
  doseAndRate?: DosageDoseAndRate[];
  maxDosePerPeriod?: Ratio;
  maxDosePerAdministration?: Quantity;
  maxDosePerLifetime?: Quantity;
}

export interface DosageDoseAndRate {
  type?: CodeableConcept;
  doseRange?: Range;
  doseQuantity?: Quantity;
  rateRatio?: Ratio;
  rateRange?: Range;
  rateQuantity?: Quantity;
}

// ============================================================================
// UTILITY TYPES FOR YOUR APP
// ============================================================================

// Helper type for creating new FHIR resources
export type CreateFHIRResource<T extends FHIRResource> = Omit<T, 'id'> & {
  id?: string;
};

// Helper type for partial updates
export type UpdateFHIRResource<T extends FHIRResource> = Partial<T> & {
  id: string;
  resourceType: T['resourceType'];
};

// Type guards for runtime type checking
export function isPatientResource(resource: FHIRResource): resource is PatientResource {
  return resource.resourceType === 'Patient';
}

export function isObservationResource(resource: FHIRResource): resource is ObservationResource {
  return resource.resourceType === 'Observation';
}

export function isDocumentReferenceResource(
  resource: FHIRResource
): resource is DocumentReferenceResource {
  return resource.resourceType === 'DocumentReference';
}

export function isPractitionerResource(resource: FHIRResource): resource is PractitionerResource {
  return resource.resourceType === 'Practitioner';
}

export function isOrganizationResource(resource: FHIRResource): resource is OrganizationResource {
  return resource.resourceType === 'Organization';
}

export function isConditionResource(resource: FHIRResource): resource is ConditionResource {
  return resource.resourceType === 'Condition';
}

export function isProcedureResource(resource: FHIRResource): resource is ProcedureResource {
  return resource.resourceType === 'Procedure';
}

export function isMedicationRequestResource(
  resource: FHIRResource
): resource is MedicationRequestResource {
  return resource.resourceType === 'MedicationRequest';
}

export function isMedicationStatementResource(
  resource: FHIRResource
): resource is MedicationStatementResource {
  return resource.resourceType === 'MedicationStatement';
}

export function isDiagnosticReportResource(
  resource: FHIRResource
): resource is DiagnosticReportResource {
  return resource.resourceType === 'DiagnosticReport';
}

export function isAllergyIntoleranceResource(
  resource: FHIRResource
): resource is AllergyIntoleranceResource {
  return resource.resourceType === 'AllergyIntolerance';
}

export function isImmunizationResource(resource: FHIRResource): resource is ImmunizationResource {
  return resource.resourceType === 'Immunization';
}
