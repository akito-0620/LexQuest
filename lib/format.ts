export function categoryChipClass(category: string): string {
  switch (category) {
    case "word":
      return "chip-word";
    case "expression":
      return "chip-expression";
    case "phrase":
      return "chip-phrase";
    case "function":
      return "chip-function";
    default:
      return "chip bg-parchment-200 text-ink-700";
  }
}

export function categoryLabel(category: string): string {
  switch (category) {
    case "word":
      return "単語";
    case "expression":
      return "表現";
    case "phrase":
      return "フレーズ";
    case "function":
      return "機能";
    default:
      return category;
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "new":
      return "新規";
    case "growing":
      return "成長中";
    case "stable":
      return "定着";
    case "overused":
      return "使い過ぎ";
    default:
      return status;
  }
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
