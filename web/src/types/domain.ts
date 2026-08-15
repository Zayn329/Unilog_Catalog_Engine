/**
 * Types for Unilog Catalog Engine Domain and API Contracts.
 */

export type JobStatus =
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "REVIEW_REQUIRED"
  | "UNCLASSIFIED_HUMAN_REVIEW"
  | "COMPLETED"
  | "FAILED_PARSING"
  | "FAILED"
  | "CANCELLED";

export type ProductStatus =
  | "RAW"
  | "VALIDATED"
  | "REVIEW_REQUIRED"
  | "UNCLASSIFIED_HUMAN_REVIEW"
  | "MANUAL_ENTRY"
  | "PUBLISHED"
  | "ARCHIVED";

export type EvidenceType = "SOURCE" | "RULE" | "DERIVED";

export type NormalizationMethod =
  | "PINT"
  | "REGEX"
  | "DICTIONARY"
  | "LLM_FALLBACK"
  | "DERIVED_RULE"
  | "MANUAL_ENTRY";

export interface BoundingBox {
  page_number: number;
  top_pct: number;
  left_pct: number;
  width_pct: number;
  height_pct: number;
}

export interface Evidence {
  evidence_id: string;
  evidence_type: EvidenceType;
  source_text?: string | null;
  page_number?: number | null;
  bounding_box?: BoundingBox | null;
  rule_id?: string | null;
  parent_attribute_ids?: string[] | null;
  confidence_score: number;
  is_verified?: boolean;
}

export interface AttributeRecord {
  attribute_id: string;
  product_id?: string;
  canonical_key: string;
  raw_key: string;
  raw_value: string;
  normalized_value?: string | null;
  numeric_value?: number | null;
  unit?: string | null;
  attribute_confidence: number;
  normalization_method: NormalizationMethod | string;
  is_derived: boolean;
  is_human_locked: boolean;
  locked_state_hash?: string | null;
  requires_human_review: boolean;
  evidence_id?: string;
  evidence_type?: string;
  source_text?: string | null;
  page_number?: number | null;
  bounding_box_json?: string | null;
  rule_id?: string | null;
  parent_attribute_ids_json?: string | null;
  evidence_confidence?: number;
  evidence_is_verified?: boolean;
  evidence?: Evidence;
}

export interface ProductRecord {
  product_id: string;
  job_id: string;
  sku: string;
  category_id: string;
  status: ProductStatus;
  composite_confidence: number;
  category_confidence?: number | null;
  created_at: string;
  attributes?: AttributeRecord[];
}

export interface ProcessingJob {
  job_id: string;
  status: JobStatus;
  file_path: string;
  total_pages?: number | null;
  skus_found?: number | null;
  created_at: string;
  completed_at?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  graph_state_json?: string | null;
}

export interface AuditLog {
  audit_id: string;
  job_id?: string | null;
  user_id: string;
  attribute_id?: string | null;
  action: string;
  previous_value?: string | null;
  new_value?: string | null;
  reason_code: string;
  timestamp: string;
  details_json?: string | null;
}

export interface ReviewQueueItem {
  job_id: string;
  status: JobStatus;
  file_path: string;
  created_at: string | null;
}

export interface ModifiedAttributePayload {
  attribute_id?: string | null;
  canonical_key?: string | null;
  raw_key?: string | null;
  raw_value?: string | null;
  normalized_value?: string | null;
  numeric_value?: number | null;
  unit?: string | null;
  is_human_locked?: boolean;
  locked_state_hash?: string | null;
  evidence_id?: string | null;
}

export type ReviewAction = "ACCEPT_AND_SUBMIT" | "SAVE_DRAFT";

export interface ReviewSubmitRequest {
  job_id: string;
  action: ReviewAction;
  modified_attributes?: ModifiedAttributePayload[];
  audit_reason?: string | null;
}

export interface ReviewSubmitResponse {
  status: string;
  job_id: string;
  audit_log_id?: string | null;
  revalidation_triggered: boolean;
}

export interface JobDetailResponse {
  job_id: string;
  status: JobStatus;
  file_path: string;
  total_pages?: number | null;
  skus_found?: number | null;
  created_at: string | null;
  completed_at?: string | null;
  state: Record<string, unknown>;
}

export interface JobUploadResponse {
  job_id: string;
  status: JobStatus;
  file_path: string;
  created_at: string;
}
