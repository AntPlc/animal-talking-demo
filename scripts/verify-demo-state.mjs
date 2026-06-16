import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npcDataPath = resolve(root, "lib/npc-data.ts");
const demoStatePath = resolve(root, "lib/demo-state.ts");

const npcSourceText = readFileSync(npcDataPath, "utf8");
const demoSourceText = readFileSync(demoStatePath, "utf8");

const npcSource = ts.createSourceFile(npcDataPath, npcSourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const demoSource = ts.createSourceFile(demoStatePath, demoSourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const npcIds = readObjectIds(npcSource, "NPC_PROFILES");
const initialPositionIds = readObjectKeys(demoSource, "INITIAL_POSITIONS");

const missingPositions = npcIds.filter((id) => !initialPositionIds.includes(id));
const extraPositions = initialPositionIds.filter((id) => !npcIds.includes(id));

if (missingPositions.length > 0 || extraPositions.length > 0) {
  const problems = [];

  if (missingPositions.length > 0) {
    problems.push(`missing positions for: ${missingPositions.join(", ")}`);
  }

  if (extraPositions.length > 0) {
    problems.push(`extra positions for: ${extraPositions.join(", ")}`);
  }

  throw new Error(`NPC seed mismatch: ${problems.join("; ")}`);
}

console.log(`NPC seed check passed for ${npcIds.length} characters.`);

function readObjectIds(sourceFile, variableName) {
  const arrayLiteral = unwrapExpression(getVariableInitializer(sourceFile, variableName));

  if (!arrayLiteral || !ts.isArrayLiteralExpression(arrayLiteral)) {
    throw new Error(`Could not find array initializer for ${variableName}.`);
  }

  return arrayLiteral.elements.map((element, index) => {
    if (!ts.isObjectLiteralExpression(element)) {
      throw new Error(`Expected ${variableName}[${index}] to be an object literal.`);
    }

    const idProperty = element.properties.find(
      (property) =>
        ts.isPropertyAssignment(property) &&
        ts.isIdentifier(property.name) &&
        property.name.text === "id",
    );

    if (!idProperty || !ts.isPropertyAssignment(idProperty)) {
      throw new Error(`Expected ${variableName}[${index}] to define an id property.`);
    }

    const initializer = idProperty.initializer;

    if (!ts.isStringLiteral(initializer)) {
      throw new Error(`Expected ${variableName}[${index}].id to be a string literal.`);
    }

    return initializer.text;
  });
}

function readObjectKeys(sourceFile, variableName) {
  const objectLiteral = unwrapExpression(getVariableInitializer(sourceFile, variableName));

  if (!objectLiteral || !ts.isObjectLiteralExpression(objectLiteral)) {
    throw new Error(`Could not find object initializer for ${variableName}.`);
  }

  return objectLiteral.properties.map((property, index) => {
    if (!ts.isPropertyAssignment(property)) {
      throw new Error(`Expected ${variableName}[${index}] to be a property assignment.`);
    }

    if (!ts.isIdentifier(property.name)) {
      throw new Error(`Expected ${variableName}[${index}] to use an identifier key.`);
    }

    return property.name.text;
  });
}

function getVariableInitializer(sourceFile, variableName) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === variableName) {
        return declaration.initializer ?? null;
      }
    }
  }

  return null;
}

function unwrapExpression(expression) {
  let current = expression;

  while (
    current &&
    (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current))
  ) {
    current = current.expression;
  }

  return current;
}
