/** PostgreSQL DOW: 0 = Sunday … 6 = Saturday */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type UserRole = "admin" | "manager" | "employee";

export type TaskCategory =
  | "whatsapp_campaign"
  | "email_campaign"
  | "inbox_check"
  | "instagram_post"
  | "content_research"
  | "lead_sheet"
  | "catalog_revamp"
  | "other";

export type TaskPriority = "high" | "medium" | "low" | "flexible";

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "done"
  | "at_risk"
  | "blocked";

export type OffDayRequestStatus = "pending" | "approved" | "rejected";

/** Calendar date in IST, formatted YYYY-MM-DD */
export type IstDateString = string;

export interface TaskEngineUser {
  id: string;
  work_days: DayOfWeek[];
}

export interface TaskEngineHoliday {
  date: IstDateString;
  /** null = company-wide */
  applies_to: string[] | null;
}

export interface TaskEngineOffDayRequest {
  user_id: string;
  date: IstDateString;
  status: OffDayRequestStatus;
}

export interface TaskEngineTemplate {
  id: string;
  title: string;
  category: TaskCategory;
  day_of_week: DayOfWeek;
  assigned_to: string;
  quantity: number | null;
  time_allotted_minutes: number | null;
  is_mandatory: boolean;
  requires_proof: boolean;
  created_by: string;
}

export interface TaskEngineExistingTask {
  template_id: string | null;
  assigned_to: string;
  scheduled_date: IstDateString;
}

/** Task fields needed to plan an off-day shift before applying it to Postgres. */
export interface TaskEngineShiftTask {
  id: string;
  template_id: string | null;
  assigned_to: string;
  category: TaskCategory;
  scheduled_date: IstDateString;
  quantity_required: number | null;
  priority: TaskPriority;
  status: TaskStatus;
  is_pool_task: boolean;
  carried_forward_from: IstDateString | null;
}

export interface GeneratedTask {
  template_id: string;
  assigned_to: string;
  assigned_by: string;
  title: string;
  category: TaskCategory;
  scheduled_date: IstDateString;
  quantity_required: number | null;
  quantity_done: number;
  time_allotted_minutes: number | null;
  priority: TaskPriority;
  status: TaskStatus;
  requires_proof: boolean;
  is_pool_task: boolean;
}

export interface WorkingDayContext {
  user: TaskEngineUser;
  date: IstDateString;
  holidays: TaskEngineHoliday[];
  offDayRequests: TaskEngineOffDayRequest[];
}

export interface GenerateDailyTasksInput {
  date: IstDateString;
  users: TaskEngineUser[];
  templates: TaskEngineTemplate[];
  existingTasks: TaskEngineExistingTask[];
  holidays: TaskEngineHoliday[];
  offDayRequests: TaskEngineOffDayRequest[];
}

export interface GenerateDailyTasksResult {
  date: IstDateString;
  created: GeneratedTask[];
  skipped: {
    nonWorkingDay: number;
    zeroQuantity: number;
    alreadyExists: number;
  };
}

export interface ShiftTasksForOffDayInput {
  user: TaskEngineUser;
  offDate: IstDateString;
  tasks: TaskEngineShiftTask[];
  holidays: TaskEngineHoliday[];
  offDayRequests: TaskEngineOffDayRequest[];
  maxWorkingDaySteps?: number;
}

export interface ShiftTasksForOffDayResult {
  moved: Array<{
    taskId: string;
    scheduled_date: IstDateString;
    carried_forward_from: IstDateString;
  }>;
  merged: Array<{
    sourceTaskId: string;
    targetTaskId: string;
    quantity_required: number | null;
    carried_forward_from: IstDateString;
  }>;
  skipped: Array<{
    taskId: string;
    reason: "completed" | "no_previous_working_day" | "no_next_working_day";
  }>;
}

export const IST_TIMEZONE = "Asia/Kolkata";

/** Default Mon–Sat in PostgreSQL DOW convention */
export const DEFAULT_WORK_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6];
