import { describe, expect, it } from 'vitest'
import { allowedSkins, effectiveSkin, isAppSkin, skinHideId } from './skin'

describe('skins', () => {
  it('recognises only known skins', () => {
    expect(isAppSkin('classic')).toBe(true)
    expect(isAppSkin('bento')).toBe(true)
    expect(isAppSkin('solid')).toBe(true)
    expect(isAppSkin('glass')).toBe(true)
    expect(isAppSkin('neon')).toBe(false)
    expect(isAppSkin(null)).toBe(false)
  })

  it('everyone may use every skin unless an admin hid it', () => {
    expect(allowedSkins([])).toEqual(['classic', 'bento', 'solid', 'glass'])
    expect(allowedSkins(undefined)).toEqual(['classic', 'bento', 'solid', 'glass'])
    expect(allowedSkins([skinHideId('bento')])).toEqual(['classic', 'solid', 'glass'])
    expect(allowedSkins([skinHideId('solid')])).toEqual(['classic', 'bento', 'glass'])
  })

  it('classic can never be hidden', () => {
    expect(allowedSkins([skinHideId('classic'), skinHideId('bento'), skinHideId('solid'), skinHideId('glass')])).toEqual(['classic'])
  })

  it('a saved skin that is no longer allowed falls back to classic', () => {
    expect(effectiveSkin('bento', [])).toBe('bento')
    expect(effectiveSkin('solid', [])).toBe('solid')
    expect(effectiveSkin('bento', ['skin.bento'])).toBe('classic')
    expect(effectiveSkin('solid', ['skin.solid'])).toBe('classic')
    expect(effectiveSkin('glass', [])).toBe('glass')
    expect(effectiveSkin('glass', ['skin.glass'])).toBe('classic')
  })
})
