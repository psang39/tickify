import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState<boolean>(() => {
        if (typeof window === "undefined") return false
        return window.innerWidth < MOBILE_BREAKPOINT
    })

    React.useEffect(() => {
        if (typeof window === "undefined") return

        const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

        const handleChange = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
        }

        handleChange()
        mediaQuery.addEventListener("change", handleChange)

        return () => {
            mediaQuery.removeEventListener("change", handleChange)
        }
    }, [])

    return isMobile
}