const ENTITY_TYPES: Record<string, { label: string; color: string }> = {
  country: { label: '国家', color: '#c2410c' },
  force_unit: { label: '部队/军事力量', color: '#1d4ed8' },
  organization: { label: '组织机构', color: '#475569' },
  person: { label: '人员', color: '#7c3aed' },
  equipment: { label: '装备', color: '#0891b2' },
  facility: { label: '设施', color: '#92400e' },
  location: { label: '地点', color: '#16a34a' },
  region: { label: '区域', color: '#4d7c0f' },
  event: { label: '事件', color: '#ea580c' },
  action: { label: '动作', color: '#ca8a04' },
  capability: { label: '能力', color: '#0f766e' },
  indicator: { label: '指标/属性值', color: '#db2777' },
  resource: { label: '资源', color: '#a16207' },
  time: { label: '时间', color: '#64748b' },
  plan: { label: '计划/方案', color: '#4338ca' },
  document: { label: '文档/资料', color: '#94a3b8' },
  other: { label: '其他', color: '#737373' },
}

export function entityColor(type: string | null | undefined): string {
  return ENTITY_TYPES[normalize(type)]?.color || ENTITY_TYPES.other.color
}

export function entityLabel(type: string | null | undefined): string {
  return ENTITY_TYPES[normalize(type)]?.label || ENTITY_TYPES.other.label
}

export function graphLegend(types: string[]): Array<{ type: string; label: string; color: string }> {
  return Array.from(new Set(types.map(normalize))).map((type) => ({
    type,
    label: entityLabel(type),
    color: entityColor(type),
  }))
}

function normalize(type: string | null | undefined): string {
  return (type || 'other').trim().toLowerCase().replace(/[-\s]+/g, '_')
}
