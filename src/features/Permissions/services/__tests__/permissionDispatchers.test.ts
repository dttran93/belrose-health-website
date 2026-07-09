// src/features/Permissions/services/__tests__/permissionDispatchers.test.ts
//
// Unit tests for the "unified" dispatcher methods — grantRole/removeRole/changeRole don't
// enforce any rules themselves, they just route to the already-tested grant*/remove*
// methods. So these tests use vi.spyOn against the real methods on the same class rather
// than the orchestration harness — no Firestore emulator or blockchain mocks needed, since
// the only thing worth checking is "did it delegate to the right method with the right args."

import { describe, it, expect, vi, afterEach } from 'vitest';
import { PermissionsService } from '../permissionsService';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PermissionsService.grantRole (dispatcher)', () => {
  it('routes viewer to grantViewer', async () => {
    const spy = vi.spyOn(PermissionsService, 'grantViewer').mockResolvedValue(undefined);
    await PermissionsService.grantRole('rec1', 'user1', 'viewer', 'Title');
    expect(spy).toHaveBeenCalledWith('rec1', 'user1', 'Title');
  });

  it('routes sharer to grantSharer', async () => {
    const spy = vi.spyOn(PermissionsService, 'grantSharer').mockResolvedValue(undefined);
    await PermissionsService.grantRole('rec1', 'user1', 'sharer');
    expect(spy).toHaveBeenCalledWith('rec1', 'user1', undefined);
  });

  it('routes administrator to grantAdmin', async () => {
    const spy = vi.spyOn(PermissionsService, 'grantAdmin').mockResolvedValue(undefined);
    await PermissionsService.grantRole('rec1', 'user1', 'administrator');
    expect(spy).toHaveBeenCalledWith('rec1', 'user1', undefined);
  });

  it('routes owner to grantOwner', async () => {
    const spy = vi.spyOn(PermissionsService, 'grantOwner').mockResolvedValue(undefined);
    await PermissionsService.grantRole('rec1', 'user1', 'owner');
    expect(spy).toHaveBeenCalledWith('rec1', 'user1', undefined);
  });
});

describe('PermissionsService.removeRole (dispatcher)', () => {
  it('routes viewer to removeViewer', async () => {
    const spy = vi.spyOn(PermissionsService, 'removeViewer').mockResolvedValue(undefined);
    await PermissionsService.removeRole('rec1', 'user1', 'viewer');
    expect(spy).toHaveBeenCalledWith('rec1', 'user1');
  });

  it('routes sharer to removeSharer', async () => {
    const spy = vi.spyOn(PermissionsService, 'removeSharer').mockResolvedValue(undefined);
    await PermissionsService.removeRole('rec1', 'user1', 'sharer');
    expect(spy).toHaveBeenCalledWith('rec1', 'user1');
  });

  it('routes administrator to removeAdmin', async () => {
    const spy = vi.spyOn(PermissionsService, 'removeAdmin').mockResolvedValue(undefined);
    await PermissionsService.removeRole('rec1', 'user1', 'administrator');
    expect(spy).toHaveBeenCalledWith('rec1', 'user1');
  });

  it('routes owner to removeOwner', async () => {
    const spy = vi.spyOn(PermissionsService, 'removeOwner').mockResolvedValue(undefined);
    await PermissionsService.removeRole('rec1', 'user1', 'owner');
    expect(spy).toHaveBeenCalledWith('rec1', 'user1');
  });
});

describe('PermissionsService.changeRole', () => {
  it('does nothing when newRole equals currentRole', async () => {
    const grantSpy = vi.spyOn(PermissionsService, 'grantRole').mockResolvedValue(undefined);
    await PermissionsService.changeRole('rec1', 'user1', 'sharer', 'sharer');
    expect(grantSpy).not.toHaveBeenCalled();
  });

  it('routes an upgrade through grantRole', async () => {
    const grantSpy = vi.spyOn(PermissionsService, 'grantRole').mockResolvedValue(undefined);
    await PermissionsService.changeRole('rec1', 'user1', 'viewer', 'administrator', 'Title');
    expect(grantSpy).toHaveBeenCalledWith('rec1', 'user1', 'administrator', 'Title');
  });

  it('demotes an owner via removeOwner with demoteTo', async () => {
    const spy = vi.spyOn(PermissionsService, 'removeOwner').mockResolvedValue(undefined);
    await PermissionsService.changeRole('rec1', 'user1', 'owner', 'sharer', 'Title');
    expect(spy).toHaveBeenCalledWith('rec1', 'user1', 'Title', { demoteTo: 'sharer' });
  });

  it('demotes an administrator via removeAdmin with demoteTo', async () => {
    const spy = vi.spyOn(PermissionsService, 'removeAdmin').mockResolvedValue(undefined);
    await PermissionsService.changeRole('rec1', 'user1', 'administrator', 'viewer', 'Title');
    expect(spy).toHaveBeenCalledWith('rec1', 'user1', 'Title', { demoteTo: 'viewer' });
  });

  it('demotes a sharer via removeSharer with demoteToViewer — the only valid target below sharer', async () => {
    const spy = vi.spyOn(PermissionsService, 'removeSharer').mockResolvedValue(undefined);
    await PermissionsService.changeRole('rec1', 'user1', 'sharer', 'viewer', 'Title');
    expect(spy).toHaveBeenCalledWith('rec1', 'user1', 'Title', { demoteToViewer: true });
  });

  it('defensive: throws for an unrecognised currentRole (unreachable via real typed callers — viewer is the floor, so any other role is always an upgrade)', async () => {
    await expect(
      PermissionsService.changeRole('rec1', 'user1', 'bogus-role' as any, 'sharer', 'Title')
    ).rejects.toThrow('Cannot downgrade from bogus-role');
  });
});
