'use client'

import React, { useEffect, useState } from 'react'
import { socket } from '../lib/socket'
import { Player, Room } from '../types/lobby'
import CatanGamePage from './MainGame'

interface LobbyPageProps {
    roomCode: string
}

const LobbyPage: React.FC<LobbyPageProps> = ({ roomCode }) => {
    const [players, setPlayers] = useState<Player[]>([])
    const [ready, setReady] = useState(false)
    const [allReady, setAllReady] = useState(false)
    const [gameStarted, setGameStarted] = useState(false)

    useEffect(() => {
        const handlePlayerList = (list: Player[]) => {
            setPlayers(list)
        }
        socket.on('playerList', handlePlayerList)
        socket.emit('getPlayerList', roomCode)

        return () => {
            socket.off('playerList', handlePlayerList)
        }
    }, [roomCode])

    useEffect(() => {
        socket.emit('getRoomInfo', roomCode)
        const handleRoom = (room: Room) => {
            console.log('Room Info:', room)
        }
        socket.on('roomInfo', handleRoom)
        return () => {
            socket.off('roomInfo', handleRoom)
        }
    }, [roomCode])

    useEffect(() => {
        const handleAllReady = () => {
            setAllReady(true)
        }

        socket.on('allPlayerReady', handleAllReady)
        return () => {
            socket.off('allPlayerReady', handleAllReady)
        }
    }, [])

    useEffect(() => {
        const handleStartGame = () => {
            setGameStarted(true)
        }
        socket.on('gameStart', handleStartGame)
        return () => {
            socket.off('gameStart', handleStartGame)
        }
    }, [])

    const startGame = () => {

        if (allReady) {
            console.log('Entering Main Game')
            socket.emit('gameStart', roomCode)
            setGameStarted(true)
        } else {
            alert('Not all players are ready.')
        }
    }

    if (gameStarted) {
        return <CatanGamePage roomCode={roomCode} />
    }

    return (
        <div className="p-6 text-center">
            <h1 className="text-3xl font-bold mb-4">Lobby</h1>
            <p className="text-lg mb-2">
                Room Code: <strong>{roomCode}</strong>
            </p>

            <div className="mt-4 text-left inline-block">
                <h2 className="text-xl font-semibold mb-2">
                    Players in this room: ({players.filter(p => p.isReady).length}/{players.length} Ready):
                </h2>
                <ul className="bg-white rounded shadow p-4">
                    {players.map((player) => (
                        <li
                            key={player.id}
                            className="border-b py-1 text-sm text-gray-700"
                        >
                            {player.isReady ? '✅' : ''} {player.name} 
                        </li>
                    ))}
                </ul>
                <button
                    className="block mx-auto mt-4 bg-blue-500 hover:bg-blue-400 text-white font-bold py-2 px-4 border-b-4 border-blue-700 hover:border-blue-500 rounded"
                    onClick={() => startGame()}
                >
                    Start Game
                </button>
                <button
                    className="block mx-auto mt-4 bg-blue-500 hover:bg-blue-400 text-white font-bold py-2 px-4 border-b-4 border-blue-700 hover:border-blue-500 rounded"
                    onClick={() => {
                        setReady(true)
                        socket.emit('playerReady', roomCode)
                    }}
                >
                    Ready
                </button>
            </div>
        </div>
    )
}

export default LobbyPage
