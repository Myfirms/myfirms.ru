// Temporary Let's Encrypt certificate for myfirms.ru + www.myfirms.ru (DNS-01, manual TXT records),
// to be imported into AWS ACM (us-east-1) until ACM issues one itself.
//
//   node scripts/le-cert.mjs start    creates account + order, prints the TXT records to add in DNS
//   node scripts/le-cert.mjs finish   validates the TXT records, issues the certificate, writes the files
//
// Everything secret (account key, certificate private key, order state) lives in
// ~/myfirms-certs — OUTSIDE the repository. Never copy those files into the repo.
// Renew: run `start` again about 30 days before expiry (re-import into the SAME ACM certificate).
import acme from 'acme-client';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import dns from 'node:dns/promises';

const DIR = join(homedir(), 'myfirms-certs');
const NAMES = ['myfirms.ru', 'www.myfirms.ru'];
const EMAIL = 'it@myfirms.ru';
const DIRECTORY = process.env.LE_STAGING ? acme.directory.letsencrypt.staging : acme.directory.letsencrypt.production;
const STATE = join(DIR, 'order-state.json');
const exists = (p) => access(p).then(() => true, () => false);

await mkdir(DIR, { recursive: true });
const accountKeyPath = join(DIR, 'account.key');
if (!(await exists(accountKeyPath))) await writeFile(accountKeyPath, await acme.crypto.createPrivateKey(), { mode: 0o600 });
const accountKey = await readFile(accountKeyPath);
const client = new acme.Client({ directoryUrl: DIRECTORY, accountKey });

const mode = process.argv[2];

if (mode === 'start') {
  // Creating/using the ACME account = agreeing to the Let's Encrypt Subscriber Agreement.
  await client.createAccount({ termsOfServiceAgreed: true, contact: [`mailto:${EMAIL}`] });
  const order = await client.createOrder({ identifiers: NAMES.map((value) => ({ type: 'dns', value })) });
  const authzs = await client.getAuthorizations(order);
  const records = [];
  for (const authz of authzs) {
    const challenge = authz.challenges.find((c) => c.type === 'dns-01');
    const value = await client.getChallengeKeyAuthorization(challenge);
    records.push({ name: `_acme-challenge.${authz.identifier.value}`, value, domain: authz.identifier.value });
  }
  await writeFile(STATE, JSON.stringify({ order, records, staging: !!process.env.LE_STAGING }, null, 2));
  console.log(`Add these TXT records (keep existing TXT records!):\n`);
  for (const r of records) console.log(`  name:  ${r.name}\n  type:  TXT\n  value: ${r.value}\n`);
  console.log(`State saved to ${STATE}. Then run: node scripts/le-cert.mjs finish`);
} else if (mode === 'finish') {
  const { order: savedOrder, records } = JSON.parse(await readFile(STATE, 'utf8'));
  // Sanity check the public DNS before asking Let's Encrypt to validate.
  for (const r of records) {
    let seen = [];
    try { seen = (await dns.resolveTxt(r.name)).map((p) => p.join('')); } catch { /* not there yet */ }
    if (!seen.includes(r.value)) {
      console.error(`TXT ${r.name} not visible yet (found: ${JSON.stringify(seen)}). Wait a few minutes and retry.`);
      process.exit(2);
    }
  }
  await client.createAccount({ termsOfServiceAgreed: true, contact: [`mailto:${EMAIL}`] }); // returns the existing account
  const order = await client.getOrder(savedOrder);
  const authzs = await client.getAuthorizations(order);
  for (const authz of authzs) {
    if (authz.status === 'valid') continue;
    const challenge = authz.challenges.find((c) => c.type === 'dns-01');
    await client.completeChallenge(challenge);
    await client.waitForValidStatus(challenge);
  }
  const [certKey, csr] = await acme.crypto.createCsr({ commonName: NAMES[0], altNames: NAMES });
  await client.finalizeOrder(order, csr);
  const fullchain = await client.getCertificate(order);
  const [leaf, ...rest] = fullchain.trim().split(/(?<=-----END CERTIFICATE-----)\s*/).filter(Boolean);
  const stamp = new Date().toISOString().slice(0, 10);
  await writeFile(join(DIR, `certificate-${stamp}.pem`), leaf + '\n');
  await writeFile(join(DIR, `chain-${stamp}.pem`), rest.join('\n') + '\n');
  await writeFile(join(DIR, `private-key-${stamp}.pem`), certKey, { mode: 0o600 });
  const info = acme.crypto.readCertificateInfo(leaf);
  console.log(`Issued for ${NAMES.join(', ')}; valid ${info.notBefore.toISOString()} → ${info.notAfter.toISOString()}`);
  console.log(`Files in ${DIR}: certificate-${stamp}.pem, chain-${stamp}.pem, private-key-${stamp}.pem`);
} else {
  console.error('usage: node scripts/le-cert.mjs start|finish   (LE_STAGING=1 for a dry run)');
  process.exit(1);
}
