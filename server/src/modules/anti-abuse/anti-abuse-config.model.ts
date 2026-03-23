import mongoose, { Schema, type Document } from 'mongoose'

export interface IAntiAbuseConfig extends Document {
  globalFloodLimit: number
  globalFloodWindowSeconds: number
  globalSlowModeSeconds: number
  duplicateMessageWindow: number
  maxMessageLength: number
  spamScoreThreshold: number
  autoMuteOnSpam: boolean
  autoMuteDuration: number
  updatedAt: Date
}

const AntiAbuseConfigSchema = new Schema<IAntiAbuseConfig>(
  {
    globalFloodLimit: { type: Number, default: 10 },
    globalFloodWindowSeconds: { type: Number, default: 10 },
    globalSlowModeSeconds: { type: Number, default: 0 },
    duplicateMessageWindow: { type: Number, default: 30 },
    maxMessageLength: { type: Number, default: 500 },
    spamScoreThreshold: { type: Number, default: 5 },
    autoMuteOnSpam: { type: Boolean, default: true },
    autoMuteDuration: { type: Number, default: 5 },
  },
  { timestamps: true },
)

export const AntiAbuseConfig = mongoose.model<IAntiAbuseConfig>('AntiAbuseConfig', AntiAbuseConfigSchema)

// Singleton pattern — always one document
let cachedConfig: IAntiAbuseConfig | null = null

export async function getAntiAbuseConfig(): Promise<IAntiAbuseConfig> {
  if (cachedConfig) return cachedConfig
  let config = await AntiAbuseConfig.findOne()
  if (!config) {
    config = await AntiAbuseConfig.create({})
    console.log('Seeded default anti-abuse config')
  }
  cachedConfig = config
  return config
}

export function invalidateAntiAbuseCache() {
  cachedConfig = null
}

export async function updateAntiAbuseConfig(updates: Partial<IAntiAbuseConfig>) {
  const config = await getAntiAbuseConfig()
  Object.assign(config, updates)
  await config.save()
  cachedConfig = config
  return config
}
