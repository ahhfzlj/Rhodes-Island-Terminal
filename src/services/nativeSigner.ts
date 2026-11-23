import CryptoJS from 'crypto-js';

export interface NativeSklandSignedHeaders {
  cred: string;
  sign: string;
  platform: string;
  timestamp: string;
  dId: string;
  vName: string;
  'User-Agent': string;
}

/**
 * Pure-JS Skland (zonai.skland.com) HMAC-SHA256 + MD5 request signature headers,
 * matching server/hypergryph/signer.ts byte-for-byte for on-device Android execution.
 */
export function generateNativeSklandHeaders(
  apiPath: string,
  queryOrBody: string,
  cred: string,
  signToken: string,
  dId: string = '',
  timestampOverride?: string
): NativeSklandSignedHeaders {
  const timestamp = timestampOverride || (Math.floor(Date.now() / 1000) - 1).toString();
  const headerCa = {
    platform: '3',
    timestamp,
    dId: dId || '',
    vName: '1.0.0',
  };

  const signPayload = apiPath + queryOrBody + timestamp + JSON.stringify(headerCa);
  const hmacHex = CryptoJS.HmacSHA256(signPayload, signToken).toString(
    CryptoJS.enc.Hex
  );
  const sign = CryptoJS.MD5(hmacHex).toString(CryptoJS.enc.Hex);

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
