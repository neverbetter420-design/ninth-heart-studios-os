/** Serializable result from a client portal server action. */
export type PortalFeedbackState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialPortalFeedbackState: PortalFeedbackState = { status: "idle", message: "" };
