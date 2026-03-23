import mongoose, { Schema, type Document } from 'mongoose'

export interface IMessage extends Document {
  roomId: mongoose.Types.ObjectId
  senderId: mongoose.Types.ObjectId | string
  senderName: string
  senderAvatar: string
  type: 'text' | 'system' | 'media'
  content: string
  metadata?: Record<string, unknown>
  status: 'visible' | 'deleted' | 'flagged' | 'shadow_hidden'
  createdAt: Date
}

const MessageSchema = new Schema<IMessage>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    senderId: { type: Schema.Types.Mixed, required: true },
    senderName: { type: String, required: true },
    senderAvatar: { type: String, default: '' },
    type: { type: String, enum: ['text', 'system', 'media'], default: 'text' },
    content: { type: String, required: true, maxlength: 2000 },
    metadata: Schema.Types.Mixed,
    status: { type: String, enum: ['visible', 'deleted', 'flagged', 'shadow_hidden'], default: 'visible' },
  },
  { timestamps: true },
)

MessageSchema.index({ roomId: 1, createdAt: -1 })
MessageSchema.index({ senderId: 1 })
MessageSchema.index({ status: 1 })

export const Message = mongoose.model<IMessage>('Message', MessageSchema)
