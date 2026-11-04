# Task-based builds

Project managers create and assign tasks manually, maintain acceptance checklists, post team comments and review outcomes. Only developers invoke AI. Moving a card does not execute an agent.

Developers use the project's right-side Alpha panel to ask about selected tasks or draft task suggestions. Suggestions are reviewed before being added to Backlog. Backlog captures work that has not yet been selected or made ready; Todo identifies work ready for a developer.

For a task, choose **Plan build** and optionally add developer instructions. A saved request prepares a plan through the existing private chat build path. The Orchestrator, scoped specialist tools, independent review and publication gates are shared with Chat. The standalone Chat tab remains behind a reversible visibility flag.

If another task owns a selected repository, the task shows **Waiting for** that task and a direct link when accessible. **Queue plan** explicitly saves a local planning request. Closing the desktop postpones execution; reopening rechecks access, current requirements and repository ownership. A queued plan does not approve the later execution plan. Removing a queued request does not stop another task.

Review the plan and choose **Approve plan and build**. **Revise plan** prepares a validated replacement while retaining the existing unstarted plan. A replacement needs approval; a failed or stale replacement does not cancel the old plan.

The parent build owns the task state. Finishing one specialist does not finish the whole build. Running counts exclude waiting, paused and blocked work; stale data disables build actions until refreshed. Old cancellations remain historical results, rather than readiness for a new build.

Recovery names the failed step and available actions. **Review saved work** shows the current candidate and bounded archive previews. Explicit archive restoration requires unchanged hashes, a clean compatible checkpoint, approved file scope and no active writer. Restored edits remain unverified. When an episode is exhausted, a developer can inspect and authorize a bounded recovery restart with a concrete changed condition. Attempts and cumulative execution budgets are retained; checks, independent review and final approval still apply.

Use **Post comment** for team-visible notes. Developer prompts and build instructions are separate private actions. A checklist with evidence does not by itself mean the task is accepted. Opening a pull request is distinct from deployment, UAT review and Done.

Raw execution-log streaming remains local. Compact status polling and on-demand saved-work previews do not add verbose logs to shared board streaming. Billing-level egress equivalence requires measurement.
