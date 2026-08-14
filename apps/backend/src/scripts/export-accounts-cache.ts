import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

function loadEnvFile(path: string) {
  try {
    const content = readFileSync(path, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch {
    // Optional local env file.
  }
}

function quoteToml(value: string | null | undefined) {
  return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function formatAccountSnapshot(accounts: Awaited<ReturnType<typeof readAccounts>>) {
  const lines = [
    '# Read-only database account snapshot.',
    '# Generated at service startup for comparison with cache/accounts.toml.',
    '# Password hashes and plaintext passwords are intentionally omitted.',
    '',
  ];

  for (const account of accounts) {
    lines.push('[[accounts]]');
    lines.push(`enabled = ${account.status === 'ACTIVE' ? 'true' : 'false'}`);
    lines.push(`email = ${quoteToml(account.email)}`);
    lines.push(`studentNo = ${quoteToml(account.studentNo)}`);
    lines.push(`role = ${quoteToml(account.role)}`);
    lines.push(`status = ${quoteToml(account.status)}`);
    lines.push(`nickname = ${quoteToml(account.profile?.nickname ?? '')}`);
    lines.push(`college = ${quoteToml(account.profile?.college ?? '')}`);
    lines.push(`grade = ${quoteToml(account.profile?.grade ?? '')}`);
    lines.push(`skills = [${(account.profile?.skills ?? []).map((skill) => quoteToml(skill.name)).join(', ')}]`);
    if (account.disabledReason) {
      lines.push(`disabledReason = ${quoteToml(account.disabledReason)}`);
    }
    lines.push(`note = ${quoteToml('Snapshot only. Edit cache/accounts.toml to seed or migrate accounts.')}`);

    for (const slot of account.availabilitySlots) {
      lines.push('');
      lines.push('[[accounts.availability]]');
      lines.push(`weekday = ${slot.weekday}`);
      lines.push(`startTime = ${quoteToml(slot.startTime)}`);
      lines.push(`endTime = ${quoteToml(slot.endTime)}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function readAccounts(prisma: PrismaClient) {
  return prisma.user.findMany({
    orderBy: [{ role: 'desc' }, { email: 'asc' }],
    include: {
      profile: {
        include: { skills: { orderBy: { name: 'asc' } } },
      },
      availabilitySlots: {
        orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
      },
    },
  });
}

loadEnvFile(resolve(__dirname, '../../.env'));
loadEnvFile(resolve(__dirname, '../../../.env'));

process.env.DATABASE_URL ??= 'mysql://campus:campus_password@localhost:3307/campus_team_platform';

const prisma = new PrismaClient();

async function main() {
  const root = resolve(__dirname, '../../..');
  const outputPath = resolve(root, 'cache/accounts.db.toml');
  const accounts = await readAccounts(prisma);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, formatAccountSnapshot(accounts), 'utf8');
  console.log(`Exported ${accounts.length} database accounts to ${outputPath}`);
  console.log('Compare this read-only snapshot with editable cache/accounts.toml before migrating accounts.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
