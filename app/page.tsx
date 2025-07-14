'use client'

import React from 'react'
import MenuPage from '../components/MenuPage'

export default function Page() {
    const handleJoinGame = (roomCode: string) => {
        console.log('Joining game with room code:', roomCode)
        // connect to socket.io and join the room
    }

    const handleCreateGame = () => {
        console.log('Creating a new game...')
        // generate room code, initialize server state, etc.
    }

    return (
        <MenuPage onJoinGame={handleJoinGame} onCreateGame={handleCreateGame} />
    )
}
