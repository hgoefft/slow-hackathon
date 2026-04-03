"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createIdea } from "@/lib/actions/ideas"
import { Plus } from "lucide-react"

export function IdeaForm() {
  const [pending, setPending] = useState(false)
  const [contentType, setContentType] = useState("")
  const [effortLevel, setEffortLevel] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const formData = new FormData(e.currentTarget)
    formData.set("contentType", contentType)
    formData.set("effortLevel", effortLevel)
    await createIdea(formData)
    e.currentTarget.reset()
    setContentType("")
    setEffortLevel("")
    setPending(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log an Idea</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="What's the idea?" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="concept">Concept</Label>
            <Textarea
              id="concept"
              name="concept"
              placeholder="Rough concept, angle, or any context..."
              className="mt-1 resize-none"
              rows={4}
            />
          </div>
          <div>
            <Label>Content Type</Label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short_form_video">Short-form Video</SelectItem>
                <SelectItem value="long_form_video">Long-form Video (YouTube)</SelectItem>
                <SelectItem value="written">Written (Substack / LinkedIn)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Effort Level</Label>
            <Select value={effortLevel} onValueChange={setEffortLevel}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="How much effort?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low — quick to produce</SelectItem>
                <SelectItem value="medium">Medium — some prep</SelectItem>
                <SelectItem value="high">High — YouTube / Substack level</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            {pending ? "Saving…" : "Log Idea"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
