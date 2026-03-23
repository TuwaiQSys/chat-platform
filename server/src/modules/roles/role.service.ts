import { Role } from './role.model.js'
import { User } from '../identity/user.model.js'

// In-memory permission cache (userId → { permissions, highestPriority, expiry })
const cache = new Map<string, { permissions: string[]; highestPriority: number; expiry: number }>()
const CACHE_TTL = 30_000 // 30 seconds

export async function getUserPermissions(userId: string): Promise<string[]> {
  const cached = cache.get(userId)
  if (cached && cached.expiry > Date.now()) return cached.permissions

  const user = await User.findById(userId).populate('roles')
  if (!user) return []

  const roles = (user.roles || []) as any[]
  const permSet = new Set<string>()
  let highestPriority = 0

  for (const role of roles) {
    if (!role?.permissions) continue
    for (const p of role.permissions) permSet.add(p)
    if (role.priority > highestPriority) highestPriority = role.priority
  }

  const permissions = Array.from(permSet)
  cache.set(userId, { permissions, highestPriority, expiry: Date.now() + CACHE_TTL })
  return permissions
}

export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const perms = await getUserPermissions(userId)
  return perms.includes(permission)
}

export async function hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
  const perms = await getUserPermissions(userId)
  return permissions.some((p) => perms.includes(p))
}

export async function getHighestPriority(userId: string): Promise<number> {
  const cached = cache.get(userId)
  if (cached && cached.expiry > Date.now()) return cached.highestPriority

  await getUserPermissions(userId) // populates cache
  return cache.get(userId)?.highestPriority ?? 0
}

export async function canModerateUser(actorId: string, targetId: string): Promise<boolean> {
  if (actorId === targetId) return false
  const actorPriority = await getHighestPriority(actorId)
  const targetPriority = await getHighestPriority(targetId)
  return actorPriority > targetPriority
}

export function invalidateCache(userId: string): void {
  cache.delete(userId)
}

export function invalidateAllCache(): void {
  cache.clear()
}

// Get user's display info from their highest-priority role
export async function getUserRoleDisplay(userId: string): Promise<{
  color: string | null
  badge: string | null
  visibility: string
  roleName: string | null
}> {
  const user = await User.findById(userId).populate('roles')
  if (!user) return { color: null, badge: null, visibility: 'visible', roleName: null }

  const roles = (user.roles || []) as any[]
  let best = { color: null as string | null, badge: null as string | null, roleName: null as string | null, priority: -1 }

  for (const role of roles) {
    if (!role) continue
    if (role.priority > best.priority) {
      best = { color: role.color, badge: role.badge, roleName: role.nameAr, priority: role.priority }
    }
  }

  return { ...best, visibility: user.visibility || 'visible' }
}
