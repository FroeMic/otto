import assert from "node:assert/strict";
import test from "node:test";

import {
  describeCronExpression,
  describeScheduledTaskSchedule,
} from "@/lib/scheduled-tasks/cron-description";

test("describes common cron expressions in brief natural language", () => {
  assert.equal(describeCronExpression("0 * * * *"), "Every hour at :00");
  assert.equal(describeCronExpression("*/15 * * * *"), "Every 15 minutes");
  assert.equal(describeCronExpression("15 */2 * * *"), "Every 2 hours at :15");
  assert.equal(describeCronExpression("0 9 * * *"), "Every day at 09:00");
  assert.equal(
    describeCronExpression("30 9 * * 1,3"),
    "Every Mon, Wed at 09:30",
  );
  assert.equal(
    describeCronExpression("0 8 1 * *"),
    "Every month on day 1 at 08:00",
  );
});

test("falls back to the raw cron expression when the pattern is unsupported", () => {
  assert.equal(describeCronExpression("1-5 * * * *"), "1-5 * * * *");
});

test("formats non-cron schedules using the synced schedule payload", () => {
  assert.equal(
    describeScheduledTaskSchedule({
      scheduleExpression: "Recurring",
      scheduleJson: { everyMs: 30 * 60 * 1000, kind: "every" },
      timezone: null,
    }),
    "Every 30 minutes",
  );
  assert.equal(
    describeScheduledTaskSchedule({
      scheduleExpression: "0 9 * * *",
      scheduleJson: { expr: "0 9 * * *", kind: "cron", tz: "Europe/Berlin" },
      timezone: "Europe/Berlin",
    }),
    "Every day at 09:00 (Europe/Berlin)",
  );
});
