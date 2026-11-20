import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer, loadEnv } from 'vite-phone';
import { phonePreviewConfig } from './lib/phonePreviewConfig';

const env = { ...loadEnv('phone', process.cwd(), ''), ...process.env };
const authtoken = env.NGROK_AUTHTOKEN?.trim();
const domain = env.NGROK_DOMAIN?.trim();

async function startPhonePreview() {
  if (!authtoken || !domain) {
    throw new Error('Fill in NGROK_AUTHTOKEN and NGROK_DOMAIN in .env.phone.local first.');
  }
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(domain)) {
    throw new Error('NGROK_DOMAIN must be a hostname without https://, a port, or a path.');
  }

  const server = await createServer(phonePreviewConfig(domain));
  let tunnel: ChildProcess | undefined;
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    tunnel?.kill('SIGTERM');
    await server.close();
  };

  try {
    await server.listen();
    tunnel = spawn(
      'ngrok',
      [
        'http',
        'http://127.0.0.1:5173',
        '--url',
        `https://${domain}`,
        '--inspect=false',
        '--log=stdout',
        '--log-format=logfmt',
        '--log-level=warn',
      ],
      { env: { ...process.env, NGROK_AUTHTOKEN: authtoken }, stdio: 'inherit' }
    );
    tunnel.once('exit', (code) => {
      if (!closing) {
        process.exitCode = code || 1;
        void close();
      }
    });
    await once(tunnel, 'spawn');
  } catch (error) {
    await close();
    throw error;
  }

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void close().catch(() => process.exit(1));
    });
  }

  console.log(`Phone preview: https://${domain}`);
  console.log('Live reload is enabled. Press Ctrl+C to stop the preview and tunnel.');
}

startPhonePreview().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(authtoken ? message.replaceAll(authtoken, '[redacted]') : message);
  process.exit(1);
});
