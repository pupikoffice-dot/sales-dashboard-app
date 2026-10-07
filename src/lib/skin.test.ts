import { describe, expect, it } from 'vitest'
import { allowedSkins, effectiveSkin, isAppSkin, skinHideId } from './skin'

describe('skins', () => {
  it('recognises only known skins', () => {
    expect(isAppSkin('classic')).toBe(true)
    expect(isAppSkin('bento')).toBe(true)
    expect(isAppSkin('neon')).toBe(false)
    expect(isAppSkin(null)).toBe(false)
  })

  it('everyone may use every skin unless an admin hid it', () => {
    expect(allowedSkins([])).toEqual(['classic', 'bento'])
    expect(allowedSkins(undefined)).toEqual(['classic', 'bento'])
    expect(allowedSkins([skinHideId('bento')])).toEqual(['classic'])
  })

  it('classic can never be hidden', () => {
    expect(allowedSkins([skinHideId('classic'), skinHideId('bento')])).toEqual(['classic'])
  })

  it('a saved skin that is no longer allowed falls back to classic', () => {
    expect(effectiveSkin('bento', [])).toBe('bento')
    expect(effectiveSkin('bento', ['skin.bento'])).toBe('classic')
  })
})
