import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const requestedRoot = process.argv[2] ?? 'dist';
const root = isAbsolute(requestedRoot)
  ? requestedRoot
  : resolve(projectRoot, requestedRoot);
const host = process.env.HOST?.trim() || '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '8085', 10);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const indexPath = join(root, 'index.html');
if (!existsSync(indexPath)) {
  throw new Error(`Production export not found at ${indexPath}. Run npm run build first.`);
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.webp', 'image/webp'],
]);

function assetPath(requestUrl) {
  const pathname = decodeURIComponent(
    new URL(requestUrl ?? '/', `http://${host}:${port}`).pathname,
  );
  const candidate = resolve(root, `.${pathname}`);
  const candidateRelativePath = relative(root, candidate);
  const insideRoot =
    candidateRelativePath !== '..' &&
    !candidateRelativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) &&
    !isAbsolute(candidateRelativePath);

  if (
    insideRoot &&
    existsSync(candidate) &&
    !statSync(candidate).isDirectory()
  ) {
    return candidate;
  }

  return indexPath;
}

const server = createServer((request, response) => {
  const filePath = assetPath(request.url);
  response.setHeader(
    'Content-Type',
    contentTypes.get(extname(filePath)) ?? 'application/octet-stream',
  );
  response.setHeader('Cache-Control', 'no-store');
  createReadStream(filePath)
    .on('error', () => {
      if (!response.headersSent) response.writeHead(500);
      response.end('Unable to read the requested preview asset.');
    })
    .pipe(response);
});

server.listen(port, host, () => {
  console.log(`GoGymGo member preview: http://${host}:${port}`);
});
