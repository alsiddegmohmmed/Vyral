import { PageHeader } from '@/components/shell/app-shell';
import { getOrg } from '@/lib/data/api';
import { requireOwner } from '@/lib/session';
import { OrgForm } from './org-form';
import { AccountActions } from './account-actions';

export default async function SettingsPage() {
  const ctx = await requireOwner();
  const org = await getOrg(ctx);
  return (
    <>
      <PageHeader title="Settings" description="Your business details appear on the back of every card." />
      <OrgForm org={org} />
      <AccountActions businessName={org.name} verified={org.emailVerified} />
    </>
  );
}
