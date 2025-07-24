import crypto from 'crypto';

export function verifySignature(
  secretKeyB64: string,
  orderId: string,
  paramsB64: string,
  receivedSignature: string
): boolean {
  try {
    const key = Buffer.from(secretKeyB64, 'base64');
    const iv = Buffer.alloc(8, 0);
    
    const cipher = crypto.createCipheriv('des-ede3-cbc', key, iv);
    cipher.setAutoPadding(false);
    const derivedKey = Buffer.concat([
      cipher.update(orderId.slice(0, 8).padEnd(8, '\0'), 'utf8'),
      cipher.final()
    ]);

    const expectedSignature = crypto
      .createHmac('sha256', derivedKey)
      .update(paramsB64)
      .digest('base64')
      .replace(/\//g, '_')
      .replace(/\+/g, '-');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}