import mongoose, { Schema, type Document } from 'mongoose'

export interface IReport extends Document {
  messageId: mongoose.Types.ObjectId
  reporterId: mongoose.Types.ObjectId
  reason: 'spam' | 'abuse' | 'harassment' | 'other'
  details?: string
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned'
  reviewedBy?: mongoose.Types.ObjectId
  createdAt: Date
  reviewedAt?: Date
}

const ReportSchema = new Schema<IReport>(
  {
    messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: ['spam', 'abuse', 'harassment', 'other'], required: true },
    details: { type: String, maxlength: 500 },
    status: { type: String, enum: ['pending', 'reviewed', 'dismissed', 'actioned'], default: 'pending' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true },
)

ReportSchema.index({ status: 1, createdAt: -1 })
ReportSchema.index({ messageId: 1 })

export const Report = mongoose.model<IReport>('Report', ReportSchema)
