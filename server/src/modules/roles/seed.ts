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
        'chat.send_text', 'chat.send_media', 'chat.send_links', 'chat.send_private_messages',
        'mod.kick.room', 'mod.mute.text.room', 'mod.mute.voice.room', 'mod.mute.both.room',
        'mod.ban.room', 'mod.delete_message', 'mod.assign_temp_permissions',
        'mod.kick.global', 'mod.mute.text.global', 'mod.mute.voice.global',
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
