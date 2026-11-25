/** The "invite this person to the client portal" choice offered when a PM starts work from a public inquiry. */
export function InviteClientOption({ email, checked, onChange, disabled = false }: {
  email: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean;
}) {
  return <label className="flex items-start gap-3 text-sm text-content">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} className="mt-1 accent-brand-500" />
    <span className="min-w-0">Email <span className="break-all font-medium">{email}</span> an invitation to the client portal
      <span className="mt-1 block text-xs text-content-muted">They see this project once they set a password. Until then they have no access.</span>
    </span>
  </label>;
}
