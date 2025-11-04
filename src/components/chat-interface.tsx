import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

export function ChatInterface({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Math.random().toString(),
      role: "user",
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch(`/api/chat/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      })

      if (!response.ok) throw new Error("Failed to get response")

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      let assistantMessage = ""
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        assistantMessage += chunk

        setMessages((prev) => {
          const updated = [...prev]
          if (updated[updated.length - 1]?.role === "assistant") {
            updated[updated.length - 1].content = assistantMessage
          } else {
            updated.push({
              id: Math.random().toString(),
              role: "assistant",
              content: assistantMessage,
            })
          }
          return updated
        })
      }
    } catch (error) {
      console.error("Chat error:", error)
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "assistant",
          content: "Error: Failed to generate response. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col border-r border-border">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-center">
            <div className="max-w-md space-y-4">
              <h2 className="text-2xl font-bold">Start Building</h2>
              <p className="text-muted-foreground">
                Describe the website you want to build, and I'll generate the code for you.
              </p>
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Generating...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="border-t border-border p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your website..."
            className="flex-1 min-h-[60px] max-h-[200px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
