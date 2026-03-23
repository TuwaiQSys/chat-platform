import mongoose, { Schema, type Document } from 'mongoose'

export interface IRole extends Document {
  name: string
  nameAr: string
  permissions: string[]
  priority: number
  isSystem: boolean
  visibility: 'visible' | 'hidden' | 'royal_hidden'
  color: string | null
  badge: string | null
  createdAt: Date
}

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true, trim: true, lowercase: true },
    nameAr: { type: String, required: true, trim: true },
    permissions: { type: [String], default: [] },
    priority: { type: Number, required: true, default: 0 },
    isSystem: { type: Boolean, default: false },
    visibility: { type: String, enum: ['visible', 'hidden', 'royal_hidden'], default: 'visible' },
    color: { type: String, default: null },
    badge: { type: String, default: null },
  },
  { timestamps: true },
)

RoleSchema.index({ priority: -1 })

export const Role = mongoose.model<IRole>('Role', RoleSchema)
