import mongoose, { Schema, type Document } from 'mongoose'

// Global chat configuration — singleton, admin-editable
export interface IChatConfig extends Document {
  // Message background colors (hex) per type
  messageColors: {
    normal: string           // normal user messages
    system: string           // join/leave/system messages
    admin: string            // admin/mod announcements
    broadcast: string        // broadcast messages
    private: string          // private message bubbles
  }
  // Text shortcuts (h1→hello, b1→brb, etc.)
  shortcuts: Array<{ code: string; text: string }>
  // Bad word filter
  wordFilter: {
    enabled: boolean
    words: string[]
    action: 'block' | 'replace' | 'flag'  // block message, replace with ***, or flag for review
    replacement: string
  }
  // Custom emoji (uploaded by admin)
  customEmoji: Array<{ code: string; name: string; url: string }>
  updatedAt: Date
}

const ChatConfigSchema = new Schema<IChatConfig>(
  {
    messageColors: {
      normal: { type: String, default: '#fefce8' },    // light yellow
      system: { type: String, default: '#dbeafe' },    // light blue
      admin: { type: String, default: '#fce7f3' },     // light pink
      broadcast: { type: String, default: '#dcfce7' }, // light green
      private: { type: String, default: '#f3e8ff' },   // light purple
    },
    shortcuts: [{
      code: { type: String, required: true },
      text: { type: String, required: true },
      _id: false,
    }],
    wordFilter: {
      enabled: { type: Boolean, default: true },
      words: { type: [String], default: [] },
      action: { type: String, enum: ['block', 'replace', 'flag'], default: 'replace' },
      replacement: { type: String, default: '***' },
    },
    customEmoji: [{
      code: { type: String, required: true },
      name: { type: String, required: true },
      url: { type: String, required: true },
      _id: false,
    }],
  },
  { timestamps: true },
)

export const ChatConfig = mongoose.model<IChatConfig>('ChatConfig', ChatConfigSchema)

// Singleton cache
let cachedConfig: IChatConfig | null = null

export async function getChatConfig(): Promise<IChatConfig> {
  if (cachedConfig) return cachedConfig
  let config = await ChatConfig.findOne()
  if (!config) {
    config = await ChatConfig.create({
      shortcuts: [
        { code: 'h1', text: 'مرحبا بالجميع' },
        { code: 'b1', text: 'أرجع بعد شوي' },
        { code: 's1', text: 'السلام عليكم' },
      ],
    })
    console.log('Seeded default chat config')
  }
  cachedConfig = config
  return config
}

export function invalidateChatConfigCache() {
  cachedConfig = null
}

export async function updateChatConfig(updates: Partial<IChatConfig>) {
  const config = await getChatConfig()
  Object.assign(config, updates)
  await config.save()
  cachedConfig = config
  return config
}
