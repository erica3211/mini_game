import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
// 모바일 브라우저 주소창 색 — index.html의 초기값과 같은 색을 쓴다
const THEME_COLORS: Record<Theme, string> = { light: '#fefaf2', dark: '#0d1117' }

function readInitialTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  return { theme, toggleTheme }
}
