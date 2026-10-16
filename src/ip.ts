export function getClientIp(req: any): string {
  if (!req) return '127.0.0.1';

  if (typeof req.ip === 'string' && req.ip.length > 0) {
    return cleanIp(req.ip);
  }

  const headers = req.headers || {};

  const cfIp = headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cleanIp(cfIp);
  }

  const xForwardedFor = headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
    const first = xForwardedFor.split(',')[0].trim();
    if (first) return cleanIp(first);
  }

  const xRealIp = headers['x-real-ip'];
  if (typeof xRealIp === 'string' && xRealIp.trim()) {
    return cleanIp(xRealIp);
  }

  const trueClientIp = headers['true-client-ip'];
  if (typeof trueClientIp === 'string' && trueClientIp.trim()) {
    return cleanIp(trueClientIp);
  }

  const socketIp =
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    req.info?.remoteAddress;

  if (typeof socketIp === 'string' && socketIp.trim()) {
    return cleanIp(socketIp);
  }

  return '127.0.0.1';
}

function cleanIp(ip: string): string {
  if (ip.startsWith('::ffff:')) {
    return ip.slice(7);
  }
  return ip.trim();
}
