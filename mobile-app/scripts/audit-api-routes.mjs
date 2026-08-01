import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const backendOpenApiPath = path.resolve(projectRoot, '../backend/openapi.json');
const sourceDirectories = [
  path.join(projectRoot, 'src/data'),
  path.join(projectRoot, 'src/services')
];
const issues = [];

if (!fs.existsSync(backendOpenApiPath)) {
  console.error(
    'API route audit failed: backend/openapi.json is missing. Run the backend OpenAPI generator first.'
  );
  process.exit(1);
}

const openApi = JSON.parse(fs.readFileSync(backendOpenApiPath, 'utf8'));
const backendOperations = new Set(
  Object.entries(openApi.paths ?? {}).flatMap(([route, operations]) =>
    Object.keys(operations).map(
      (method) => `${method.toUpperCase()} ${normalizeBackendRoute(route)}`
    )
  )
);
const frontendOperations = [];

for (const filePath of sourceDirectories.flatMap(collectSourceFiles)) {
  if (filePath.endsWith('.test.ts') || filePath.endsWith('.spec.ts')) {
    continue;
  }

  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  visit(sourceFile, sourceFile);
}

for (const operation of frontendOperations) {
  if (!backendOperations.has(`${operation.method} ${operation.route}`)) {
    issues.push(
      `${operation.relativePath}:${operation.line}: no backend operation for ` +
      `${operation.method} ${operation.route}`
    );
  }
}

if (frontendOperations.length === 0) {
  issues.push('no mobile API requests were discovered');
}

if (issues.length > 0) {
  console.error('API route audit failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  const uniqueOperations = new Set(
    frontendOperations.map(({ method, route }) => `${method} ${route}`)
  );
  console.log(
    `API route audit passed: ${frontendOperations.length} request call sites, ` +
    `${uniqueOperations.size} mobile operations, ${backendOperations.size} backend operations.`
  );
}

function visit(node, sourceFile) {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'request' &&
    node.arguments.length > 0
  ) {
    const route = readRoute(node.arguments[0]);
    const method = readMethod(node.arguments[1]);
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const relativePath = path.relative(projectRoot, sourceFile.fileName).replaceAll('\\', '/');

    if (!route) {
      issues.push(
        `${relativePath}:${line + 1}: API route must be a statically auditable string or template`
      );
    } else {
      frontendOperations.push({
        line: line + 1,
        method,
        relativePath,
        route: normalizeFrontendRoute(route)
      });
    }
  }

  ts.forEachChild(node, (child) => visit(child, sourceFile));
}

function readRoute(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (ts.isTemplateExpression(node)) {
    return [
      node.head.text,
      ...node.templateSpans.flatMap((span) => [
        '{param}',
        span.literal.text
      ])
    ].join('');
  }

  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = readRoute(node.left);
    const right = readRoute(node.right);
    return left === null || right === null ? null : `${left}${right}`;
  }

  return null;
}

function readMethod(optionsNode) {
  if (!optionsNode || !ts.isObjectLiteralExpression(optionsNode)) {
    return 'GET';
  }

  const methodProperty = optionsNode.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      property.name.getText() === 'method'
  );

  if (
    methodProperty &&
    ts.isPropertyAssignment(methodProperty) &&
    (ts.isStringLiteral(methodProperty.initializer) ||
      ts.isNoSubstitutionTemplateLiteral(methodProperty.initializer))
  ) {
    return methodProperty.initializer.text.toUpperCase();
  }

  return 'GET';
}

function normalizeFrontendRoute(route) {
  const [pathname] = route.split(/[?#]/, 1);
  return pathname
    .replace(/\/+/g, '/')
    .replace(/\{param\}/g, '{param}')
    .replace(/\/$/, '') || '/';
}

function normalizeBackendRoute(route) {
  return route
    .replace(/\{[^}]+\}/g, '{param}')
    .replace(/\/$/, '') || '/';
}

function collectSourceFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? collectSourceFiles(entryPath)
      : /\.(ts|tsx)$/.test(entry.name)
        ? [entryPath]
        : [];
  });
}
