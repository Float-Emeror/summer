import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

type SeedAccount = {
  enabled: boolean;
  emailVerified: boolean;
  email: string;
  studentNo: string;
  password: string;
  role: UserRole;
  nickname: string;
  college: string;
  grade: string;
  skills: string[];
  availability: Array<{ weekday: number; startTime: string; endTime: string }>;
  note?: string;
};

const fallbackAccounts: SeedAccount[] = [
  {
    enabled: true,
    emailVerified: true,
    email: 'testprofile@example.edu',
    studentNo: '20260001',
    password: 'TestProfile123!',
    role: UserRole.STUDENT,
    nickname: 'TestProfile',
    college: '计算机学院',
    grade: '2026级',
    skills: ['React', 'TypeScript', 'NestJS', '测试协作'],
    availability: [
      { weekday: 1, startTime: '19:00', endTime: '21:00' },
      { weekday: 3, startTime: '14:00', endTime: '16:00' },
      { weekday: 5, startTime: '20:00', endTime: '21:30' },
    ],
  },
  {
    enabled: true,
    emailVerified: true,
    email: 'admin@example.edu',
    studentNo: '20269999',
    password: 'AdminProfile123!',
    role: UserRole.ADMIN,
    nickname: 'TestAdmin',
    college: '平台管理组',
    grade: '管理员',
    skills: ['审核', '申诉处理'],
    availability: [{ weekday: 2, startTime: '10:00', endTime: '12:00' }],
  },
];

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

function parseTomlAccounts(content: string): SeedAccount[] {
  const accounts: SeedAccount[] = [];
  let current: Partial<SeedAccount> | null = null;
  let currentAvailability: Partial<SeedAccount['availability'][number]> | null = null;

  function finishAvailability() {
    if (!currentAvailability || !current) return;
    current.availability ??= [];
    current.availability.push({
      weekday: Number(currentAvailability.weekday ?? 1),
      startTime: String(currentAvailability.startTime ?? '14:00'),
      endTime: String(currentAvailability.endTime ?? '16:00'),
    });
    currentAvailability = null;
  }

  function finishAccount() {
    finishAvailability();
    if (!current) return;
    accounts.push(normalizeSeedAccount(current));
    current = null;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;

    if (line === '[[accounts]]') {
      finishAccount();
      current = { enabled: true, availability: [] };
      continue;
    }

    if (line === '[[accounts.availability]]') {
      if (!current) throw new Error('accounts.availability must appear after [[accounts]]');
      finishAvailability();
      currentAvailability = {};
      continue;
    }

    const match = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = parseTomlValue(rawValue);

    if (currentAvailability) {
      (currentAvailability as Record<string, unknown>)[key] = value;
    } else {
      if (!current) throw new Error(`TOML key appears before [[accounts]]: ${key}`);
      (current as unknown as Record<string, unknown>)[key] = value;
    }
  }

  finishAccount();
  return accounts;
}

function parseTomlValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => String(parseTomlValue(item.trim())));
  }
  return trimmed.replace(/^"|"$/g, '').replace(/\\"/g, '"');
}

function normalizeSeedAccount(account: Partial<SeedAccount>): SeedAccount {
  const enabled = account.enabled !== false;
  const emailVerified = account.emailVerified !== false;
  const role = String(account.role ?? 'STUDENT').toUpperCase();
  if (role !== 'STUDENT' && role !== 'ADMIN') {
    throw new Error(`Invalid account role for ${account.email}: ${role}`);
  }
  const requiredFields = enabled ? (['email', 'studentNo', 'password', 'nickname'] as const) : (['email', 'studentNo', 'nickname'] as const);
  for (const field of requiredFields) {
    if (!account[field]) {
      const accountLabel = account.email ? ` for ${account.email}` : '';
      if (field === 'password') {
        throw new Error(
          `Missing required account field: password${accountLabel}. ` +
            'cache/accounts.toml is a seed input file, so every enabled account must include a plaintext password. ' +
            'If this row was copied from cache/accounts.db.toml, add password or set enabled = false.',
        );
      }
      throw new Error(`Missing required account field: ${field}${accountLabel}`);
    }
  }

  return {
    enabled,
    emailVerified,
    email: String(account.email).trim().toLowerCase(),
    studentNo: String(account.studentNo).trim(),
    password: enabled ? String(account.password) : '',
    role: role as UserRole,
    nickname: String(account.nickname),
    college: String(account.college ?? ''),
    grade: String(account.grade ?? ''),
    skills: Array.isArray(account.skills) ? account.skills.map(String) : [],
    availability: account.availability ?? [],
    note: account.note,
  };
}

function loadSeedAccounts() {
  const root = resolve(__dirname, '../../..');
  const localPath = resolve(root, 'cache/accounts.toml');
  const examplePath = resolve(root, 'cache/accounts.example.toml');
  const selectedPath = existsSync(localPath) ? localPath : existsSync(examplePath) ? examplePath : '';

  if (!selectedPath) {
    console.log('No cache/accounts.toml or cache/accounts.example.toml found. Using built-in fallback accounts.');
    return fallbackAccounts;
  }

  console.log(`Loading seed accounts from ${selectedPath}`);
  const content = readFileSync(selectedPath, 'utf8');
  if (selectedPath === localPath && content.includes('Read-only database account snapshot')) {
    console.warn(
      'Warning: cache/accounts.toml looks like it was copied from cache/accounts.db.toml. ' +
        'That is OK for disabled comparison rows, but enabled seed accounts still need password.',
    );
  }
  return parseTomlAccounts(content);
}

loadEnvFile(resolve(__dirname, '../../.env'));
loadEnvFile(resolve(__dirname, '../../../.env'));

process.env.DATABASE_URL ??= 'mysql://campus:campus_password@localhost:3307/campus_team_platform';

const prisma = new PrismaClient();

async function ensureSeedAccount(account: SeedAccount) {
  if (!account.enabled) {
    console.log(`Skipped disabled seed account: ${account.email}`);
    return;
  }

  const userByEmail = await prisma.user.findUnique({ where: { email: account.email } });
  const userByStudentNo = await prisma.user.findUnique({ where: { studentNo: account.studentNo } });

  if (userByEmail && userByStudentNo && userByEmail.id !== userByStudentNo.id) {
    throw new Error(`Cannot seed ${account.email}: email and student number belong to different users.`);
  }

  const existingUser = userByEmail ?? userByStudentNo;
  const passwordHash = await bcrypt.hash(account.password, 10);
  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          email: account.email,
          studentNo: account.studentNo,
          passwordHash,
          role: account.role,
          status: 'ACTIVE',
          disabledAt: null,
          disabledReason: null,
          emailVerifiedAt: account.emailVerified ? new Date() : null,
        },
      })
    : await prisma.user.create({
        data: {
          email: account.email,
          studentNo: account.studentNo,
          passwordHash,
          role: account.role,
          status: 'ACTIVE',
          emailVerifiedAt: account.emailVerified ? new Date() : null,
        },
      });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      nickname: account.nickname,
      college: account.college,
      grade: account.grade,
      completeness: 82,
      skills: {
        set: [],
        connectOrCreate: account.skills.map((name) => ({ where: { name }, create: { name } })),
      },
    },
    create: {
      userId: user.id,
      nickname: account.nickname,
      college: account.college,
      grade: account.grade,
      completeness: 82,
      skills: {
        connectOrCreate: account.skills.map((name) => ({ where: { name }, create: { name } })),
      },
    },
  });

  await prisma.availabilitySlot.deleteMany({ where: { userId: user.id } });
  if (account.availability.length > 0) {
    await prisma.availabilitySlot.createMany({
      data: account.availability.map((slot) => ({ ...slot, userId: user.id })),
    });
  }

  console.log(`Prepared account: ${account.email} (${account.role}, email ${account.emailVerified ? 'verified' : 'unverified'})`);
}

async function main() {
  for (const account of loadSeedAccounts()) {
    await ensureSeedAccount(account);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
