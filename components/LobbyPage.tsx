'use client'

import React, { useEffect, useState } from 'react'
import { socket } from '../lib/socket'

interface LobbyPageProps {
    roomCode: string
}

const LobbyPage: React.FC<LobbyPageProps> = ({ roomCode }) => {
    const [players, setPlayers] = useState<string[]>([])
    useEffect(() => {
        const handlePlayerList = (list: string[]) => {
            console.log('playerList', list)
            setPlayers(list)
        }

        socket.on('playerList', handlePlayerList)

        // 🟢 Ask the server for the list once component is ready
        socket.emit('getPlayerList', roomCode)

        return () => {
            socket.off('playerList', handlePlayerList)
        }
    }, [roomCode])

    return (
        <div className="p-6 text-center">
            <h1 className="text-3xl font-bold mb-4">Lobby</h1>
            <p className="text-lg mb-2">
                Room Code: <strong>{roomCode}</strong>
            </p>

            <div className="mt-4 text-left inline-block">
                <h2 className="text-xl font-semibold mb-2">
                    Players in this room:
                </h2>
                <ul className="bg-white rounded shadow p-4">
                    {players.map((id) => (
                        <li
                            key={id}
                            className="border-b py-1 text-sm text-gray-700"
                        >
                            {id}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}

export default LobbyPage
