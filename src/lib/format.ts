const n2 = new Intl.NumberFormat("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nAny = new Intl.NumberFormat("ar-EG-u-nu-latn", { maximumFractionDigits: 4 });
const dt = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" });
const d = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "medium", timeZone: "Africa/Cairo" });

export const money = (v: number | null | undefined) => (v == null ? "—" : `${n2.format(Number(v))} ج.م`);
export const num = (v: number | null | undefined) => (v == null ? "—" : nAny.format(Number(v)));
export const pct = (v: number | null | undefined) => (v == null ? "—" : `${n2.format(Number(v))}%`);
export const dateTime = (v: string | null | undefined) => (v ? dt.format(new Date(v)) : "—");
export const dateOnly = (v: string | null | undefined) => (v ? d.format(new Date(v)) : "—");

export const TEMPERATURE_LABELS = { none: "—", hot: "ساخن", iced: "مثلج" } as const;
