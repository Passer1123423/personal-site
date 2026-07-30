export const DERIVATION_STATUS_OPTIONS: Array<{
  value: string;
  label: string;
  tone: string;
}> = [
  { value: "draft", label: "草稿", tone: "developing" },
  { value: "verified", label: "正确推导", tone: "verified" },
  { value: "misconception", label: "曾经误解", tone: "misconception" },
  { value: "failed", label: "受阻", tone: "blocked" },
];

export const DERIVATION_STATUS_PRESENTATION: Record<
  string,
  { label: string; tone: string }
> = Object.fromEntries(
  DERIVATION_STATUS_OPTIONS.map(({ value, label, tone }) => [
    value,
    { label, tone },
  ]),
);
