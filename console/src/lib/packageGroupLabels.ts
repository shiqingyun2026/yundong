type GroupPriceConfigItem = {
  min_success_count: number
  target_count: number
  price_fen?: number
}

const normalizeGroupPriceConfig = (value: GroupPriceConfigItem[] = []) =>
  [...value]
    .map(item => ({
      min_success_count: Number(item.min_success_count) || Number(item.target_count) || 0,
      target_count: Number(item.target_count) || 0,
      price_fen: Number(item.price_fen) || 0
    }))
    .filter(item => item.target_count > 0)
    .sort((left, right) => left.target_count - right.target_count)

export const formatGroupConfigLabel = (item: GroupPriceConfigItem) => {
  const minSuccessCount = Number(item.min_success_count) || Number(item.target_count) || 0
  const targetCount = Number(item.target_count) || 0

  if (minSuccessCount <= 1 && targetCount <= 1) {
    return '1对1私教'
  }

  return minSuccessCount && targetCount && minSuccessCount !== targetCount
    ? `${minSuccessCount}～${targetCount}人团`
    : `${targetCount}人团`
}

export const formatGroupConfigLabels = ({
  groupPriceConfig = [],
  supportedPeople = []
}: {
  groupPriceConfig?: GroupPriceConfigItem[]
  supportedPeople?: number[]
}) => {
  const labels = normalizeGroupPriceConfig(groupPriceConfig).map(formatGroupConfigLabel)
  if (labels.length) {
    return labels.join(' / ')
  }

  const fallbackLabels = supportedPeople.map(item => Number(item)).filter(item => item > 0).map(item => `${item}人团`)
  return fallbackLabels.length ? fallbackLabels.join(' / ') : '-'
}
