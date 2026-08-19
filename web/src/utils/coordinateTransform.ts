/**
 * coordinateTransform.ts
 *
 * Coordinate transformation engine for PDF datasheet bounding boxes and overlays.
 * Converts between PDF point coordinates (top-left or bottom-left origin),
 * Docling percentage arrays, and normalized browser DOM percentage coordinates.
 *
 * Guaranteed invariants:
 *  - Handles PDF points (default 612x792 pt Letter or arbitrary page sizes).
 *  - Converts bottom-left PDF coordinate space (standard PDF) to top-left browser DOM.
 *  - Converts 5-tuple arrays [page, top, left, width, height] into normalized objects.
 *  - Enforces bounding box clamping within [0, 100]% to prevent page overflow.
 *  - Zero hardcoded field offsets.
 */

import type { BoundingBox } from "@/types/domain";

export interface NormalizedBox {
  pageNumber: number;
  topPct: number;
  leftPct: number;
  widthPct: number;
  heightPct: number;
}

export interface PageDimensions {
  width: number;
  height: number;
}

/** Standard US Letter dimensions in PDF points (72 DPI) */
export const DEFAULT_PDF_PAGE_SIZE: PageDimensions = {
  width: 612,
  height: 792,
};

/**
 * Normalizes any raw bounding box representation into standard percentage coordinates.
 *
 * Supported raw input types:
 *  1. BoundingBox object: `{ page_number, top_pct, left_pct, width_pct, height_pct }`
 *  2. Docling 5-tuple: `[page_number, top_pct, left_pct, width_pct, height_pct]`
 *  3. PDF point rect: `[x0, y0, x1, y1]` (or `{ x0, y0, x1, y1, page }`)
 *  4. JSON stringified variants of above
 */
export function normalizeBoundingBox(
  raw: unknown,
  pageSize: PageDimensions = DEFAULT_PDF_PAGE_SIZE,
  isBottomLeftOrigin = true
): NormalizedBox | null {
  if (!raw) return null;

  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (typeof data !== "object" || data === null) return null;

  // Case 1: Standard domain BoundingBox object
  if ("top_pct" in data && "left_pct" in data) {
    const box = data as BoundingBox;
    const top = clampPct(box.top_pct);
    const left = clampPct(box.left_pct);
    const width = Math.max(1, Math.min(100 - left, box.width_pct));
    const height = Math.max(1, Math.min(100 - top, box.height_pct));

    return {
      pageNumber: box.page_number || 1,
      topPct: top,
      leftPct: left,
      widthPct: width,
      heightPct: height,
    };
  }

  // Case 2: Array format
  if (Array.isArray(data)) {
    // 5-element format: [page, top_pct, left_pct, width_pct, height_pct]
    if (data.length >= 5 && typeof data[0] === "number") {
      const [page, top, left, width, height] = data;
      const cleanTop = clampPct(top);
      const cleanLeft = clampPct(left);
      return {
        pageNumber: Math.max(1, Math.round(page)),
        topPct: cleanTop,
        leftPct: cleanLeft,
        widthPct: Math.max(1, Math.min(100 - cleanLeft, width)),
        heightPct: Math.max(1, Math.min(100 - cleanTop, height)),
      };
    }

    // 4-element PDF points rect format: [x0, y0, x1, y1]
    if (data.length === 4 && data.every((v) => typeof v === "number")) {
      const [x0, y0, x1, y1] = data;
      return transformPdfPointsToPct(
        x0,
        y0,
        x1,
        y1,
        1,
        pageSize,
        isBottomLeftOrigin
      );
    }
  }

  // Case 3: Object with x0, y0, x1, y1 points
  if ("x0" in data && "y0" in data && "x1" in data && "y1" in data) {
    const { x0, y0, x1, y1, page } = data as {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      page?: number;
    };
    return transformPdfPointsToPct(
      x0,
      y0,
      x1,
      y1,
      page || 1,
      pageSize,
      isBottomLeftOrigin
    );
  }

  return null;
}

/**
 * Transforms raw PDF points [x0, y0, x1, y1] to percentage-based coordinates.
 */
export function transformPdfPointsToPct(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pageNumber = 1,
  pageSize: PageDimensions = DEFAULT_PDF_PAGE_SIZE,
  isBottomLeftOrigin = true
): NormalizedBox {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  const widthPt = maxX - minX;
  const heightPt = maxY - minY;

  const leftPct = clampPct((minX / pageSize.width) * 100);
  const widthPct = Math.max(0.5, Math.min(100 - leftPct, (widthPt / pageSize.width) * 100));

  let topPct: number;
  if (isBottomLeftOrigin) {
    // PDF standard: origin is bottom-left, y goes upward
    topPct = clampPct(((pageSize.height - maxY) / pageSize.height) * 100);
  } else {
    // Top-left origin
    topPct = clampPct((minY / pageSize.height) * 100);
  }

  const heightPct = Math.max(0.5, Math.min(100 - topPct, (heightPt / pageSize.height) * 100));

  return {
    pageNumber,
    topPct,
    leftPct,
    widthPct,
    heightPct,
  };
}

/** Clamps percentage into [0, 100] */
function clampPct(v: number): number {
  if (isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
