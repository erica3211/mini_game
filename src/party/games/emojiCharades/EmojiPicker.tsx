import { useEffect, useMemo, useState } from 'react'
import { EMOJI_GROUPS, loadPickerEmojis, readRecentEmojis, rememberEmoji, searchEmojis, type PickerEmoji } from './emojiData'

interface Props {
  onPick: (emoji: string) => void
  /** 12개를 다 쓴 경우처럼 더 못 고르는 상태 */
  disabled?: boolean
}

type Tab = 'recent' | number

/** 이모티콘 고르기 창 — 분류 탭, 한국어 검색, 최근 쓴 이모티콘 */
export function EmojiPicker({ onPick, disabled = false }: Props) {
  const [all, setAll] = useState<PickerEmoji[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState<Tab>(() => (readRecentEmojis().length > 0 ? 'recent' : 0))
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<string[]>(() => readRecentEmojis())

  useEffect(() => {
    let cancelled = false
    loadPickerEmojis()
      .then((items) => {
        if (!cancelled) setAll(items)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const searching = query.trim().length > 0
  const visible = useMemo<{ emoji: string; label: string }[]>(() => {
    if (!all) return []
    if (searching) return searchEmojis(all, query)
    if (tab === 'recent') return recent.map((emoji) => ({ emoji, label: emoji }))
    return all.filter((item) => item.group === tab)
  }, [all, query, searching, tab, recent])

  const pick = (emoji: string) => {
    if (disabled) return
    onPick(emoji)
    setRecent(rememberEmoji(emoji))
  }

  if (failed) return <p className="party-round-hint">이모티콘 목록을 불러오지 못했어요. 새로고침해 주세요.</p>

  return (
    <div className="party-emojipicker">
      <input
        type="search"
        className="party-wordchain-input party-emojipicker-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="이모티콘 검색 (예: 웃음, 피자, 고양이)"
        autoComplete="off"
      />
      {!searching && (
        <div className="party-emojipicker-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'recent'}
            className={`party-emojipicker-tab${tab === 'recent' ? ' party-emojipicker-tab-active' : ''}`}
            onClick={() => setTab('recent')}
            title="최근 사용"
          >
            🕒
          </button>
          {EMOJI_GROUPS.map((item) => (
            <button
              key={item.group}
              type="button"
              role="tab"
              aria-selected={tab === item.group}
              className={`party-emojipicker-tab${tab === item.group ? ' party-emojipicker-tab-active' : ''}`}
              onClick={() => setTab(item.group)}
              title={item.label}
            >
              {item.icon}
            </button>
          ))}
        </div>
      )}
      <p className="party-emojipicker-caption">
        {searching
          ? `검색 결과 ${visible.length}개`
          : tab === 'recent'
            ? '최근 사용'
            : (EMOJI_GROUPS.find((item) => item.group === tab)?.label ?? '')}
      </p>
      <div className="party-emojipicker-grid">
        {!all && <p className="party-round-hint">이모티콘을 불러오는 중...</p>}
        {all && visible.length === 0 && (
          <p className="party-round-hint">{searching ? '검색 결과가 없어요' : '아직 쓴 이모티콘이 없어요. 다른 탭에서 골라 보세요!'}</p>
        )}
        {visible.map((item) => (
          <button
            key={item.emoji}
            type="button"
            className="party-emojipicker-item"
            onClick={() => pick(item.emoji)}
            disabled={disabled}
            aria-label={item.label}
            title={item.label}
          >
            {item.emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
