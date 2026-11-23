import crypto from 'node:crypto';

export interface SklandSignedHeaders {
  cred: string;
  sign: string;
  platform: string;
  timestamp: string;
  dId: string;
  vName: string;
  'User-Agent': string;
}

/**
 * Compute Skland (zonai.skland.com) HMAC-SHA256 + MD5 request signature headers.
 * Message format: path + queryOrBody + timestamp + JSON.stringify(headerCa)
 */
export function generateSklandHeaders(
  apiPath: string,
  queryOrBody: string,
  cred: string,
  signToken: string,
  dId: string = '',
  timestampOverride?: string
): SklandSignedHeaders {
  const timestamp = timestampOverride || (Math.floor(Date.now() / 1000) - 1).toString();
  const headerCa = {
    platform: '3',
    timestamp,
    dId: dId || '',
    vName: '1.0.0',
  };

  const signPayload = apiPath + queryOrBody + timestamp + JSON.stringify(headerCa);
  const hmacHex = crypto
    .createHmac('sha256', signToken)
    .update(signPayload)
    .digest('hex');
  const sign = crypto.createHash('md5').update(hmacHex).digest('hex');

  return {
    cred,
    sign,
    platform: headerCa.platform,
    timestamp,
    dId: headerCa.dId,
    vName: headerCa.vName,
    'User-Agent':
      'Skland/1.32.1 (com.hypergryph.skland; build:103201004; Android 33; ) Okhttp/4.11.0',
  };
}
