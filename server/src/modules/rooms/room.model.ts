import mongoose, { Schema, type Document } from 'mongoose'

export interface IRoomConfig {
  maxMembers: number
  slowModeSeconds: number
  allowMediaUpload: boolean
  maxMessageLength: number
  linkPolicy: 'allow' | 'strip' | 'preview'
  wordBlocklist: string[]
}

export interface IRoom extends Document {
  name: string
  description: string
  type: 'text' | 'voice' | 'hybrid'
  createdBy: mongoose.Types.ObjectId | string
  config: IRoomConfig
  status: 'active' | 'archived' | 'deleted'
  featured: boolean
  coverImage?: string
  createdAt: Date
  updatedAt: Date
}

const RoomConfigSchema = new Schema<IRoomConfig>(
  {
    maxMembers: { type: Number, default: 40 },
    slowModeSeconds: { type: Number, default: 0 },
    allowMediaUpload: { type: Boolean, default: false },
    maxMessageLength: { type: Number, default: 500 },
    linkPolicy: { type: String, enum: ['allow', 'strip', 'preview'], default: 'allow' },
    wordBlocklist: { type: [String], default: [] },
  },
  { _id: false },
)

const RoomSchema = new Schema<IRoom>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['text', 'voice', 'hybrid'], default: 'text' },
    createdBy: { type: Schema.Types.Mixed, required: true },
    config: { type: RoomConfigSchema, default: () => ({}) },
    status: { type: String, enum: ['active', 'archived', 'deleted'], default: 'active' },
    featured: { type: Boolean, default: false },
    coverImage: String,
  },
  { timestamps: true },
)

RoomSchema.index({ status: 1 })

export const Room = mongoose.model<IRoom>('Room', RoomSchema)
