import type { IntegrationOperationDefinition } from "./types";

export function validateOperationParameters(
  operation: IntegrationOperationDefinition,
  params: Record<string, unknown>,
) {
  const schema = operation.parametersSchema;
  const properties =
    schema.properties &&
    typeof schema.properties === "object" &&
    !Array.isArray(schema.properties)
      ? (schema.properties as Record<string, Record<string, unknown>>)
      : {};
  const required = Array.isArray(schema.required)
    ? schema.required.filter(
        (value): value is string => typeof value === "string",
      )
    : [];

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(params)) {
      if (!(key in properties)) {
        throw new Error(
          `${operation.key} does not accept the ${key} parameter.`,
        );
      }
    }
  }

  for (const key of required) {
    if (params[key] === undefined || params[key] === null) {
      throw new Error(`${operation.key} requires the ${key} parameter.`);
    }
  }

  for (const [key, propertySchema] of Object.entries(properties)) {
    const value = params[key];

    if (value === undefined || value === null) {
      continue;
    }

    if (propertySchema.const !== undefined && value !== propertySchema.const) {
      throw new Error(
        `${operation.key} requires ${key}=${JSON.stringify(propertySchema.const)}.`,
      );
    }

    switch (propertySchema.type) {
      case "string": {
        if (typeof value !== "string") {
          throw new Error(`${operation.key} requires ${key} to be a string.`);
        }

        if (
          typeof propertySchema.minLength === "number" &&
          value.length < propertySchema.minLength
        ) {
          throw new Error(
            `${operation.key} requires ${key} to be at least ${propertySchema.minLength} characters.`,
          );
        }
        break;
      }
      case "integer": {
        if (typeof value !== "number" || !Number.isInteger(value)) {
          throw new Error(`${operation.key} requires ${key} to be an integer.`);
        }

        if (
          typeof propertySchema.minimum === "number" &&
          value < propertySchema.minimum
        ) {
          throw new Error(
            `${operation.key} requires ${key} to be >= ${propertySchema.minimum}.`,
          );
        }

        if (
          typeof propertySchema.maximum === "number" &&
          value > propertySchema.maximum
        ) {
          throw new Error(
            `${operation.key} requires ${key} to be <= ${propertySchema.maximum}.`,
          );
        }
        break;
      }
      case "object": {
        if (typeof value !== "object" || Array.isArray(value)) {
          throw new Error(`${operation.key} requires ${key} to be an object.`);
        }
        break;
      }
    }
  }
}
