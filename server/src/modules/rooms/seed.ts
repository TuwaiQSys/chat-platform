import { Room } from './room.model.js'

const DEFAULT_ROOMS = [
  { name: 'الغرفة العامة (1)', description: 'غرفة عامة للجميع', type: 'text' as const, config: { maxMembers: 40 }, featured: true },
  { name: 'الغرفة العامة (2)', description: 'غرفة عامة للجميع', type: 'text' as const, config: { maxMembers: 40 } },
  { name: 'الغرفة العامة (3)', description: 'غرفة عامة للجميع', type: 'text' as const, config: { maxMembers: 30 } },
  { name: 'استراحة', description: 'غرفة للاسترخاء والدردشة', type: 'text' as const, config: { maxMembers: 20 } },
  { name: 'قيمرز', description: 'غرفة الألعاب', type: 'text' as const, config: { maxMembers: 30 } },
]

export async function seedRooms() {
  const count = await Room.countDocuments()
  if (count > 0) return

  for (const r of DEFAULT_ROOMS) {
    await Room.create({
      name: r.name,
      description: r.description,
      type: r.type,
      createdBy: 'system',
      config: { ...r.config, slowModeSeconds: 0, allowMediaUpload: false, maxMessageLength: 500, linkPolicy: 'allow', wordBlocklist: [] },
      featured: r.featured ?? false,
    })
  }
  console.log(`Seeded ${DEFAULT_ROOMS.length} default rooms`)
}
