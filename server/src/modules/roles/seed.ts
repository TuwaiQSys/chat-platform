import { Role } from './role.model.js'
import { ALL_PERMISSION_KEYS } from './permissions.js'

export async function seedRoles() {
  const count = await Role.countDocuments()
  if (count > 0) return

  const roles = [
    {
      name: 'super_admin',
      nameAr: 'المسؤول الأعلى',
      permissions: [...ALL_PERMISSION_KEYS],
      priority: 1000,
      isSystem: true,
      visibility: 'visible' as const,
      color: '#ef4444',
      badge: '👑',
    },
    {
      name: 'admin',
      nameAr: 'مسؤول',
      permissions: ALL_PERMISSION_KEYS.filter((k) => k !== 'be.royal_hidden'),
      priority: 900,
      isSystem: true,
      visibility: 'visible' as const,
      color: '#f59e0b',
      badge: '⭐',
    },
    {
      name: 'moderator',
      nameAr: 'مشرف',
      permissions: [
        'view.hidden_users',
        'chat.send_text', 'chat.send_media', 'chat.send_links', 'chat.send_private_messages', 'chat.use_colors', 'chat.use_emoji',
        'mod.kick.room', 'mod.kick.global',
        'mod.mute.text.room', 'mod.unmute.text.room', 'mod.mute.text.global', 'mod.unmute.text.global',
        'mod.mute.voice.room', 'mod.unmute.voice.room', 'mod.mute.both.room', 'mod.mute.voice.global', 'mod.unmute.voice.global',
        'mod.grant_speaking', 'mod.revoke_speaking',
        'mod.ban.room', 'mod.unban',
        'mod.timeout.room',
        'mod.delete_message', 'mod.hide_message',
        'mod.inspect_user', 'mod.inspect_punishments',
        'mod.assign_temp_permissions',
      ],
      priority: 500,
      isSystem: true,
      visibility: 'visible' as const,
      color: '#22c55e',
      badge: '🛡️',
    },
    {
      name: 'member',
      nameAr: 'عضو',
      permissions: [
        'chat.send_text', 'chat.send_links',
      ],
      priority: 100,
      isSystem: true,
      visibility: 'visible' as const,
      color: null,
      badge: null,
    },
    {
      name: 'guest',
      nameAr: 'زائر',
      permissions: [
        'chat.send_text',
      ],
      priority: 10,
      isSystem: true,
      visibility: 'visible' as const,
      color: null,
      badge: null,
    },
  ]

  await Role.insertMany(roles)
  console.log(`Seeded ${roles.length} default roles`)
}
