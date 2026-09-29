import { createHash, createHmac } from 'node:crypto';
import https from 'node:https';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

const hash = value => createHash('sha256').update(value).digest('hex');
const sign = (key, value) => createHmac('sha256', key).update(value).digest();
const signingKey = (secret, date, region) => sign(sign(sign(sign(`AWS4${secret}`, date), region), 's3'), 'aws4_request');

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const { AWS_REGION: region, AWS_S3_BUCKET: bucket, AWS_ACCESS_KEY_ID: accessKey, AWS_SECRET_ACCESS_KEY: secret, AWS_S3_PREFIX: prefix = 'weekly-rough-work' } = process.env;
  if (!region || !bucket || !accessKey || !secret) return response.status(503).json({ error: 'S3 is not configured. Add the AWS variables in Vercel, then redeploy.' });
  const { fileName, pdfBase64 } = request.body || {};
  if (!fileName || !pdfBase64) return response.status(400).json({ error: 'A PDF file is required.' });
  const body = Buffer.from(pdfBase64, 'base64');
  if (!body.length || body.length > 7 * 1024 * 1024) return response.status(413).json({ error: 'The rough-work PDF must be smaller than 7 MB.' });
  const timestamp = new Date();
  const date = timestamp.toISOString().slice(0, 10).replaceAll('-', '');
  const amzDate = `${date}T${timestamp.toISOString().slice(11, 19).replaceAll(':', '')}Z`;
  const key = `${prefix.replace(/^\/+|\/+$/g, '')}/${date}/${fileName.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const payloadHash = hash(body);
  const canonicalHeaders = `content-type:application/pdf\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n/${key.split('/').map(encodeURIComponent).join('/')}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${date}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hash(canonicalRequest)}`;
  const signature = createHmac('sha256', signingKey(secret, date, region)).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const result = await new Promise(resolve => {
    const upload = https.request({ hostname: host, path: `/${key.split('/').map(encodeURIComponent).join('/')}`, method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'Content-Length': body.length, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, Authorization: authorization } }, uploadResponse => {
      const respChunks = [];
      uploadResponse.on('data', chunk => respChunks.push(chunk));
      uploadResponse.on('end', () => {
        const respBody = Buffer.concat(respChunks).toString('utf8');
        resolve({ status: uploadResponse.statusCode, key, body: respBody });
      });
    });
    upload.on('error', error => resolve({ error: error.message }));
    upload.end(body);
  });
  if (result.error || result.status < 200 || result.status >= 300) {
    let msg = 'S3 rejected the PDF upload.';
    if (result.body) {
      const codeMatch = result.body.match(/<Code>(.*?)<\/Code>/);
      const msgMatch = result.body.match(/<Message>(.*?)<\/Message>/);
      if (codeMatch && msgMatch) {
        msg = `S3 ${codeMatch[1]}: ${msgMatch[1]}`;
      } else if (msgMatch) {
        msg = `S3: ${msgMatch[1]}`;
      } else if (codeMatch) {
        msg = `S3: ${codeMatch[1]}`;
      }
    } else if (result.error) {
      msg = result.error;
    }
    return response.status(result.status && result.status >= 400 ? result.status : 502).json({ error: msg, code: result.status });
  }
  return response.status(200).json({ key: result.key });
}
