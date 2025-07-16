'use client'

import React, { useEffect, useState } from 'react'
import { socket } from '../lib/socket'
import { Player, Room } from '../types/lobby'
import { MaterialType, HexTile } from '../types/game'

const getPolygonImage = (material: MaterialType) => {
    switch (material) {
        case 'wood':
            return '/images/polygon/tree-polygon.png'
        case 'brick':
            return '/images/polygon/brick-polygon.png'
        case 'wheat':
            return '/images/polygon/wheat-polygon.png'
        case 'sheep':
            return '/images/polygon/sheep-polygon.png'
        case 'ore':
            return '/images/polygon/ore-polygon.png'
        case 'desert':
            return '/images/polygon/desert-polygon.png'
        default:
            return ''
    }
}

const Hex = ({ tile }: { tile: HexTile }) => {
    const size = 40
    const centerX = 400 + tile.x
    const centerY = 350 + tile.y

    const points = Array.from({ length: 6 })
        .map((_, i) => {
            const angle = (Math.PI / 180) * (60 * i)
            const x = centerX + size * Math.cos(angle)
            const y = centerY + size * Math.sin(angle)
            return `${x},${y}`
        })
        .join(' ')

    const imageUrl = getPolygonImage(tile.materialType)

    return (
        <>
            {imageUrl && (
                <image
                    href={imageUrl}
                    x={centerX - size}
                    y={centerY - size}
                    width={size * 2}
                    height={size * 2}
                    preserveAspectRatio="xMidYMid slice"
                    transform={`rotate(90, ${centerX}, ${centerY})`}
                />
            )}
            <polygon
                points={points}
                fill="transparent"
                stroke="#333"
                strokeWidth="2"
            />
            <>
                <circle
                    cx={centerX}
                    cy={centerY}
                    r={16}
                    fill="rgba(0, 0, 0, 0.4)"
                />
                <text
                    x={centerX}
                    y={centerY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="16"
                    fontWeight="bold"
                    fill="white"
                >
                    {tile.rollNumber ?? ''}
                </text>
            </>
        </>
    )
}

interface CatanGamePageProps {
    roomCode: string
}

const CatanGamePage: React.FC<CatanGamePageProps> = ({ roomCode }) => {
    const [tiles, setTiles] = useState<HexTile[]>([])
    const [players, setPlayers] = useState<Player[]>([])
    const [dice, setDice] = useState<[number, number] | null>(null)

    useEffect(() => {
        socket.emit('gameStart', roomCode)
    }, [roomCode])

    useEffect(() => {
        const handleStartGame = (board: HexTile[]) => {
            setTiles(board)
            console.log('board state: ', board)
        }

        socket.on('gameStart', handleStartGame)

        return () => {
            socket.off('gameStart', handleStartGame)
        }
    }, [])

    useEffect(() => {
        socket.emit('getRoomInfo', roomCode)

        const handleRoom = (room: Room) => {
            console.log('Room Info IN GAME:', room)
            setPlayers(room.players)
        }
        socket.on('roomInfo', handleRoom)
        // Cleanup
        return () => {
            socket.off('roomInfo', handleRoom)
        }
    }, [roomCode])

    const rollDice = () => {
        const die1 = Math.floor(Math.random() * 6) + 1
        const die2 = Math.floor(Math.random() * 6) + 1
        setDice([die1, die2])
        socket.emit('diceRoll', { roomCode, rolls: [die1, die2] }) // ✅ fix this
    }

    useEffect(() => {
        socket.on('updateDiceRoll', (rolls: [number, number]) => {
            console.log('SOCKET: updateDiceRoll')
            setDice(rolls)
        })

        return () => {
            socket.off('updateDiceRoll')
        }
    }, [])

    return (
        <div className="relative w-screen h-screen bg-blue-200 overflow-hidden">
            {/* Game Board Centered */}
            <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                <svg width="700" height="700" viewBox="0 0 700 700">
                    <g transform="translate(-50, 0)">
                        {tiles.map((tile) => (
                            <Hex key={tile.id} tile={tile} />
                        ))}
                    </g>
                </svg>
            </div>

            {/* Player Panel - Bottom Right */}
            <div className="absolute bottom-4 right-4 w-64 bg-white shadow-lg rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-2">Players</h2>
                <ul className="space-y-2">
                    {players.map((player, index) => (
                        <li
                            key={player.id || index}
                            className="p-2 bg-gray-100 rounded"
                        >
                            <div className="font-bold">{player.name}</div>
                            <div className="text-sm text-gray-600">
                                Cards:{' '}
                                {Object.values(player.resources).reduce(
                                    (total, count) => total + count,
                                    0
                                )}
                            </div>

                            <div className="text-sm text-gray-600">
                                Dev Cards: {player.devCards.length}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {players[0] && players[0].resources && (
                <div className="absolute bottom-4 left-4 flex gap-2 bg-white shadow-md rounded-lg p-3">
                    {Object.entries(players[0].resources).map(
                        ([resource, count]) => (
                            <div
                                key={resource}
                                className="flex items-center gap-1"
                            >
                                <img
                                    src={`/images/cards/${resource}.svg`}
                                    alt={resource}
                                    className="w-8 h-12"
                                />
                                <span className="text-sm font-semibold">
                                    {count}
                                </span>
                            </div>
                        )
                    )}
                </div>
            )}

            {/* Shop Panel - Bottom Center */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-white shadow-md rounded-lg p-3">
                {[
                    'Trade',
                    'Buy Dev Card',
                    'Buy Road',
                    'Buy Settlement',
                    'Buy City',
                ].map((action) => (
                    <button
                        key={action}
                        className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 px-3 rounded shadow"
                    >
                        {action}
                    </button>
                ))}
            </div>

            {/* Dice Panel - Above Shop, Left of Player Tab */}
            <div className="absolute bottom-28 right-72 flex flex-col items-center gap-2">
                <button
                    onClick={() => {
                        rollDice()
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Roll Dice
                </button>

                {dice && (
                    <div className="flex items-center gap-3">
                        <img
                            src={`/images/dices/dice-six-faces-${dice[0]}.svg`}
                            alt={`Die 1: ${dice[0]}`}
                            className="w-10 h-10"
                        />
                        <img
                            src={`/images/dices/dice-six-faces-${dice[1]}.svg`}
                            alt={`Die 2: ${dice[1]}`}
                            className="w-10 h-10"
                        />
                        <span className="text-lg font-bold">
                            = {dice[0] + dice[1]}
                        </span>
                    </div>
                )}
            </div>

            {/* Shop Cost Display (Image) - Bottom Left */}
            <img
                src={'/images/shop/shop.png'}
                alt="Shop Cost"
                className="absolute top-4 left-4 w-56 h-64 object-contain"
            />
        </div>
    )
}

export default CatanGamePage
