export function hasHeader(headers: Record<string, string>, name: string): boolean {
    const lowerName = name.toLowerCase()
    return Object.keys(headers).some((key) => key.toLowerCase() === lowerName)
}

export function setHeader(headers: Record<string, string>, name: string, value: string): void {
    const lowerName = name.toLowerCase()
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lowerName) {
            delete headers[key]
        }
    }
    headers[name] = value
}
