type ErrorLike = {
  cause?: unknown;
  code?: string;
  column?: string;
  constraint?: string;
  detail?: string;
  file?: string;
  hint?: string;
  line?: string;
  message?: string;
  name?: string;
  routine?: string;
  schema?: string;
  severity?: string;
  severity_local?: string;
  table?: string;
  where?: string;
};

export function logCliError(error: unknown) {
  if (!(error instanceof Error)) {
    console.error(error);
    return;
  }

  console.error(error.message);

  const details = collectErrorDetails(error.cause);

  if (details.length === 0) {
    return;
  }

  console.error(
    JSON.stringify(
      {
        causes: details,
      },
      null,
      2,
    ),
  );
}

function collectErrorDetails(error: unknown) {
  const details: Array<Record<string, string>> = [];
  let current = error;

  while (isErrorLike(current)) {
    const detail = compactRecord({
      code: current.code,
      column: current.column,
      constraint: current.constraint,
      detail: current.detail,
      file: current.file,
      hint: current.hint,
      line: current.line,
      message: current.message,
      name: current.name,
      routine: current.routine,
      schema: current.schema,
      severity: current.severity_local ?? current.severity,
      table: current.table,
      where: current.where,
    });

    if (Object.keys(detail).length > 0) {
      details.push(detail);
    }

    current = current.cause;
  }

  return details;
}

function compactRecord(
  value: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
}

function isErrorLike(value: unknown): value is ErrorLike {
  return typeof value === "object" && value !== null;
}
