import mongoose, { Schema, type Document } from 'mongoose'

// A DM thread between two users
export interface IDMThread extends Document {
  participants: [mongoose.Types.ObjectId, mongoose.Types.ObjectId]
  lastMessage: string
  lastMessageAt: Date
  createdAt: Date
  updatedAt: Date
}

const DMThreadSchema = new Schema<IDMThread>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

DMThreadSchema.index({ participants: 1 })
DMThreadSchema.index({ lastMessageAt: -1 })

export const DMThread = mongoose.model<IDMThread>('DMThread', DMThreadSchema)

// Individual DM message
export interface IDMMessage extends Document {
  threadId: mongoose.Types.ObjectId
  senderId: mongoose.Types.ObjectId
  content: string
  read: boolean
  createdAt: Date
}

const DMMessageSchema = new Schema<IDMMessage>(
  {
    threadId: { type: Schema.Types.ObjectId, ref: 'DMThread', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 500 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
)

DMMessageSchema.index({ threadId: 1, createdAt: -1 })
DMMessageSchema.index({ senderId: 1 })

export const DMMessage = mongoose.model<IDMMessage>('DMMessage', DMMessageSchema)

// Helper: find or create a thread between two users
export async function getOrCreateThread(userId1: string, userId2: string) {
  // Sort IDs to ensure consistent lookup
  const sorted = [userId1, userId2].sort()

  let thread = await DMThread.findOne({
    participants: { $all: sorted },
  })

  if (!thread) {
    thread = await DMThread.create({
      participants: sorted,
    })
  }

  return thread
}
