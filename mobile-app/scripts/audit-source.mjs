import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const sourceRoots = ['app', 'src'];
const sourceFiles = sourceRoots.flatMap((root) => collectSourceFiles(path.join(projectRoot, root)));
const routePatterns = collectRoutePatterns(path.join(projectRoot, 'app'));
const issues = [];
const literalRoutes = new Set();

for (const filePath of sourceFiles) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const relativePath = path.relative(projectRoot, filePath).replaceAll('\\', '/');

  if (relativePath !== 'src/constants/theme.ts') {
    const colorMatch = sourceText.match(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    if (colorMatch) {
      issues.push(`${relativePath}: raw color value ${colorMatch[0]}`);
    }
  }

  for (const marker of ['@ts-ignore', '@ts-expect-error', 'eslint-disable']) {
    if (sourceText.includes(marker)) {
      issues.push(`${relativePath}: forbidden suppression ${marker}`);
    }
  }

  visit(sourceFile, relativePath);
}

for (const route of literalRoutes) {
  if (!routePatterns.some((pattern) => pattern.test(route))) {
    issues.push(`broken literal route: ${route}`);
  }
}

if (issues.length > 0) {
  console.error('Source audit failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Source audit passed: ${sourceFiles.length} files, ${routePatterns.length} routes, ${literalRoutes.size} literal links.`
  );
}

function visit(node, relativePath) {
  if (node.kind === ts.SyntaxKind.AnyKeyword) {
    reportNode(node, relativePath, 'explicit any type');
  }

  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    const tagName = node.tagName.getText();
    if (/^[a-z]/.test(tagName)) {
      reportNode(node, relativePath, `web-style JSX tag <${tagName}>`);
    }
  }

  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.expression.getText() === 'console'
  ) {
    reportNode(node, relativePath, `console.${node.expression.name.getText()} call`);
  }

  if (
    ts.isStringLiteral(node) &&
    node.text.startsWith('/') &&
    !node.text.startsWith('/v1/')
  ) {
    literalRoutes.add(normalizeRoute(node.text));
  }

  ts.forEachChild(node, (child) => visit(child, relativePath));
}

function reportNode(node, relativePath, message) {
  const sourceFile = node.getSourceFile();
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  issues.push(`${relativePath}:${line + 1}: ${message}`);
}

function collectSourceFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

function collectRoutePatterns(appDirectory) {
  return collectSourceFiles(appDirectory)
    .filter((filePath) => {
      const fileName = path.basename(filePath);
      return fileName !== '_layout.tsx' && fileName !== '+not-found.tsx';
    })
    .map((filePath) => {
      const relativePath = path
        .relative(appDirectory, filePath)
        .replaceAll('\\', '/')
        .replace(/\.tsx?$/, '');
      const segments = relativePath
        .split('/')
        .filter((segment) => !/^\(.+\)$/.test(segment))
        .filter((segment) => segment !== 'index');
      const route = `/${segments.join('/')}`.replace(/\/$/, '') || '/';
      const expression = route
        .split('/')
        .map((segment) => (/^\[.+\]$/.test(segment) ? '[^/]+' : escapeRegExp(segment)))
        .join('/');

      return new RegExp(`^${expression}$`);
    });
}

function normalizeRoute(route) {
  const [pathname] = route.split(/[?#]/, 1);
  return pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
