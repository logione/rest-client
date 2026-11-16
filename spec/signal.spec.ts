import { getSignal } from '../signal'

describe('signal specs', () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    it('should have no timeout for undefined, null and Infinity', () => {
        const signal = new AbortController().signal
        for (const timeout of [undefined, null, Infinity]) {
            expect(getSignal({ timeout })).withContext(String(timeout)).toBeUndefined()
            expect(getSignal({ timeout, signal })).withContext(String(timeout)).toBe(signal)
        }
    })

    it('should round a fractional timeout up to a whole millisecond', async () => {
        const signal = getSignal({ timeout: 0.5 })!
        expect(signal.aborted).toBeFalse()
        await wait(20)
        expect(signal.aborted).toBeTrue()
    })

    it('should not abort at once for timeouts beyond the timer limit', async () => {
        const signals = [2 ** 31 - 1, 2 ** 31, 2 ** 32, Number.MAX_SAFE_INTEGER].map((timeout) => getSignal({ timeout })!)
        await wait(20)
        expect(signals.map((s) => s.aborted)).toEqual([false, false, false, false])
    })

    it('should reject negative, NaN and non-number timeouts', () => {
        for (const timeout of [-1, -Infinity, NaN, '100' as any]) {
            expect(() => getSignal({ timeout })).withContext(String(timeout)).toThrowError(RangeError)
        }
    })
})
