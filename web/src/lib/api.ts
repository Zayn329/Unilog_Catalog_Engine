import type {
  JobDetailResponse,
  JobUploadResponse,
  ReviewQueueItem,
  ReviewSubmitRequest,
  ReviewSubmitResponse,
} from "@/types/domain";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    let errorData: unknown = null;
    try {
      errorData = await response.json();
      if (
        errorData &&
        typeof errorData === "object" &&
        "detail" in errorData &&
        typeof errorData.detail === "string"
      ) {
        errorDetail = errorData.detail;
      }
    } catch {
      // Response was not JSON
    }
    throw new ApiError(response.status, errorDetail, errorData);
  }

  return response.json() as Promise<T>;
}

export const api = {
  /**
   * Upload a PDF file to create a new extraction job.
   */
  async uploadJob(file: File): Promise<JobUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    return request<JobUploadResponse>("/jobs/upload", {
      method: "POST",
      body: formData,
    });
  },

  /**
   * Retrieve job status and processing graph state by job_id.
   */
  async getJob(jobId: string): Promise<JobDetailResponse> {
    return request<JobDetailResponse>(`/jobs/${jobId}`, {
      method: "GET",
    });
  },

  /**
   * Fetch the list of jobs requiring human review.
   */
  async getReviewQueue(): Promise<ReviewQueueItem[]> {
    return request<ReviewQueueItem[]>("/review/queue", {
      method: "GET",
    });
  },

  /**
   * Submit human review action (ACCEPT_AND_SUBMIT or SAVE_DRAFT).
   */
  async submitReview(
    payload: ReviewSubmitRequest
  ): Promise<ReviewSubmitResponse> {
    return request<ReviewSubmitResponse>("/review/submit", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Retry extraction on an existing job with optional overrides.
   */
  async retryJob(
    jobId: string,
    options?: {
      force_category_id?: string | null;
      skip_category_validation?: boolean;
    }
  ): Promise<{ job_id: string; status: string; message: string }> {
    return request<{ job_id: string; status: string; message: string }>(
      `/jobs/${jobId}/retry`,
      {
        method: "POST",
        body: JSON.stringify(options || {}),
      }
    );
  },
};
