// MenuPage.tsx
import React, { useEffect, useState } from 'react'
import { socket } from '@/lib/socket'
import LobbyPage from '../LobbyPage/LobbyPage';

// Define prop types
interface MenuPageProps {
  onJoinGame: (roomCode: string) => void;
  onCreateGame: () => void;
}

const MenuPage: React.FC<MenuPageProps> = ({ onJoinGame, onCreateGame }) => {
  const [roomCode, setRoomCode] = useState('')
  const [status, setStatus] = useState('')
  const [inLobby, setInLobby] = useState(false)

  const handleCreateGame = () => {
    onCreateGame()
    socket.emit('createGame')
  }

  const handleJoinGame = () => {
    onJoinGame(roomCode)
    socket.emit('joinGame', roomCode)
  }

  useEffect(() => {
    socket.on('gameCreated', (code: string) => {
      setRoomCode(code)
      setStatus(`Game created! Room code: ${code}`)
      setInLobby(true)
    })

    socket.on('joinedGame', (code: string) => {
      setStatus(`Joined game in room: ${code}`)
      setInLobby(true)
    })

    socket.on('error', (msg: string) => {
      setStatus(`Error: ${msg}`)
    })

    return () => {
      socket.off('gameCreated')
      socket.off('joinedGame')
      socket.off('error')
    }
  }, [])

  if (inLobby) {
    return <LobbyPage roomCode={roomCode} />
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Catan Multiplayer</h1>

      <button
        onClick={handleCreateGame}
        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded mb-4"
      >
        Create Game
      </button>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Enter Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          className="border p-2 rounded mr-2"
        />
        <button
          onClick={handleJoinGame}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Join Game
        </button>
      </div>

      <p>{status}</p>
    </div>
  )
}

export default MenuPage
