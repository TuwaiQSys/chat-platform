import mongoose, { Schema, type Document } from 'mongoose'

export interface IFingerprint extends Document {
  userId: mongoose.Types.ObjectId
  hash: string
  signals: {
    ip: string
    userAgent: string
    screenRes?: string
    timezone?: string
    language?: string
    platform?: string
    webglRenderer?: string
  }
  createdAt: Date
}

const FingerprintSchema = new Schema<IFingerprint>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hash: { type: String, required: true },
    signals: {
      ip: { type: String, required: true },
      userAgent: { type: String, default: '' },
      screenRes: String,
      timezone: String,
      language: String,
      platform: String,
      webglRenderer: String,
    },
  },
  { timestamps: true },
)

FingerprintSchema.index({ userId: 1 })
FingerprintSchema.index({ hash: 1 })

export const Fingerprint = mongoose.model<IFingerprint>('Fingerprint', FingerprintSchema)
