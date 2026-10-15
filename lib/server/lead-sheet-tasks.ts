import "server-only";
import { addDays, mondayOfWeek } from "@/lib/campaigns/logic";
import { createAdminClient } from "@/lib/supabase/admin";

type Campaign = { id: string; assigned_to: string | null; created_by: string; stage: "awaiting_completion" | "complete" };

export async function generateLeadSheetTasks(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const admin = createAdminClient();
  let weeklyCreated = 0;
  let backlogCreated = 0;
  let backlogAdded = 0;

  // Friday: campaigns from the preceding Monday-Sunday campaign week become due.
  if (weekday === 5) {
    const taskWeekStart = mondayOfWeek(date);
    const dueWeekStart = addDays(taskWeekStart, -7);
    const dueWeekEnd = addDays(dueWeekStart, 6);
    const { data: campaigns, error } = await admin.from("campaigns").select("id, assigned_to, created_by, stage").eq("is_shared", false).gte("campaign_date", dueWeekStart).lte("campaign_date", dueWeekEnd).neq("stage", "complete");
    if (error) throw new Error(error.message);
    const byOwner = new Map<string, Campaign[]>();
    for (const campaign of (campaigns ?? []) as Campaign[]) {
      const ownerId = campaign.assigned_to ?? campaign.created_by;
      byOwner.set(ownerId, [...(byOwner.get(ownerId) ?? []), campaign]);
    }
    for (const [ownerId, ownerCampaigns] of byOwner) {
      const { data: existingSheet, error: existingSheetError } = await admin.from("weekly_lead_sheets").select("id").eq("owner_id", ownerId).eq("week_start", taskWeekStart).maybeSingle();
      if (existingSheetError) throw new Error(existingSheetError.message);
      if (existingSheet) continue;
      const { data: task, error: taskError } = await admin.from("tasks").insert({ assigned_to: ownerId, assigned_by: ownerId, title: "Weekly Lead Sheet", category: "lead_sheet", scheduled_date: date, quantity_required: ownerCampaigns.length, quantity_done: 0, priority: "medium", status: "not_started", requires_proof: false, is_pool_task: false }).select("id").single();
      if (taskError || !task) {
        if (taskError?.code === "23505") continue;
        throw new Error(taskError?.message ?? "Could not create weekly lead sheet task");
      }
      const { data: sheet, error: sheetError } = await admin.from("weekly_lead_sheets").insert({ task_id: task.id, owner_id: ownerId, week_start: taskWeekStart }).select("id").single();
      if (sheetError || !sheet) throw new Error(sheetError?.message ?? "Could not create weekly lead sheet");
      const { error: itemError } = await admin.from("weekly_lead_sheet_items").insert(ownerCampaigns.map((campaign) => ({ weekly_lead_sheet_id: sheet.id, campaign_id: campaign.id, completed: campaign.stage === "complete" })));
      if (itemError) throw new Error(itemError.message);
      weeklyCreated += 1;
    }
  }

  // Monday: unfinished campaigns from last week's sheets are appended to the owner's active backlog.
  if (weekday === 1) {
    const priorTaskWeekStart = addDays(mondayOfWeek(date), -7);
    const { data: sheets, error } = await admin.from("weekly_lead_sheets").select("id, owner_id, weekly_lead_sheet_items(campaign_id, completed, campaigns!inner(stage))").eq("week_start", priorTaskWeekStart);
    if (error) throw new Error(error.message);
    for (const sheet of sheets ?? []) {
      const items = sheet.weekly_lead_sheet_items as unknown as Array<{ campaign_id: string; completed: boolean; campaigns: Array<{ stage: string }> }>;
      const remainingIds = items.filter((item) => !item.completed && item.campaigns[0]?.stage !== "complete").map((item) => item.campaign_id);
      if (!remainingIds.length) continue;
      const { data: activeBacklog, error: backlogError } = await admin.from("lead_sheet_backlogs").select("id, task_id, tasks!inner(status)").eq("owner_id", sheet.owner_id).neq("tasks.status", "done").maybeSingle();
      if (backlogError) throw new Error(backlogError.message);
      let backlog = activeBacklog as { id: string; task_id: string } | null;
      if (!backlog) {
        const { data: task, error: taskError } = await admin.from("tasks").insert({ assigned_to: sheet.owner_id, assigned_by: sheet.owner_id, title: "Lead Sheet Backlog", category: "lead_sheet", scheduled_date: date, quantity_required: null, quantity_done: 0, priority: "flexible", status: "not_started", requires_proof: false, is_pool_task: true, pool_target_total: 1 }).select("id").single();
        if (taskError || !task) throw new Error(taskError?.message ?? "Could not create lead sheet backlog task");
        const { data: newBacklog, error: newBacklogError } = await admin.from("lead_sheet_backlogs").insert({ task_id: task.id, owner_id: sheet.owner_id }).select("id, task_id").single();
        if (newBacklogError || !newBacklog) throw new Error(newBacklogError?.message ?? "Could not create lead sheet backlog");
        backlog = newBacklog;
        backlogCreated += 1;
      }
      const { data: existing, error: existingError } = await admin.from("lead_sheet_backlog_items").select("campaign_id").eq("backlog_id", backlog.id).in("campaign_id", remainingIds);
      if (existingError) throw new Error(existingError.message);
      const existingIds = new Set((existing ?? []).map((item) => item.campaign_id));
      const additions = remainingIds.filter((id) => !existingIds.has(id));
      if (!additions.length) continue;
      const { error: itemError } = await admin.from("lead_sheet_backlog_items").insert(additions.map((campaignId) => ({ backlog_id: backlog!.id, campaign_id: campaignId })));
      if (itemError) throw new Error(itemError.message);
      const { count: target, error: targetError } = await admin.from("lead_sheet_backlog_items").select("id", { count: "exact", head: true }).eq("backlog_id", backlog.id);
      const { count: completed, error: completedError } = await admin.from("lead_sheet_backlog_items").select("id", { count: "exact", head: true }).eq("backlog_id", backlog.id).eq("completed", true);
      if (targetError || completedError) throw new Error((targetError ?? completedError)?.message ?? "Could not count lead sheet backlog items");
      const { error: taskUpdateError } = await admin.from("tasks").update({ pool_target_total: target ?? additions.length, quantity_done: completed ?? 0, status: "in_progress" }).eq("id", backlog.task_id);
      if (taskUpdateError) throw new Error(taskUpdateError.message);
      backlogAdded += additions.length;
    }
  }
  return { weeklyCreated, backlogCreated, backlogAdded };
}

export async function reconcileCampaignTaskItems(campaignId: string, isComplete: boolean) {
  const admin = createAdminClient();
  await Promise.all([
    admin.from("weekly_lead_sheet_items").update({ completed: isComplete }).eq("campaign_id", campaignId),
    admin.from("lead_sheet_backlog_items").update({ completed: isComplete }).eq("campaign_id", campaignId),
  ]);
  const [{ data: weeklyItems }, { data: backlogItems }] = await Promise.all([
    admin.from("weekly_lead_sheet_items").select("weekly_lead_sheet_id, weekly_lead_sheets!inner(task_id)").eq("campaign_id", campaignId),
    admin.from("lead_sheet_backlog_items").select("backlog_id, lead_sheet_backlogs!inner(task_id)").eq("campaign_id", campaignId),
  ]);
  for (const item of weeklyItems ?? []) {
    const sheet = item.weekly_lead_sheets as unknown as { task_id: string };
    const { count } = await admin.from("weekly_lead_sheet_items").select("id", { count: "exact", head: true }).eq("weekly_lead_sheet_id", item.weekly_lead_sheet_id).eq("completed", false);
    if ((count ?? 0) === 0) await admin.from("tasks").update({ status: "done" }).eq("id", sheet.task_id);
  }
  for (const item of backlogItems ?? []) {
    const backlog = item.lead_sheet_backlogs as unknown as { task_id: string };
    const [{ count: total }, { count: completed }] = await Promise.all([
      admin.from("lead_sheet_backlog_items").select("id", { count: "exact", head: true }).eq("backlog_id", item.backlog_id),
      admin.from("lead_sheet_backlog_items").select("id", { count: "exact", head: true }).eq("backlog_id", item.backlog_id).eq("completed", true),
    ]);
    const target = Math.max(total ?? 0, 1); const quantityDone = completed ?? 0;
    await admin.from("tasks").update({ quantity_done: quantityDone, pool_target_total: target, status: quantityDone >= target ? "done" : "in_progress" }).eq("id", backlog.task_id);
  }
}
