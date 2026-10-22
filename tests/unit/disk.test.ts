import { describe, it, expect } from 'vitest';
import { diskStatus, freeDiskMb, DISK_WARN_MB } from '../../server/utils/disk';

describe('diskStatus', () => {
  it('норма при свободном месте', () => {
    expect(diskStatus(4096).status).toBe('ok');
    expect(diskStatus(4096).warning).toBeUndefined();
  });

  it('degraded, когда места мало', () => {
    const res = diskStatus(10);
    expect(res.status).toBe('degraded');
    expect(res.warning).toMatch(/free space below/);
  });

  it('порог проходит по краю', () => {
    // ровно порог - ещё норма, на байт меньше - уже нет
    expect(diskStatus(DISK_WARN_MB).status).toBe('ok');
    expect(diskStatus(DISK_WARN_MB - 1).status).toBe('degraded');
  });

  it('не измерили - ничего не утверждаем', () => {
    expect(diskStatus(null).status).toBe('ok');
    expect(diskStatus(null).warning).toBeUndefined();
  });

  it('порог настраивается', () => {
    expect(diskStatus(100, 50).status).toBe('ok');
    expect(diskStatus(10, 50).status).toBe('degraded');
  });
});

describe('freeDiskMb', () => {
  it('меряет реальный каталог', async () => {
    const free = await freeDiskMb(process.cwd());
    expect(free).not.toBeNull();
    expect(free!).toBeGreaterThan(0);
  });

  it('не падает на несуществующем пути', async () => {
    const free = await freeDiskMb('/definitely/not/here/xyz');
    expect(free).toBeNull();
  });
});
