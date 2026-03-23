import { useEffect } from 'react'
import { socket } from '@/lib/socket'
import { useStore } from './useStore'

export function useSocket() {
  const { user, setOnlineCount, setRooms, addMessage, setMembers, setTypingUser } = useStore()

  useEffect(() => {
    if (!user) return

    if (!socket.connected) socket.connect()

    socket.on('users:count', (count: number) => setOnlineCount(count))
    socket.on('rooms:update', (rooms) => setRooms(rooms))
    socket.on('message:new', (msg) => addMessage(msg))
    socket.on('room:members', (members) => setMembers(members))
    socket.on('typing:update', ({ userId, nickname, typing }) => {
      setTypingUser(userId, nickname, typing)
    })

    return () => {
      socket.off('users:count')
      socket.off('rooms:update')
      socket.off('message:new')
      socket.off('room:members')
      socket.off('typing:update')
    }
  }, [user, setOnlineCount, setRooms, addMessage, setMembers, setTypingUser])

  return socket
}
