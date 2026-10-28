// Edge Add-ons API v1.1：上传草稿包 → 等待处理 → 提交发布。
// 需要环境变量 EDGE_PRODUCT_ID / EDGE_CLIENT_ID / EDGE_API_KEY。
import { readFile } from 'node:fs/promises';

const { EDGE_PRODUCT_ID: pid, EDGE_CLIENT_ID: cid, EDGE_API_KEY: key } = process.env;
const zip = process.argv[2] || 'margin.zip';
const base = `https://api.addons.microsoftedge.microsoft.com/v1/products/${pid}/submissions`;
const auth = { Authorization: `ApiKey ${key}`, 'X-ClientID': cid };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(url, label) {
  for (let i = 0; i < 40; i++) {
    await sleep(5000);
    const r = await fetch(url, { headers: auth });
    const j = await r.json().catch(() => ({}));
    if (j.status === 'Succeeded') return j;
    if (j.status === 'Failed') throw new Error(`${label} failed: ${JSON.stringify(j)}`);
  }
  throw new Error(`${label} timed out`);
}

const up = await fetch(`${base}/draft/package`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/zip' },
  body: await readFile(zip),
});
if (up.status !== 202) throw new Error(`upload ${up.status}: ${await up.text()}`);
await poll(`${base}/draft/package/operations/${up.headers.get('location')}`, 'upload');
console.log('package uploaded');

const pub = await fetch(base, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ notes: `Release ${process.env.GITHUB_REF_NAME || ''}`.trim() }),
});
if (pub.status !== 202) throw new Error(`publish ${pub.status}: ${await pub.text()}`);
await poll(`${base}/operations/${pub.headers.get('location')}`, 'publish');
console.log('submitted for review');
