import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGO_URI

export let dbConnected = false

export async function connectDB() {
  try {
    if (MONGO_URI) {
      // Production: connect to real MongoDB
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
      console.log(`MongoDB connected: ${mongoose.connection.host}`)
    } else {
      // Development: use in-memory MongoDB
      const { MongoMemoryServer } = await import('mongodb-memory-server')
      const mongod = await MongoMemoryServer.create()
      const uri = mongod.getUri()
      await mongoose.connect(uri)
      console.log(`MongoDB Memory Server running: ${uri}`)
    }
    dbConnected = true
  } catch (err) {
    console.error('MongoDB connection error:', err)
    process.exit(1)
  }
}
