export function sum<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((acc, item) => acc + selector(item), 0)
}

export function round(value: number, digits = 2): string {
  return value.toFixed(digits)
}
