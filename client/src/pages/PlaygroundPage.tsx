import { useState, useRef, useEffect } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function PlaygroundPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'سلام، من دست‌یاری AI هستم. می‌توانم درباره عضویت، قوانین، تماس و هدف دست‌یاری کمک کنم.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const question = input.trim()
    if (!question || loading) return

    const userMessage: ChatMessage = { role: 'user', content: question }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/dastyari', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })

      const data = await response.json()

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || 'پاسخی دریافت نشد. لطفاً دوباره تلاش کنید.',
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'خطا در اتصال به دست‌یاری AI. لطفاً چند لحظه بعد دوباره تلاش کنید.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f4ea] text-[#123d25]" dir="rtl">
      <section className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl bg-white rounded-[32px] shadow-2xl border border-[#e5dfd2] overflow-hidden">
          <div className="bg-gradient-to-l from-[#123d25] to-[#1f6b3a] text-white px-8 py-7 text-center">
            <h1 className="text-4xl font-bold mb-2">دست‌یاری AI</h1>
            <p className="text-[#f4e7b8] text-base">
              راهنمای هوشمند برای پاسخ به پرسش‌های عمومی درباره دست‌یاری
            </p>
          </div>

          <div className="h-[430px] overflow-y-auto p-6 space-y-4 bg-[#fbfaf6]">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3 leading-8 text-sm md:text-base ${
                    msg.role === 'user'
                      ? 'bg-[#1f6b3a] text-white'
                      : 'bg-white border border-[#e5dfd2] text-[#123d25]'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-end">
                <div className="bg-white border border-[#e5dfd2] rounded-2xl px-5 py-3 text-[#123d25]">
                  در حال پاسخ‌دادن...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-[#e5dfd2] bg-white p-4">
            <div className="flex gap-3 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="پرسش خود را بنویسید..."
                rows={1}
                className="flex-1 resize-none rounded-2xl border border-[#d8d0c2] px-4 py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-[#1f6b3a]/40 min-h-[48px] max-h-[140px]"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="rounded-2xl bg-[#1f6b3a] text-white px-6 py-3 font-bold disabled:opacity-50 hover:bg-[#15512b] transition"
              >
                ارسال
              </button>
            </div>

            <p className="text-center text-xs text-[#6b7a70] mt-3">
              این ابزار تنها برای راهنمایی عمومی است و جایگزین تصمیم‌گیری رسمی اعضا نمی‌شود.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
