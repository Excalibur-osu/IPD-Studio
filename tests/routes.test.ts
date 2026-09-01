import { describe, expect, it } from 'vitest'
import { WORKSPACES, routeFor, workspaceFor } from '../src/routes'

describe('routeFor', () => {
  it('sends the bare root to the homepage', () => {
    expect(routeFor('/')).toBe('home')
  })

  it('sends /app and everything under it to the editor', () => {
    expect(routeFor('/app')).toBe('app')
    expect(routeFor('/app/')).toBe('app')
    expect(routeFor('/app/sheet/2')).toBe('app')
  })

  // The off-by-one a naive startsWith('/app') gets wrong: these are not the editor.
  it('does not treat a path that merely starts with the letters app as the editor', () => {
    expect(routeFor('/application')).toBe('home')
    expect(routeFor('/appfoo')).toBe('home')
    expect(routeFor('/apps')).toBe('home')
  })

  it('falls back to the homepage for unknown paths, because hosting rewrites everything to index.html', () => {
    expect(routeFor('/pricing')).toBe('home')
    expect(routeFor('/docs/hmi')).toBe('home')
    expect(routeFor('')).toBe('home')
  })
})

describe('workspaceFor', () => {
  it('reads the workspace out of the path', () => {
    expect(workspaceFor('/app/draw')).toBe('draw')
    expect(workspaceFor('/app/data')).toBe('data')
    expect(workspaceFor('/app/checks')).toBe('checks')
    expect(workspaceFor('/app/hmi')).toBe('hmi')
  })

  it('ignores anything after the workspace segment', () => {
    expect(workspaceFor('/app/data/instruments')).toBe('data')
  })

  // Bare /app is the old URL and every existing link and bookmark uses it.
  it('opens the drawing for bare /app and for anything unrecognised', () => {
    expect(workspaceFor('/app')).toBe('draw')
    expect(workspaceFor('/app/')).toBe('draw')
    expect(workspaceFor('/app/sheet/2')).toBe('draw')
    expect(workspaceFor('/app/nonsense')).toBe('draw')
    expect(workspaceFor('/')).toBe('draw')
  })

  it('does not half-match a longer segment', () => {
    expect(workspaceFor('/app/database')).toBe('draw')
    expect(workspaceFor('/app/drawing')).toBe('draw')
  })

  it('every listed workspace round-trips through its own path', () => {
    for (const w of WORKSPACES) expect(workspaceFor(`/app/${w}`)).toBe(w)
  })
})
