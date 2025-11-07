"use client"

import { useState } from "react"
import { Plus, Settings2, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

export function CreateProjectPrompt() {
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)

  const create = async () => {
    const prompt = value.trim()
    if (!prompt) return
    setLoading(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: prompt // AI will generate the name and description
        }),
      })
      if (!res.ok) throw new Error("Failed to create project")
      const project = await res.json()
      if (typeof window !== "undefined") {
        window.location.assign(`/project/${project.id}`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      create()
    }
  }

  return (
    <div className="w-full max-w-3xl">
      {loading && (
        <div className="mb-4 text-center text-sm text-muted-foreground animate-pulse">
          AI is generating your project... This may take a moment.
        </div>
      )}
      <InputGroup className="h-14">
        <InputGroupAddon>
          <InputGroupButton aria-label="Add" size="icon-sm" variant="ghost">
            <Plus className="size-4" />
          </InputGroupButton>
          <InputGroupButton aria-label="Options" size="icon-sm" variant="ghost">
            <Settings2 className="size-4" />
          </InputGroupButton>
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Describe what to build..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-14 text-base"
          disabled={loading}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="Create"
            size="icon-sm"
            variant="ghost"
            onClick={create}
            disabled={loading || !value.trim()}
          >
            <ArrowUpRight className="size-5" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
        <Button size="sm" variant="outline">Clone a Screenshot</Button>
        <Button size="sm" variant="outline">Import from Figma</Button>
        <Button size="sm" variant="outline">Upload a Project</Button>
        <Button size="sm" variant="outline">Landing Page</Button>
      </div>
    </div>
  )
}
