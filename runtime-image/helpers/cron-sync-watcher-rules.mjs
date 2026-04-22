export const CRON_JOBS_FILE = "jobs.json";
export const CRON_JOBS_STATE_FILE = "jobs-state.json";
export const CRON_RUN_LOG_EXTENSION = ".jsonl";

export function isCronTaskRefreshFileName(fileName) {
  return fileName === CRON_JOBS_FILE || fileName === CRON_JOBS_STATE_FILE;
}

export function isCronRunLogFileName(fileName) {
  return (
    typeof fileName === "string" &&
    fileName.length > CRON_RUN_LOG_EXTENSION.length &&
    fileName.endsWith(CRON_RUN_LOG_EXTENSION)
  );
}
