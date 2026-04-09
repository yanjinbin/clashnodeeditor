import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { Smile } from 'lucide-react'

// Lazy-load the heavy Picker + data so they're code-split
const Picker = lazy(() => import('@emoji-mart/react'))

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  /** Pass inputRef + value + onChange to enable cursor-position insertion */
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  value?: string
  onChange?: (value: string) => void
}

interface PickerPos {
  top: number
  left: number
  openUp: boolean
}

export default function EmojiPicker({ onSelect, inputRef, value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState<PickerPos>({ top: 0, left: 0, openUp: false })
  const [emojiData, setEmojiData] = useState<object | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Fetch emoji data only on first open
  useEffect(() => {
    if (open && !emojiData) {
      import('@emoji-mart/data').then((m) => setEmojiData(m.default))
    }
  }, [open, emojiData])

  // Calculate position relative to the trigger button using fixed coords
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const pickerH = 420 // approximate picker height
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < pickerH && rect.top > pickerH

    setPickerPos({
      top: openUp ? rect.top - pickerH - 4 : rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 360),
      openUp,
    })
  }, [])

  const handleOpen = () => {
    if (!open) updatePosition()
    setOpen((v) => !v)
  }

  // Close on outside click (must check both button and portal)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        buttonRef.current?.contains(target) ||
        pickerRef.current?.contains(target)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  const handleSelect = useCallback(
    (emojiObj: { native: string }) => {
      const emoji = emojiObj.native
      if (inputRef?.current && value !== undefined && onChange) {
        const el = inputRef.current
        const start = el.selectionStart ?? value.length
        const end = el.selectionEnd ?? value.length
        const next = value.slice(0, start) + emoji + value.slice(end)
        onChange(next)
        requestAnimationFrame(() => {
          el.focus()
          el.setSelectionRange(start + emoji.length, start + emoji.length)
        })
      } else {
        onSelect(emoji)
      }
    },
    [inputRef, value, onChange, onSelect]
  )

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        title="插入 Emoji"
        className={`shrink-0 p-1.5 rounded-lg transition-colors ${
          open
            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-yellow-500'
        }`}
      >
        <Smile size={14} />
      </button>

      {/* Portal: renders outside all overflow containers, directly on body */}
      {open &&
        createPortal(
          <div
            ref={pickerRef}
            style={{
              position: 'fixed',
              top: pickerPos.top,
              left: pickerPos.left,
              zIndex: 9999,
            }}
          >
            <Suspense
              fallback={
                <div className="w-[352px] h-[420px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center text-sm text-gray-400 shadow-xl">
                  加载中…
                </div>
              }
            >
              {emojiData && (
                <Picker
                  data={emojiData}
                  onEmojiSelect={handleSelect}
                  locale="zh"
                  theme="auto"
                  previewPosition="none"
                  skinTonePosition="search"
                  set="native"
                />
              )}
            </Suspense>
          </div>,
          document.body
        )}
    </>
  )
}
