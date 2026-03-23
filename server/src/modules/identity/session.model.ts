import mongoose, { Schema, type Document } from 'mongoose'

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId
  socketId: string
  token: string
  fingerprintHash?: string
  ipAddress: string
  userAgent: string
  expiresAt: Date
  createdAt: Date
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    socketId: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    fingerprintHash: String,
    ipAddress: { type: String, required: true },
    userAgent: { type: String, default: '' },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true },
)

SessionSchema.index({ userId: 1 })
SessionSchema.index({ socketId: 1 })

export const Session = mongoose.model<ISession>('Session', SessionSchema)
