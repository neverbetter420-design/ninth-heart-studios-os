// PDF → Fillable Form import.
//
// One import pipeline: every source converges to PDF (Google Docs →
// Download as PDF, Canva → Download as PDF, native PDFs direct).
//
// Two extraction layers:
// 1. AcroForm — if the PDF has real form fields, import them exactly
//    (type, label, dropdown options).
// 2. Heuristics — for flat PDFs, scan extracted text for field-like
//    patterns (blank lines, checkbox glyphs, signature lines) and
//    PROPOSE fields. Heuristics are best-effort: the admin reviews
//    them in the builder before the form goes live.
//
// The source PDF is kept as the branded reference (see form-sources
// bucket); the native form is what the client actually fills.

import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import type { FormField } from "./forms";

export type PdfImportResult = {
  title: string | null;
  fields: FormField[];
  acroformFields: number;
  heuristicFields: number;
  pageCount: number;
};

let fieldCounter = 0;
function newFieldId(): string {
  fieldCounter += 1;
  return `imp_${Date.now().toString(36)}_${fieldCounter}`;
}

/**
 * Turn an AcroForm field name ("form1[0].#subform[0].FullName[0]",
 * "email_address", "phoneNumber") into a human label ("Full Name",
 * "Email Address", "Phone Number").
 */
export function cleanFieldName(raw: string): string {
  const segments = raw.split(".");
  let last = segments[segments.length - 1] ?? raw;
  last = last.replace(/\[\d+\]/g, "").replace(/^#/, "");
  const spaced = last
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
  if (!spaced) return "Field";
  return spaced
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function dedupe(fields: FormField[]): FormField[] {
  const seen = new Set<string>();
  const out: FormField[] = [];
  for (const f of fields) {
    const key = f.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/** Layer 1: real AcroForm fields. */
function extractAcroform(pdf: PDFDocument): FormField[] {
  const fields: FormField[] = [];
  let form;
  try {
    form = pdf.getForm();
  } catch {
    return [];
  }
  const pdfFields = form.getFields();
  for (const pf of pdfFields) {
    const name = pf.getName();
    const label = cleanFieldName(name);
    const ctor = pf.constructor.name;
    if (ctor === "PDFTextField") {
      const tf = pf as unknown as {
        isMultiline: () => boolean;
        isRequired: () => boolean;
      };
      fields.push({
        id: newFieldId(),
        label,
        type: tf.isMultiline() ? "textarea" : "text",
        required: tf.isRequired(),
      });
    } else if (ctor === "PDFCheckBox") {
      const cb = pf as unknown as { isRequired: () => boolean };
      fields.push({ id: newFieldId(), label, type: "checkbox", required: cb.isRequired() });
    } else if (ctor === "PDFDropdown") {
      const dd = pf as unknown as { getOptions: () => string[]; isRequired: () => boolean };
      fields.push({
        id: newFieldId(),
        label,
        type: "select",
        required: dd.isRequired(),
        options: dd.getOptions().filter(Boolean),
      });
    } else if (ctor === "PDFRadioGroup") {
      const rg = pf as unknown as { getOptions: () => string[]; isRequired: () => boolean };
      fields.push({
        id: newFieldId(),
        label,
        type: "select",
        required: rg.isRequired(),
        options: rg.getOptions().filter(Boolean),
      });
    } else if (ctor === "PDFButton") {
      // A button named like a signature is a signature field; other
      // buttons (submit/reset) carry no fillable value — skip them.
      if (/sign/i.test(name)) {
        fields.push({ id: newFieldId(), label, type: "signature", required: false });
      }
    }
  }
  return fields;
}

/** Layer 2: heuristics over extracted text for flat PDFs. */
function extractHeuristics(pages: string[]): FormField[] {
  const fields: FormField[] = [];
  const lines = pages.flatMap((p) => p.split("\n")).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // "Full Name: ____" / "Address: ________"
    const blankMatch = line.match(/^([^:]{2,60}):\s*_{2,}\s*$/);
    if (blankMatch) {
      const label = blankMatch[1].trim();
      if (/sign/i.test(label)) {
        fields.push({ id: newFieldId(), label, type: "signature", required: false });
      } else if (/date/i.test(label)) {
        fields.push({ id: newFieldId(), label, type: "date", required: false });
      } else {
        fields.push({ id: newFieldId(), label, type: "text", required: false });
      }
      continue;
    }

    // "☐ I agree …" / "[ ] I agree …" / "□ Yes"
    const checkMatch = line.match(/^[☐□\[ \]]\s*(.+)$/) ?? line.match(/^\[\s\]\s*(.+)$/);
    if (checkMatch && checkMatch[1].trim().length >= 3) {
      fields.push({ id: newFieldId(), label: checkMatch[1].trim().slice(0, 120), type: "checkbox", required: false });
      continue;
    }

    // "Signature: ____" without the blank-line pattern, or "Signature:"
    if (/signature/i.test(line) && line.length < 80) {
      const label = line.replace(/:.*$/, "").trim() || "Signature";
      fields.push({ id: newFieldId(), label, type: "signature", required: false });
      continue;
    }

    // Bare "Label:" with nothing after — common in forms ("Address:", "Notes:")
    const bareLabel = line.match(/^([^:]{2,60}):\s*$/);
    if (bareLabel && !/^(http|www)/i.test(line)) {
      const label = bareLabel[1].trim();
      if (!/^(page|form|section|note|total)/i.test(label)) {
        fields.push({ id: newFieldId(), label, type: "text", required: false });
      }
    }
  }

  return dedupe(fields).slice(0, 30);
}

/**
 * Parse a PDF (ArrayBuffer) into proposed form fields.
 * Never throws — returns empty fields on any parse failure.
 */
export async function importPdfFields(data: ArrayBuffer): Promise<PdfImportResult> {
  const empty: PdfImportResult = {
    title: null,
    fields: [],
    acroformFields: 0,
    heuristicFields: 0,
    pageCount: 0,
  };
  try {
    const pdf = await PDFDocument.load(data, { ignoreEncryption: true });
    const pageCount = pdf.getPageCount();

    let title: string | null = null;
    try {
      title = pdf.getTitle() || null;
    } catch {
      title = null;
    }

    const acro = extractAcroform(pdf);
    let fields: FormField[] = acro;
    let heuristicCount = 0;

    if (acro.length === 0) {
      // No real fields — fall back to heuristics over page text
      // (pdf.js, since pdf-lib cannot extract text).
      const pages: string[] = [];
      try {
        const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
        for (let i = 1; i <= doc.numPages; i++) {
          try {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            // Reconstruct lines: group items by y (transform[5]),
            // sort each line by x (transform[4]), join with spaces.
            const byY = new Map<number, { x: number; str: string }[]>();
            for (const it of content.items) {
              if (!("str" in it) || !("transform" in it)) continue;
              const t = it.transform as unknown as number[];
              const y = Math.round(t[5]);
              const bucket = byY.get(y) ?? [];
              bucket.push({ x: t[4], str: String(it.str) });
              byY.set(y, bucket);
            }
            const lines = [...byY.entries()]
              .sort((a, b) => b[0] - a[0])
              .map(([, parts]) =>
                parts
                  .sort((a, b) => a.x - b.x)
                  .map((p) => p.str)
                  .join(" ")
                  .replace(/\s+/g, " ")
                  .trim()
              )
              .filter(Boolean);
            pages.push(lines.join("\n"));
          } catch {
            pages.push("");
          }
        }
        // doc is garbage-collected; no explicit destroy in this pdf.js version.
      } catch {
        /* text extraction failed — heuristics get nothing */
      }
      const heur = extractHeuristics(pages);
      heuristicCount = heur.length;
      fields = heur;
    }

    return {
      title,
      fields: dedupe(fields).slice(0, 40),
      acroformFields: acro.length,
      heuristicFields: heuristicCount,
      pageCount,
    };
  } catch {
    return empty;
  }
}
