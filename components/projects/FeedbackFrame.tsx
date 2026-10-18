"use client";

import { useState } from "react";

export type FramePin = {
  id: string;
  x: number;
  y: number;
  comment: string;
  resolved: boolean;
  page_url: string;
  created_at: string;
};

/**
 * FeedbackFrame — the visual feedback canvas. Renders the shared deliverable
 * as a framed area (a stand-in for the staging page the pin references) with
 * numbered pins overlaid at their x/y coordinates. Clicking the frame reports
 * the coordinate so the parent can open a pin composer.
 */
export function FeedbackFrame({
  pins,
  picked,
  onPick,
  selectedPinId,
  onSelectPin,
  pageLabel,
}: {
  pins: FramePin[];
  picked: { x: number; y: number } | null;
  onPick: (x: number, y: number) => void;
  selectedPinId: string | null;
  onSelectPin: (id: string | null) => void;
  pageLabel: string;
}) {
  return (
    <div>
      <p className="delivery-row-sub" style={{ marginBottom: 6 }}>
        Viewing: <strong>{pageLabel || "Deliverable"}</strong> — click anywhere to drop a pin.
      </p>
      <div
        className="studio-feedback-canvas"
        role="button"
        tabIndex={0}
        aria-label="Deliverable preview — click to place a feedback pin"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
          const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
          onPick(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
          onSelectPin(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPick(50, 50);
            onSelectPin(null);
          }
        }}
        style={{
          position: "relative",
          aspectRatio: "16 / 9",
          borderRadius: 10,
          cursor: "crosshair",
          overflow: "hidden",
        }}
      >
        {pins.map((pin, i) => (
          <button
            key={pin.id}
            className={`studio-feedback-pin${pin.resolved ? " is-resolved" : ""}${selectedPinId === pin.id ? " is-selected" : ""}`}
            type="button"
            aria-label={`Pin ${i + 1}: ${pin.comment.slice(0, 60)}${pin.resolved ? " (resolved)" : ""}`}
            title={pin.comment}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPin(pin.id === selectedPinId ? null : pin.id);
            }}
            style={{
              position: "absolute",
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              transform: "translate(-50%, -50%)",
              width: 26,
              height: 26,
              borderRadius: "50%",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {i + 1}
          </button>
        ))}
        {picked ? (
          <div
            className="studio-feedback-picked"
            aria-hidden
            style={{
              position: "absolute",
              left: `${picked.x}%`,
              top: `${picked.y}%`,
              transform: "translate(-50%, -50%)",
              width: 26,
              height: 26,
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * PinComposer — wraps the frame with a page selector and a comment form.
 * The parent supplies the server action (admin or portal) plus the hidden
 * fields it needs; picked coordinates are submitted as x/y.
 */
export function PinComposer({
  roundId,
  hiddenFields,
  addPinAction,
  pins,
  ctaLabel,
}: {
  roundId: string;
  hiddenFields: { name: string; value: string }[];
  addPinAction: (formData: FormData) => void | Promise<unknown>;
  pins: FramePin[];
  ctaLabel: string;
}) {
  const [picked, setPicked] = useState<{ x: number; y: number } | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const pageUrls = [...new Set(pins.map((p) => p.page_url).filter(Boolean))];
  const [pageUrl, setPageUrl] = useState(pageUrls[0] ?? "");
  const [customUrl, setCustomUrl] = useState("");
  const activeUrl = pageUrl === "__custom" ? customUrl.trim() : pageUrl;
  const visiblePins = pins.filter((p) => (p.page_url || "") === activeUrl);
  const selectedPin = pins.find((p) => p.id === selectedPinId) ?? null;

  return (
    <div>
      <div className="mini-form" style={{ marginBottom: 8 }}>
        <label className="delivery-row-sub" htmlFor="pin-page-url">
          Deliverable
        </label>
        <select
          id="pin-page-url"
          value={pageUrl}
          onChange={(e) => {
            setPageUrl(e.target.value);
            setSelectedPinId(null);
          }}
          style={{ flex: 1 }}
        >
          {pageUrls.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
          <option value="__custom">Another page…</option>
        </select>
      </div>
      {pageUrl === "__custom" ? (
        <div className="mini-form" style={{ marginBottom: 8 }}>
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="Paste the staging page URL…"
            maxLength={500}
            style={{ flex: 1 }}
            aria-label="Page URL"
          />
        </div>
      ) : null}

      <FeedbackFrame
        pins={visiblePins}
        picked={picked}
        onPick={(x, y) => setPicked({ x, y })}
        selectedPinId={selectedPinId}
        onSelectPin={setSelectedPinId}
        pageLabel={activeUrl}
      />

      {selectedPin ? (
        <div className="delivery-row" style={{ marginTop: 8 }}>
          <div className="delivery-row-main">
            <p className="delivery-row-title">{selectedPin.comment}</p>
            <p className="delivery-row-sub">
              {selectedPin.resolved ? "Resolved" : "Open"} ·{" "}
              {new Date(selectedPin.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          </div>
          <button type="button" className="mini-button" onClick={() => setSelectedPinId(null)}>
            Close
          </button>
        </div>
      ) : null}

      {picked ? (
        <form
          action={async (formData: FormData) => {
            await addPinAction(formData);
            setPicked(null);
            setComment("");
          }}
          className="delivery-add-form"
          style={{ marginTop: 8 }}
        >
          <input type="hidden" name="round_id" value={roundId} />
          {hiddenFields.map((f) => (
            <input key={f.name} type="hidden" name={f.name} value={f.value} />
          ))}
          <input type="hidden" name="page_url" value={activeUrl} />
          <input type="hidden" name="x" value={String(picked.x)} />
          <input type="hidden" name="y" value={String(picked.y)} />
          <input
            type="text"
            name="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={`Pin at ${picked.x}%, ${picked.y}% — what's wrong here?`}
            required
            maxLength={2000}
          />
          <button type="submit" className="mini-button go">
            {ctaLabel}
          </button>
          <button type="button" className="mini-button" onClick={() => setPicked(null)}>
            Cancel
          </button>
        </form>
      ) : (
        <p className="pipeline-empty" style={{ marginTop: 8 }}>
          Click the preview above to pin a comment to that exact spot.
        </p>
      )}
    </div>
  );
}
