// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DateField } from './DateField'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let host: HTMLDivElement | null = null

function mount(ui: React.ReactElement) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root!.render(ui))
  return host.querySelector('input[type="text"]') as HTMLInputElement
}

function type(el: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
})

describe('DateField', () => {
  it('shows the date as DD/MM/YYYY whatever the stored value looks like', () => {
    const input = mount(<DateField value="2026-11-08" onChange={() => {}} />)
    expect(input.value).toBe('08/11/2026')
  })

  it('hands back YYYY-MM-DD once a full date is typed, adding the slashes itself', () => {
    const onChange = vi.fn()
    const input = mount(<DateField value="" onChange={onChange} />)
    type(input, '05012026')
    expect(input.value).toBe('05/01/2026')
    expect(onChange).toHaveBeenCalledWith('2026-01-05')
  })

  it('marks a date that does not exist and does not pass it on', () => {
    const onChange = vi.fn()
    const input = mount(<DateField value="" onChange={onChange} />)
    type(input, '31022026')
    expect(onChange).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('refuses a date outside min and max', () => {
    const onChange = vi.fn()
    const input = mount(<DateField value="" min="2026-01-01" max="2026-12-31" onChange={onChange} />)
    type(input, '01012027')
    expect(onChange).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })
})
