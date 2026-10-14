import { describe, expect, it } from 'vitest'
import { visibleNavGroups } from './navGroups'

const labels = (role: Parameters<typeof visibleNavGroups>[0]) => visibleNavGroups(role).map((g) => [g.label, g.items.map((i) => i.label)])

describe('visibleNavGroups', () => {
  it('shows an owner three groups in order', () => {
    expect(labels('owner')).toEqual([
      ['Content', ['Pages', 'Media', 'Categories & Tags', 'Review']],
      ['Site', ['Menus', 'Redirects', 'Submissions', 'Site settings']],
      ['Admin', ['Team', 'Content types']],
    ])
  })

  it('drops items and then empty groups a role cannot use', () => {
    expect(labels('contributor')).toEqual([
      ['Content', ['Pages', 'Media', 'Categories & Tags']],
      ['Site', ['Redirects', 'Site settings']],
    ])
  })

  it('lets an editor review and read submissions but not manage the team', () => {
    const all = visibleNavGroups('editor').flatMap((g) => g.items.map((i) => i.label))
    expect(all).toContain('Review')
    expect(all).toContain('Submissions')
    expect(all).not.toContain('Team')
  })
})
