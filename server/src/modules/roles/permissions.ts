// Complete permission catalog — 70+ keys for a full community chat system.
// Roles store arrays of these strings. Nothing is hardcoded elsewhere.

export const PERMISSIONS = {
  // --- Visibility ---
  'view.hidden_users': 'رؤية المستخدمين المخفيين',
  'view.royal_hidden_users': 'رؤية المخفيين الملكيين',
  'be.hidden': 'الإخفاء عن المستخدمين العاديين',
  'be.royal_hidden': 'الإخفاء الملكي',

  // --- Chat ---
  'chat.send_text': 'إرسال رسائل نصية',
  'chat.send_media': 'إرسال صور ووسائط',
  'chat.send_links': 'إرسال روابط',
  'chat.send_private_messages': 'إرسال رسائل خاصة',
  'chat.use_colors': 'استخدام ألوان في الرسائل',
  'chat.use_emoji': 'استخدام إيموجي مخصصة',

  // --- Room Management ---
  'room.create': 'إنشاء غرفة',
  'room.edit': 'تعديل إعدادات الغرفة',
  'room.delete': 'حذف غرفة',
  'room.lock': 'قفل الغرفة',
  'room.set_type': 'تغيير نوع الغرفة',
  'room.set_max_users': 'تغيير الحد الأقصى للمستخدمين',
  'room.set_config': 'تغيير إعدادات الغرفة المتقدمة',
  'room.allow_guests': 'السماح للزوار بالدخول',
  'room.restrict_entry': 'تقييد الدخول بالأدوار',

  // --- Text Moderation (Room) ---
  'mod.mute.text.room': 'كتم النص في الغرفة',
  'mod.unmute.text.room': 'إلغاء كتم النص في الغرفة',
  'mod.mute.text.room.permanent': 'كتم النص دائم في الغرفة',

  // --- Text Moderation (Global) ---
  'mod.mute.text.global': 'كتم النص بالكامل',
  'mod.unmute.text.global': 'إلغاء كتم النص بالكامل',

  // --- Voice Moderation (Room) ---
  'mod.mute.voice.room': 'كتم الصوت في الغرفة',
  'mod.unmute.voice.room': 'إلغاء كتم الصوت في الغرفة',
  'mod.mute.both.room': 'كتم النص والصوت في الغرفة',
  'mod.grant_speaking': 'منح صلاحية التحدث',
  'mod.revoke_speaking': 'سحب صلاحية التحدث',

  // --- Voice Moderation (Global) ---
  'mod.mute.voice.global': 'كتم الصوت بالكامل',
  'mod.unmute.voice.global': 'إلغاء كتم الصوت بالكامل',

  // --- Kick ---
  'mod.kick.room': 'طرد من الغرفة',
  'mod.kick.global': 'طرد من الشات بالكامل',

  // --- Ban ---
  'mod.ban.room': 'حظر من الغرفة',
  'mod.ban.global': 'حظر من الشات بالكامل',
  'mod.ban.ip': 'حظر بالـ IP',
  'mod.ban.fingerprint': 'حظر ببصمة الجهاز',
  'mod.ban.layered': 'حظر متعدد الطبقات (IP + بصمة + جهاز)',
  'mod.unban': 'إلغاء الحظر',

  // --- Timeout / Shadow ---
  'mod.timeout.room': 'تعليق مؤقت في الغرفة',
  'mod.timeout.global': 'تعليق مؤقت شامل',
  'mod.shadow.room': 'حظر خفي في الغرفة',
  'mod.shadow.global': 'حظر خفي شامل',

  // --- Message Actions ---
  'mod.delete_message': 'حذف الرسائل',
  'mod.hide_message': 'إخفاء الرسائل',
  'mod.clear_messages.room': 'مسح جميع رسائل الغرفة',
  'mod.assign_temp_permissions': 'منح صلاحيات مؤقتة في الغرفة',

  // --- Inspection ---
  'mod.inspect_user': 'فحص معلومات المستخدم',
  'mod.inspect_ip': 'فحص عنوان الـ IP',
  'mod.inspect_punishments': 'فحص العقوبات النشطة',
  'mod.inspect_history': 'فحص سجل الإجراءات',

  // --- User Visual ---
  'user.assign_color': 'تعيين لون للمستخدم',
  'user.assign_badge': 'تعيين شارة للمستخدم',
  'user.assign_temp_power': 'منح صلاحية مؤقتة',
  'user.assign_perm_power': 'منح صلاحية دائمة',

  // --- Admin ---
  'admin.manage_roles': 'إدارة الأدوار والصلاحيات',
  'admin.manage_users': 'إدارة المستخدمين',
  'admin.create_staff': 'إنشاء حسابات طاقم العمل',
  'admin.broadcast.room': 'بث رسالة في غرفة',
  'admin.broadcast.global': 'بث رسالة عامة',
  'admin.view_audit': 'عرض سجل العمليات',
  'admin.manage_plans': 'إدارة خطط العضوية',
  'admin.configure_antiabuse': 'إعدادات مكافحة الإساءة',
  'admin.manage_shortcuts': 'إدارة الاختصارات',
  'admin.manage_emoji': 'إدارة الإيموجي المخصصة',
  'admin.manage_avatars': 'إدارة الصور الرمزية',
  'admin.clear_room': 'مسح محتوى الغرفة',
  'admin.lock_room': 'قفل/فتح الغرفة',
  'admin.manage_word_filter': 'إدارة فلتر الكلمات',

  // --- PM ---
  'chat.restrict_pm': 'تقييد الرسائل الخاصة للمستخدم',
  'chat.open_pm': 'فتح الرسائل الخاصة المقيدة',
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
    keys: ['chat.send_text', 'chat.send_media', 'chat.send_links', 'chat.send_private_messages', 'chat.use_colors', 'chat.use_emoji'] as PermissionKey[],
  },
  room: {
    nameAr: 'إدارة الغرف',
    keys: ['room.create', 'room.edit', 'room.delete', 'room.lock', 'room.set_type', 'room.set_max_users', 'room.set_config', 'room.allow_guests', 'room.restrict_entry'] as PermissionKey[],
  },
  mod_text: {
    nameAr: 'كتم النص',
    keys: ['mod.mute.text.room', 'mod.unmute.text.room', 'mod.mute.text.room.permanent', 'mod.mute.text.global', 'mod.unmute.text.global'] as PermissionKey[],
  },
  mod_voice: {
    nameAr: 'كتم الصوت',
    keys: ['mod.mute.voice.room', 'mod.unmute.voice.room', 'mod.mute.both.room', 'mod.grant_speaking', 'mod.revoke_speaking', 'mod.mute.voice.global', 'mod.unmute.voice.global'] as PermissionKey[],
  },
  mod_kick: {
    nameAr: 'الطرد',
    keys: ['mod.kick.room', 'mod.kick.global'] as PermissionKey[],
  },
  mod_ban: {
    nameAr: 'الحظر',
    keys: ['mod.ban.room', 'mod.ban.global', 'mod.ban.ip', 'mod.ban.fingerprint', 'mod.ban.layered', 'mod.unban'] as PermissionKey[],
  },
  mod_special: {
    nameAr: 'إجراءات خاصة',
    keys: ['mod.timeout.room', 'mod.timeout.global', 'mod.shadow.room', 'mod.shadow.global'] as PermissionKey[],
  },
  mod_messages: {
    nameAr: 'إدارة الرسائل',
    keys: ['mod.delete_message', 'mod.hide_message', 'mod.clear_messages.room', 'mod.assign_temp_permissions'] as PermissionKey[],
  },
  mod_inspect: {
    nameAr: 'الفحص والتفتيش',
    keys: ['mod.inspect_user', 'mod.inspect_ip', 'mod.inspect_punishments', 'mod.inspect_history'] as PermissionKey[],
  },
  user_visual: {
    nameAr: 'المظهر والصلاحيات',
    keys: ['user.assign_color', 'user.assign_badge', 'user.assign_temp_power', 'user.assign_perm_power'] as PermissionKey[],
  },
  admin: {
    nameAr: 'الإدارة',
    keys: [
      'admin.manage_roles', 'admin.manage_users', 'admin.create_staff',
      'admin.broadcast.room', 'admin.broadcast.global', 'admin.view_audit',
      'admin.manage_plans', 'admin.configure_antiabuse', 'admin.manage_shortcuts',
      'admin.manage_emoji', 'admin.manage_avatars', 'admin.clear_room',
      'admin.lock_room', 'admin.manage_word_filter',
    ] as PermissionKey[],
  },
  pm: {
    nameAr: 'الرسائل الخاصة',
    keys: ['chat.restrict_pm', 'chat.open_pm'] as PermissionKey[],
  },
}
