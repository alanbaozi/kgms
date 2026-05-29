import { describe, expect, it } from 'vitest'

import { formatGraphTooltip } from './graphTooltip'

describe('formatGraphTooltip', () => {
  it('formats node tooltip with name type description and source', () => {
    expect(
      formatGraphTooltip({
        dataType: 'node',
        data: {
          name: '09III型核潜艇',
          categoryLabel: '装备',
          properties: {
            description: '核动力攻击潜艇，具备鱼雷和导弹攻击能力。',
            file_path: '09III型核潜艇.pdf',
          },
        },
      }),
    ).toContain('描述')
    expect(
      formatGraphTooltip({
        dataType: 'node',
        data: {
          name: '09III型核潜艇',
          categoryLabel: '装备',
          properties: {
            description: '核动力攻击潜艇，具备鱼雷和导弹攻击能力。',
            file_path: '09III型核潜艇.pdf',
          },
        },
      }),
    ).toContain('来源')
  })

  it('formats edge tooltip with name type description and source from nested properties', () => {
    const description = '该关系说明强-6方案使用并来源于相关资料。'.repeat(6)
    const tooltip = formatGraphTooltip({
      dataType: 'edge',
      data: {
        label: '使用,来源',
        properties: {
          id: 147,
          type: 'DIRECTED',
          target: 113,
          properties: {
            file_path: '强-6 - 维基百科，自由的百科全书.pdf',
            keywords: '使用,来源',
            description,
            weight: 1,
            truncate: '',
          },
        },
      },
    })

    expect(tooltip).toContain('名称')
    expect(tooltip).toContain('使用,来源')
    expect(tooltip).toContain('类型')
    expect(tooltip).toContain('有向关系')
    expect(tooltip).toContain('描述')
    expect(tooltip).toContain(description)
    expect(tooltip).toContain('来源')
    expect(tooltip).toContain('强-6 - 维基百科，自由的百科全书.pdf')
    expect(tooltip).not.toContain('id：147')
    expect(tooltip).not.toContain('target：113')
    expect(tooltip).not.toContain('properties')
    expect(tooltip).not.toContain('weight')
  })

  it('does not treat edge endpoint ids as relation source', () => {
    const tooltip = formatGraphTooltip({
      dataType: 'edge',
      data: {
        label: '包含',
        properties: {
          source: '强-6',
          target: '歼击机',
          type: 'DIRECTED',
        },
      },
    })

    expect(tooltip).toContain('来源')
    expect(tooltip).toContain('暂无来源')
    expect(tooltip).not.toContain('强-6')
    expect(tooltip).not.toContain('歼击机')
  })

  it('omits unrelated raw node fields from the tooltip body', () => {
    const tooltip = formatGraphTooltip({
      dataType: 'node',
      data: {
        name: '09III型核潜艇',
        categoryLabel: '装备',
        properties: {
          航速: '30节',
          description: '核动力攻击潜艇。',
          file_path: '09III型核潜艇.pdf',
          resource: 'doc-e0675e859d09fc1a5ccaeb7736bf55b0-chunk-004',
          source_id: 'doc-e0675e859d09fc1a5ccaeb7736bf55b0',
          chunk_id: 'chunk-004',
        },
      },
    })

    expect(tooltip).toContain('名称')
    expect(tooltip).toContain('类型')
    expect(tooltip).toContain('描述')
    expect(tooltip).toContain('来源')
    expect(tooltip).not.toContain('航速')
    expect(tooltip).not.toContain('resource')
    expect(tooltip).not.toContain('source_id')
    expect(tooltip).not.toContain('chunk_id')
    expect(tooltip).not.toContain('doc-e0675e859d09fc1a5ccaeb7736bf55b0')
  })

  it('keeps long node descriptions complete', () => {
    const description = '这是一个很长的节点说明'.repeat(20)
    const tooltip = formatGraphTooltip({
      dataType: 'node',
      data: {
        name: '09III型核潜艇',
        categoryLabel: '装备',
        properties: {
          说明: description,
        },
      },
    })

    expect(tooltip).toContain(description)
    expect(tooltip).not.toContain('...')
  })

  it('prioritizes name type full description and source for node tooltips', () => {
    const description = '09III型核潜艇通过改进反应堆、降噪设计和武器系统提升水下作战能力。'.repeat(8)
    const tooltip = formatGraphTooltip({
      dataType: 'node',
      data: {
        name: '全向打击与反航母作战能力',
        categoryLabel: '能力',
        properties: {
          labels: ['全向打击与反航母作战能力'],
          description,
          file_path: '09III型核潜艇.pdf',
          entity_type: 'capability',
          resource: 'doc-e0675e859d09fc1a5ccaeb7736bf55b0-chunk-004',
          truncate: '',
        },
      },
    })

    expect(tooltip).toContain('名称')
    expect(tooltip).toContain('全向打击与反航母作战能力')
    expect(tooltip).toContain('类型')
    expect(tooltip).toContain('能力')
    expect(tooltip).toContain('描述')
    expect(tooltip).toContain(description)
    expect(tooltip).toContain('来源')
    expect(tooltip).toContain('09III型核潜艇.pdf')
    expect(tooltip).not.toContain('节点名称')
    expect(tooltip).not.toContain('节点类型')
    expect(tooltip).not.toContain('节点描述')
    expect(tooltip).not.toContain('节点来源')
    expect(tooltip).not.toContain('labels')
    expect(tooltip).not.toContain('properties')
    expect(tooltip).not.toContain('truncate')
  })

  it('reads description and source from nested LightRAG node properties', () => {
    const tooltip = formatGraphTooltip({
      dataType: 'node',
      data: {
        name: '中国海军',
        categoryLabel: '部队/军事力量',
        properties: {
          labels: ['中国海军'],
          properties: {
            entity_type: 'force_unit',
            description: '中国人民解放军海军，是中华人民共和国的海上军事力量。',
            source_id: 'doc-e0675e859d09fc1a5ccaeb7736bf55b0-chunk-002',
            file_path: '09III型核潜艇.pdf',
          },
        },
      },
    })

    expect(tooltip).toContain('名称')
    expect(tooltip).toContain('中国海军')
    expect(tooltip).toContain('类型')
    expect(tooltip).toContain('部队/军事力量')
    expect(tooltip).toContain('描述')
    expect(tooltip).toContain('中国人民解放军海军，是中华人民共和国的海上军事力量。')
    expect(tooltip).toContain('来源')
    expect(tooltip).toContain('09III型核潜艇.pdf')
    expect(tooltip).not.toContain('暂无描述')
    expect(tooltip).not.toContain('暂无来源')
  })
})
