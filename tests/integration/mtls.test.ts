import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MtlsGatewayVerifier } from '../../src/api/gateway/mtls_verifier.js';
import { PrismaClient } from '@prisma/client';
import { closeRedis } from '../../src/database/redis.js';
import Fastify from 'fastify';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('mTLS Gateway Verifier Integration', () => {
  let verifier: MtlsGatewayVerifier;
  const prisma = new PrismaClient();
  const ocspApp = Fastify();
  let ocspStatus = 'GOOD';

  beforeAll(async () => {
    // Start mock OCSP server
    ocspApp.post('/ocsp', async () => {
      await Promise.resolve();
      return ocspStatus;
    });
    await ocspApp.listen({ port: 8080, host: '127.0.0.1' });

    // Ensure test certificates exist in DB
    await prisma.hardwareCertificate.upsert({
      where: { serial: '12345678' },
      update: { revoked: false },
      create: { serial: '12345678', model: 'TEST-A', batch: 'B1' },
    });

    await prisma.hardwareCertificate.upsert({
      where: { serial: '87654321' },
      update: { revoked: true },
      create: { serial: '87654321', model: 'TEST-B', batch: 'B1', revoked: true },
    });

    verifier = new MtlsGatewayVerifier();
    // Allow verifier to connect DB
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    await verifier.close();
    await prisma.hardwareCertificate.deleteMany({
      where: { serial: { in: ['12345678', '87654321'] } },
    });
    await prisma.$disconnect();
    await ocspApp.close();
    await closeRedis();
  });

  function generateCert(serialHex: string): string {
    const tmpDir = os.tmpdir();
    const extFile = path.join(tmpDir, `ext-${serialHex}.ext`);
    const crtFile = path.join(tmpDir, `cert-${serialHex}.crt`);
    const keyFile = path.join(tmpDir, `key-${serialHex}.key`);

    fs.writeFileSync(extFile, `authorityInfoAccess = OCSP;URI:http://localhost:8080/ocsp\n`);

    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout ${keyFile} -out ${crtFile} -days 365 -nodes -subj "/CN=TestDevice" -set_serial 0x${serialHex} -extfile ${extFile}`,
    );

    const cert = fs.readFileSync(crtFile, 'utf-8');
    fs.unlinkSync(keyFile);
    fs.unlinkSync(crtFile);
    fs.unlinkSync(extFile);
    return cert;
  }

  it('should verify a valid certificate against the database and OCSP', async () => {
    ocspStatus = 'GOOD';
    const certStr = generateCert('12345678');
    const result = await verifier.verifyConnection(certStr);

    expect(result.verified).toBe(true);
    expect(result.serialNumber).toBe('12345678'); // Node trims leading zeroes, so 12345678 hex matches
  });

  it('should reject a certificate that is revoked in the database', async () => {
    ocspStatus = 'GOOD';
    const certStr = generateCert('87654321');
    const result = await verifier.verifyConnection(certStr);

    expect(result.verified).toBe(false);
    expect(result.reason).toContain('revoked');
  });

  it('should reject a certificate if OCSP returns REVOKED', async () => {
    ocspStatus = 'REVOKED';
    const certStr = generateCert('12345678');
    const result = await verifier.verifyConnection(certStr);

    expect(result.verified).toBe(false);
    expect(result.reason).toContain('OCSP');
  });
});
