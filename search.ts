type SearchValue = string | number | boolean
export type Search = Record<string, SearchValue> | string | [string, string][] | URLSearchParams

export function appendSearchToURL(url: string, search?: Search): string {
    const params = convertSearchToURLSearchParams(search)
    if (params.size === 0) {
        return url
    }

    if (url.includes('?')) {
        if (!url.endsWith('&')) {
            url += '&'
        }
    } else {
        url += '?'
    }
    return url + params.toString()
}

function convertSearchToURLSearchParams(query?: Search) {
    if (query instanceof URLSearchParams) {
        return query
    }

    if (typeof query !== 'object' || Array.isArray(query)) {
        return new URLSearchParams(query)
    }

    const urlSearchParams = new URLSearchParams()
    for (const key in query) {
        urlSearchParams.append(key, query[key].toString())
    }
    return urlSearchParams
}