import type { LimitFunction } from "p-limit"
import pLimit from "p-limit"

const limiters = new Map<number, LimitFunction>()

export function getGlobalLimiter(concurrency: number): LimitFunction {
  const key = concurrency
  if (!limiters.has(key)) {
    limiters.set(key, pLimit(concurrency))
  }
  return limiters.get(key)!
}
