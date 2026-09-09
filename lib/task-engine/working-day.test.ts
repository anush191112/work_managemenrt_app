import { describe, expect, it } from "vitest";
import {
  addIstDays,
  getPostgresDow,
  isWorkingDay,
  nextWorkingDay,
  previousWorkingDay,
} from "@/lib/task-engine/working-day";
import {
  DEFAULT_WORK_DAYS,
  type TaskEngineHoliday,
  type TaskEngineOffDayRequest,
  type TaskEngineUser,
} from "@/lib/task-engine/types";

const employee: TaskEngineUser = {
  id: "user-1",
  work_days: DEFAULT_WORK_DAYS,
};

const holidays: TaskEngineHoliday[] = [
  { date: "2026-09-10", applies_to: null },
];

const offDayRequests: TaskEngineOffDayRequest[] = [
  {
    user_id: "user-1",
    date: "2026-09-12",
    status: "approved",
  },
  {
    user_id: "user-1",
    date: "2026-09-15",
    status: "pending",
  },
];

describe("getPostgresDow", () => {
  it("returns PostgreSQL DOW for IST calendar dates", () => {
    expect(getPostgresDow("2026-09-08")).toBe(2); // Tuesday
    expect(getPostgresDow("2026-09-07")).toBe(1); // Monday
    expect(getPostgresDow("2026-09-13")).toBe(0); // Sunday
  });
});

describe("addIstDays", () => {
  it("advances calendar dates without timezone drift", () => {
    expect(addIstDays("2026-09-08", 1)).toBe("2026-09-09");
    expect(addIstDays("2026-09-08", -1)).toBe("2026-09-07");
  });
});

describe("isWorkingDay", () => {
  it("treats Mon–Sat as working days by default", () => {
    expect(
      isWorkingDay({
        user: employee,
        date: "2026-09-07",
        holidays: [],
        offDayRequests: [],
      }),
    ).toBe(true);
  });

  it("treats Sunday as non-working by default", () => {
    expect(
      isWorkingDay({
        user: employee,
        date: "2026-09-13",
        holidays: [],
        offDayRequests: [],
      }),
    ).toBe(false);
  });

  it("respects custom work_days", () => {
    const monWedFri: TaskEngineUser = {
      id: "user-2",
      work_days: [1, 3, 5],
    };

    expect(
      isWorkingDay({
        user: monWedFri,
        date: "2026-09-07",
        holidays: [],
        offDayRequests: [],
      }),
    ).toBe(true);

    expect(
      isWorkingDay({
        user: monWedFri,
        date: "2026-09-08",
        holidays: [],
        offDayRequests: [],
      }),
    ).toBe(false);
  });

  it("blocks company-wide holidays", () => {
    expect(
      isWorkingDay({
        user: employee,
        date: "2026-09-10",
        holidays,
        offDayRequests: [],
      }),
    ).toBe(false);
  });

  it("blocks user-scoped holidays only for listed users", () => {
    const scopedHoliday: TaskEngineHoliday[] = [
      { date: "2026-09-11", applies_to: ["user-1"] },
    ];

    expect(
      isWorkingDay({
        user: employee,
        date: "2026-09-11",
        holidays: scopedHoliday,
        offDayRequests: [],
      }),
    ).toBe(false);

    expect(
      isWorkingDay({
        user: { id: "user-2", work_days: DEFAULT_WORK_DAYS },
        date: "2026-09-11",
        holidays: scopedHoliday,
        offDayRequests: [],
      }),
    ).toBe(true);
  });

  it("blocks approved off-days but not pending requests", () => {
    expect(
      isWorkingDay({
        user: employee,
        date: "2026-09-12",
        holidays: [],
        offDayRequests,
      }),
    ).toBe(false);

    expect(
      isWorkingDay({
        user: employee,
        date: "2026-09-15",
        holidays: [],
        offDayRequests,
      }),
    ).toBe(true);
  });
});

describe("previousWorkingDay / nextWorkingDay", () => {
  it("skips Sunday when walking backward from Monday", () => {
    expect(
      previousWorkingDay("2026-09-08", {
        user: employee,
        holidays: [],
        offDayRequests: [],
      }),
    ).toBe("2026-09-07");
  });

  it("skips Sunday when walking forward from Saturday", () => {
    expect(
      nextWorkingDay("2026-09-12", {
        user: employee,
        holidays: [],
        offDayRequests: [],
      }),
    ).toBe("2026-09-14");
  });

  it("skips an approved off-day when walking backward", () => {
    expect(
      previousWorkingDay("2026-09-13", {
        user: employee,
        holidays: [],
        offDayRequests,
      }),
    ).toBe("2026-09-11");
  });

  it("skips a company holiday when walking forward", () => {
    expect(
      nextWorkingDay("2026-09-09", {
        user: employee,
        holidays,
        offDayRequests: [],
      }),
    ).toBe("2026-09-11");
  });
});
