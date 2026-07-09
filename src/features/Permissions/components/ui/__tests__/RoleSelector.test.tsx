// @vitest-environment jsdom
//
// src/features/Permissions/components/ui/__tests__/RoleSelector.test.tsx
//
// RoleSelector is the UI consumer of PermissionsService.getEligibleRoleTargets' output — this
// suite checks that eligibility data is correctly translated into disabled radios/tooltips,
// not that the eligibility data itself is correct (that's permissionEligibility.test.ts).
// Fully presentational, no services to mock — the simplest component in this feature to test.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoleSelector, { type RoleEligibility } from '../RoleSelector';
import type { Role } from '@/features/Permissions/services/permissionsService';

type Props = React.ComponentProps<typeof RoleSelector>;

function renderSelector(props: Partial<Props> = {}) {
  const onChange = vi.fn();
  render(<RoleSelector value="viewer" onChange={onChange} {...props} />);
  return { onChange };
}

const roleName = (role: string) => new RegExp(role, '');

describe('RoleSelector', () => {
  it('renders all four roles', () => {
    renderSelector();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
    expect(screen.getByText('Sharer')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('checks the radio matching the `value` prop', () => {
    renderSelector({ value: 'sharer' });
    expect(screen.getByRole('radio', { name: roleName('Sharer') })).toBeChecked();
    expect(screen.getByRole('radio', { name: roleName('Viewer') })).not.toBeChecked();
  });

  it('shows the "Current" badge only on the currentRole row', () => {
    renderSelector({ currentRole: 'administrator' });

    const adminRow = screen.getByRole('radio', { name: roleName('Administrator') }).closest('label');
    const viewerRow = screen.getByRole('radio', { name: roleName('Viewer') }).closest('label');

    expect(adminRow).toHaveTextContent('Current');
    expect(viewerRow).not.toHaveTextContent('Current');
  });

  it('disables a role the caller is not eligible for', () => {
    const eligibility: Record<Role, RoleEligibility> = {
      viewer: { enabled: true },
      sharer: { enabled: false, reason: 'Only owners can grant sharer' },
      administrator: { enabled: true },
      owner: { enabled: true },
    };
    renderSelector({ eligibility });

    expect(screen.getByRole('radio', { name: roleName('Sharer') })).toBeDisabled();
    expect(screen.getByRole('radio', { name: roleName('Viewer') })).not.toBeDisabled();
  });

  it('never disables the currentRole, even if eligibility says enabled: false for it', () => {
    const eligibility: Record<Role, RoleEligibility> = {
      viewer: { enabled: true },
      sharer: { enabled: false, reason: 'stale eligibility data' },
      administrator: { enabled: true },
      owner: { enabled: true },
    };
    renderSelector({ currentRole: 'sharer', eligibility });

    expect(screen.getByRole('radio', { name: roleName('Sharer') })).not.toBeDisabled();
  });

  it('disables nothing when eligibility is omitted entirely', () => {
    renderSelector();

    expect(screen.getByRole('radio', { name: roleName('Viewer') })).not.toBeDisabled();
    expect(screen.getByRole('radio', { name: roleName('Sharer') })).not.toBeDisabled();
    expect(screen.getByRole('radio', { name: roleName('Administrator') })).not.toBeDisabled();
    expect(screen.getByRole('radio', { name: roleName('Owner') })).not.toBeDisabled();
  });

  it('calls onChange with the role when an enabled option is clicked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelector();

    await user.click(screen.getByRole('radio', { name: roleName('Administrator') }));

    expect(onChange).toHaveBeenCalledWith('administrator');
  });

  it('does not call onChange when a disabled option is clicked', async () => {
    const user = userEvent.setup();
    const eligibility: Record<Role, RoleEligibility> = {
      viewer: { enabled: true },
      sharer: { enabled: false, reason: 'nope' },
      administrator: { enabled: true },
      owner: { enabled: true },
    };
    const { onChange } = renderSelector({ eligibility });

    await user.click(screen.getByRole('radio', { name: roleName('Sharer') }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
