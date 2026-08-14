import { AiService } from './ai.service';

describe('AiService', () => {
  it('should treat a blank provider as missing and fall back safely', async () => {
    const prisma = {
      aiProject: { findFirst: jest.fn() },
      aiDocument: { create: jest.fn() },
      aiConversation: { create: jest.fn() },
      aiConfig: { findUnique: jest.fn() },
    };

    const config = { get: jest.fn(() => undefined) };
    const service = new AiService(prisma as any, config as any);

    const result = await (service as any).generateWithFallback('   ', 'prompt', 'fallback text');

    expect(result.mode).toBe('local-fallback');
    expect(result.fallbackReason).toBe('no_api_key');
    expect(result.fallbackDetail).toContain('provider=unknown');
    expect(result.content).toBe('fallback text');
  });
});
