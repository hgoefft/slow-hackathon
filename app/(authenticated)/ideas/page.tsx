import { getIdeas } from "@/lib/actions/ideas"
import { IdeaForm } from "./idea-form"
import { IdeaCard } from "./idea-card"

export default async function IdeasPage() {
  const ideas = await getIdeas()

  const raw = ideas.filter((i) => i.status === "raw")
  const inProgress = ideas.filter((i) => ["auditioning", "greenlit", "in_production"].includes(i.status))
  const live = ideas.filter((i) => ["live", "analyzed"].includes(i.status))

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Ideas</h1>
        <p className="text-muted-foreground text-sm mt-1">Log and audition content ideas before investing production effort</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-1">
          <IdeaForm />
        </div>

        {/* Ideas list */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {ideas.length === 0 ? (
            <div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground text-sm">
              No ideas yet — log your first one to get started.
            </div>
          ) : (
            <>
              {raw.length > 0 && (
                <section>
                  <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Raw Ideas</h2>
                  <div className="flex flex-col gap-3">
                    {raw.map((idea) => <IdeaCard key={idea.id} idea={idea} />)}
                  </div>
                </section>
              )}
              {inProgress.length > 0 && (
                <section>
                  <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">In Progress</h2>
                  <div className="flex flex-col gap-3">
                    {inProgress.map((idea) => <IdeaCard key={idea.id} idea={idea} />)}
                  </div>
                </section>
              )}
              {live.length > 0 && (
                <section>
                  <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Live</h2>
                  <div className="flex flex-col gap-3">
                    {live.map((idea) => <IdeaCard key={idea.id} idea={idea} />)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
