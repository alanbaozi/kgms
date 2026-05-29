import { describe, expect, it } from 'vitest'

import { entityColor, entityLabel } from './entityColors'

describe('entityColors', () => {
  it.each([
    ['equipment', '#0891b2', '装备'],
    ['country', '#c2410c', '国家'],
    ['event', '#ea580c', '事件'],
    ['action', '#ca8a04', '动作'],
    ['force_unit', '#1d4ed8', '部队/军事力量'],
    ['unknown_type', '#737373', '其他'],
  ])('maps %s to a stable color and label', (type, color, label) => {
    expect(entityColor(type)).toBe(color)
    expect(entityLabel(type)).toBe(label)
  })
})
