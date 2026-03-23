// All permission keys — the single source of truth.
// Roles store arrays of these strings. Nothing is hardcoded elsewhere.

export const PERMISSIONS = {
  // --- Visibility ---
  'view.hidden_users': 'رؤية المستخدمين المخفيين',
  'view.royal_hidden_users': 'رؤية المخفيين الملكيين',
  'be.hidden': 'الإخفاء عن المستخدمين العاديين',
  'be.royal_hidden': 'الإخفاء الملكي (لا يراك أحد إلا المسؤول الأعلى)',

  // --- Chat ---
  'chat.send_text': 'إرسال رسائل نصية',
  'chat.send_media': 'إرسال صور ووسائط',
  'chat.send_links': 'إرسال روابط',
  'chat.send_private_messages': 'إرسال رسائل خاصة',

  // --- Room ---
  'room.create': 'إنشاء غرفة',
  'room.edit': 'تعديل إعدادات الغرفة',
  'room.delete': 'حذف غرفة',
  'room.set_config': 'تغيير إعدادات الغرفة المتقدمة',

  // --- Moderation (room scope) ---
  'mod.kick.room': 'طرد من الغرفة',
  'mod.mute.text.room': 'كتم النص في الغرفة',
  'mod.mute.voice.room': 'كتم الصوت في الغرفة',
  'mod.mute.both.room': 'كتم النص والصوت في الغرفة',
  'mod.ban.room': 'حظر من الغرفة',
  'mod.delete_message': 'حذف الرسائل',
  'mod.assign_temp_permissions': 'منح صلاحيات مؤقتة في الغرفة',

  // --- Moderation (global scope) ---
  'mod.kick.global': 'طرد من الشات بالكامل',
  'mod.mute.text.global': 'كتم النص بالكامل',
  'mod.mute.voice.global': 'كتم الصوت بالكامل',
  'mod.ban.global': 'حظر من الشات بالكامل',
  'mod.ban.ip': 'حظر بالـ IP',
  'mod.ban.fingerprint': 'حظر ببصمة الجهاز',
  'mod.ban.layered': 'حظر متعدد الطبقات (IP + بصمة + جهاز)',

  // --- Admin ---
  'admin.manage_roles': 'إدارة الأدوار والصلاحيات',
  'admin.manage_users': 'إدارة المستخدمين',
  'admin.create_staff': 'إنشاء حسابات طاقم العمل',
  'admin.broadcast.room': 'بث رسالة في غرفة',
  'admin.broadcast.global': 'بث رسالة عامة',
  'admin.view_audit': 'عرض سجل العمليات',
  'admin.manage_plans': 'إدارة خطط العضوية',
  'admin.configure_antiabuse': 'إعدادات مكافحة الإساءة',
} as const

export type PermissionKey = keyof typeof PERMISSIONS
export const ALL_PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[]

// Grouped by category for the admin UI permission matrix
export const PERMISSION_CATEGORIES = {
  visibility: {
    nameAr: 'الرؤية والإخفاء',
    keys: ['view.hidden_users', 'view.royal_hidden_users', 'be.hidden', 'be.royal_hidden'] as PermissionKey[],
  },
  chat: {
    nameAr: 'الدردشة',
    keys: ['chat.send_text', 'chat.send_media', 'chat.send_links', 'chat.send_private_messages'] as PermissionKey[],
  },
  room: {
    nameAr: 'الغرف',
    keys: ['room.create', 'room.edit', 'room.delete', 'room.set_config'] as PermissionKey[],
  },
  mod_room: {
    nameAr: 'الإشراف (داخل الغرفة)',
    keys: ['mod.kick.room', 'mod.mute.text.room', 'mod.mute.voice.room', 'mod.mute.both.room', 'mod.ban.room', 'mod.delete_message', 'mod.assign_temp_permissions'] as PermissionKey[],
  },
  mod_global: {
    nameAr: 'الإشراف (شامل)',
    keys: ['mod.kick.global', 'mod.mute.text.global', 'mod.mute.voice.global', 'mod.ban.global', 'mod.ban.ip', 'mod.ban.fingerprint', 'mod.ban.layered'] as PermissionKey[],
  },
  admin: {
    nameAr: 'الإدارة',
    keys: ['admin.manage_roles', 'admin.manage_users', 'admin.create_staff', 'admin.broadcast.room', 'admin.broadcast.global', 'admin.view_audit', 'admin.manage_plans', 'admin.configure_antiabuse'] as PermissionKey[],
  },
}
