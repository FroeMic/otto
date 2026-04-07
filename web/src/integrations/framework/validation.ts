import type { IntegrationCommandDefinition } from "./types";

export function validateCommandArguments(
  command: IntegrationCommandDefinition,
  argumentsObject: Record<string, unknown>,
) {
  const schema = command.argumentsSchema;
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
    for (const key of Object.keys(argumentsObject)) {
      if (!(key in properties)) {
        throw new Error(
          `${command.commandKey} does not accept the ${key} argument.`,
        );
      }
    }
  }

  for (const key of required) {
    if (argumentsObject[key] === undefined || argumentsObject[key] === null) {
      throw new Error(`${command.commandKey} requires the ${key} argument.`);
    }
  }

  for (const [key, propertySchema] of Object.entries(properties)) {
    const value = argumentsObject[key];

    if (value === undefined || value === null) {
      continue;
    }

    if (propertySchema.const !== undefined && value !== propertySchema.const) {
      throw new Error(
        `${command.commandKey} requires ${key}=${JSON.stringify(propertySchema.const)}.`,
      );
    }

    switch (propertySchema.type) {
      case "string": {
        if (typeof value !== "string") {
          throw new Error(
            `${command.commandKey} requires ${key} to be a string.`,
          );
        }

        if (
          typeof propertySchema.minLength === "number" &&
          value.length < propertySchema.minLength
        ) {
          throw new Error(
            `${command.commandKey} requires ${key} to be at least ${propertySchema.minLength} characters.`,
          );
        }
        break;
      }
      case "integer": {
        if (typeof value !== "number" || !Number.isInteger(value)) {
          throw new Error(
            `${command.commandKey} requires ${key} to be an integer.`,
          );
        }

        if (
          typeof propertySchema.minimum === "number" &&
          value < propertySchema.minimum
        ) {
          throw new Error(
            `${command.commandKey} requires ${key} to be >= ${propertySchema.minimum}.`,
          );
        }

        if (
          typeof propertySchema.maximum === "number" &&
          value > propertySchema.maximum
        ) {
          throw new Error(
            `${command.commandKey} requires ${key} to be <= ${propertySchema.maximum}.`,
          );
        }
        break;
      }
      case "object": {
        if (typeof value !== "object" || Array.isArray(value)) {
          throw new Error(
            `${command.commandKey} requires ${key} to be an object.`,
          );
        }
        break;
      }
    }
  }
}
