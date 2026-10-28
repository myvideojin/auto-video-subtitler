// Standalone open-source usage hook (Unlimited by default)
export function useToolUsage() {
  return {
    checkUsage: () => true,
    incrementUsage: () => {},
    usageCount: 0,
    isUnlimited: true
  };
}
