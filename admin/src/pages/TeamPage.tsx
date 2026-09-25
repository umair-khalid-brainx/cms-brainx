import { useEffect, useState, type FormEvent } from 'react'
import { getSession } from '../lib/auth'
import { ApiError } from '../lib/api'
import {
  createInvite,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
  updateMemberRole,
  type CreatedInvite,
  type Invite,
  type Member,
} from '../lib/teamApi'
import { ASSIGNABLE_ROLE_OPTIONS, ROLE_LABELS, type Role } from '../lib/roles'
import Select from '../components/Select'
import './TeamPage.css'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' }

function TeamPage() {
  const currentUserId = getSession()?.user.id

  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [actionError, setActionError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('editor')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([listMembers(), listInvites()])
      .then(([m, i]) => {
        if (cancelled) return
        setMembers(m)
        setInvites(i)
        setLoad({ status: 'ready' })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoad({ status: 'error', message: error instanceof Error ? error.message : 'Failed to load team' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim()) return
    setInviting(true)
    setInviteError(null)
    setCreatedInvite(null)
    try {
      const invite = await createInvite(email.trim(), role)
      setInvites((prev) => [invite, ...prev])
      setCreatedInvite(invite)
      setEmail('')
      setCopied(false)
    } catch (error) {
      setInviteError(error instanceof ApiError ? error.message : 'Could not send this invite')
    } finally {
      setInviting(false)
    }
  }

  async function handleCopy() {
    if (!createdInvite) return
    try {
      await navigator.clipboard.writeText(createdInvite.acceptUrl)
      setCopied(true)
    } catch {
      // Clipboard permission can be denied — the link is already visible in
      // the input below, so this failing isn't fatal, just less convenient.
    }
  }

  async function handleRoleChange(member: Member, newRole: Role) {
    setActionError(null)
    try {
      const updated = await updateMemberRole(member.id, newRole)
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)))
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Could not update this member's role")
    }
  }

  async function handleRemove(member: Member) {
    if (!window.confirm(`Remove ${member.user.name} from this site?`)) return
    setActionError(null)
    try {
      await removeMember(member.id)
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Could not remove this member')
    }
  }

  async function handleRevoke(invite: Invite) {
    setActionError(null)
    try {
      await revokeInvite(invite.id)
      setInvites((prev) => prev.filter((i) => i.id !== invite.id))
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Could not revoke this invite')
    }
  }

  return (
    <>
      <div className="team-header">
        <h1 className="team-title">Team</h1>
      </div>

      {load.status === 'error' && <p className="team-error">{load.message}</p>}
      {load.status === 'loading' && <p className="team-loading">Loading…</p>}

      {load.status === 'ready' && (
        <div className="team-grid">
          <div className="team-col">
            <section className="team-card">
              <h2 className="team-card-title">Members</h2>
              {actionError ? <p className="team-error">{actionError}</p> : null}
              <table className="team-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="team-member-name">{member.user.name}</div>
                        <div className="team-member-email">{member.user.email}</div>
                      </td>
                      <td>
                        {member.role === 'owner' ? (
                          <span className="team-role-fixed">{ROLE_LABELS.owner}</span>
                        ) : (
                          <Select
                            className="team-role-select"
                            value={member.role}
                            options={ASSIGNABLE_ROLE_OPTIONS}
                            onChange={(newRole) => handleRoleChange(member, newRole)}
                          />
                        )}
                      </td>
                      <td className="team-row-actions">
                        <button
                          type="button"
                          className="team-row-remove"
                          disabled={member.role === 'owner' || member.userId === currentUserId}
                          title={member.role === 'owner' ? 'The owner cannot be removed' : undefined}
                          onClick={() => handleRemove(member)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="team-card">
              <h2 className="team-card-title">Pending Invites</h2>
              {invites.length === 0 ? (
                <p className="team-empty">No pending invites.</p>
              ) : (
                <table className="team-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Expires</th>
                      <th aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((invite) => (
                      <tr key={invite.id}>
                        <td>{invite.email}</td>
                        <td>{ROLE_LABELS[invite.role]}</td>
                        <td className="team-invite-expires">{new Date(invite.expiresAt).toLocaleDateString()}</td>
                        <td className="team-row-actions">
                          <button type="button" className="team-row-remove" onClick={() => handleRevoke(invite)}>
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <div className="team-col">
            <section className="team-card">
              <h2 className="team-card-title">Invite Someone</h2>
              <form className="team-invite-form" onSubmit={handleInvite}>
                <label htmlFor="invite-email">Email</label>
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={inviting}
                />

                <label htmlFor="invite-role">Role</label>
                <Select id="invite-role" value={role} options={ASSIGNABLE_ROLE_OPTIONS} onChange={setRole} disabled={inviting} />

                <button type="submit" className="team-invite-submit" disabled={inviting}>
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
              </form>

              {inviteError ? <p className="team-error">{inviteError}</p> : null}

              {createdInvite ? (
                <div className="team-invite-created">
                  <p>
                    Invite created for <strong>{createdInvite.email}</strong>. There&rsquo;s no email sending set
                    up — copy this link and send it to them yourself:
                  </p>
                  <div className="team-invite-link-row">
                    <input className="team-invite-link" readOnly value={createdInvite.acceptUrl} />
                    <button type="button" className="team-invite-copy" onClick={handleCopy}>
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      )}
    </>
  )
}

export default TeamPage
