import type {
  DayOfWeek,
  IstDateString,
  TaskEngineHoliday,
  TaskEngineOffDayRequest,
  TaskEngineUser,
  WorkingDayContext,
} from "./types";

const MS_PER_DAY = 86_400_000;

/** Parse YYYY-MM-DD into UTC ms at noon IST (avoids DST; IST has no DST). */
function istNoonUtcMs(date: IstDateString): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day, 6, 30, 0);
}

function formatIstDate(ms: number): IstDateString {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** PostgreSQL DOW for a calendar date in IST (0 = Sunday … 6 = Saturday). */
export function getPostgresDow(date: IstDateString): DayOfWeek {
  return new Date(istNoonUtcMs(date)).getUTCDay() as DayOfWeek;
}

export function addIstDays(date: IstDateString, days: number): IstDateString {
  return formatIstDate(istNoonUtcMs(date) + days * MS_PER_DAY);
}

function holidayAppliesToUser(
  holiday: TaskEngineHoliday,
  userId: string,
): boolean {
  if (holiday.applies_to === null) {
    return true;
  }
  return holiday.applies_to.includes(userId);
}

function isApprovedOffDay(
  userId: string,
  date: IstDateString,
  offDayRequests: TaskEngineOffDayRequest[],
): boolean {
  return offDayRequests.some(
    (request) =>
      request.user_id === userId &&
      request.date === date &&
      request.status === "approved",
  );
}

/** Whether the user is scheduled to work on this IST calendar date. */
export function isWorkingDay(context: WorkingDayContext): boolean {
  const { user, date, holidays, offDayRequests } = context;
  const dow = getPostgresDow(date);

  if (!user.work_days.includes(dow)) {
    return false;
  }

  if (
    holidays.some(
      (holiday) =>
        holiday.date === date && holidayAppliesToUser(holiday, user.id),
    )
  ) {
    return false;
  }

  if (isApprovedOffDay(user.id, date, offDayRequests)) {
    return false;
  }

  return true;
}

export interface WalkWorkingDayOptions {
  user: TaskEngineUser;
  holidays: TaskEngineHoliday[];
  offDayRequests: TaskEngineOffDayRequest[];
  /** Safety limit when walking the calendar (default 30). */
  maxSteps?: number;
}

function walkWorkingDay(
  startDate: IstDateString,
  direction: -1 | 1,
  options: WalkWorkingDayOptions,
): IstDateString | null {
  const maxSteps = options.maxSteps ?? 30;

  for (let step = 1; step <= maxSteps; step += 1) {
    const candidate = addIstDays(startDate, direction * step);
    if (
      isWorkingDay({
        user: options.user,
        date: candidate,
        holidays: options.holidays,
        offDayRequests: options.offDayRequests,
      })
    ) {
      return candidate;
    }
  }

  return null;
}

/** Nearest working day before `date` (exclusive of `date` itself). */
export function previousWorkingDay(
  date: IstDateString,
  options: WalkWorkingDayOptions,
): IstDateString | null {
  return walkWorkingDay(date, -1, options);
}

/** Nearest working day after `date` (exclusive of `date` itself). */
export function nextWorkingDay(
  date: IstDateString,
  options: WalkWorkingDayOptions,
): IstDateString | null {
  return walkWorkingDay(date, 1, options);
}

export function buildWorkingDayContext(
  user: TaskEngineUser,
  date: IstDateString,
  holidays: TaskEngineHoliday[],
  offDayRequests: TaskEngineOffDayRequest[],
): WorkingDayContext {
  return { user, date, holidays, offDayRequests };
}
