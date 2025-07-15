'use client'

import React, { useEffect, useState } from 'react'
import { socket } from '../lib/socket'
import { Player, Room } from '../types/lobby'

type MaterialType = 'wood' | 'brick' | 'wheat' | 'sheep' | 'ore' | 'desert'

interface HexTile {
    id: number
    materialType: MaterialType
    rollNumber: number | null
    x: number
    y: number
}

const materialsPool: MaterialType[] = [
    ...Array(7).fill('wood'),
    ...Array(7).fill('brick'),
    ...Array(7).fill('wheat'),
    ...Array(7).fill('sheep'),
    ...Array(7).fill('ore'),
    ...Array(2).fill('desert'),
]

const rollNumberPool = [
    2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 9, 9, 9,
    9, 9, 10, 10, 10, 10, 11, 11, 11, 12,
]

const generateFullBoard = (): HexTile[] => {
    const radius = 3
    const size = 40
    const tiles: HexTile[] = []

    const shuffledMaterials = [...materialsPool].sort(() => Math.random() - 0.5)
    const shuffledRolls = [...rollNumberPool].sort(() => Math.random() - 0.5)

    let id = 0
    for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius)
        const r2 = Math.min(radius, -q + radius)
        for (let r = r1; r <= r2; r++) {
            const material = shuffledMaterials.pop() || 'desert'
            const rollNumber =
                material === 'desert' ? null : shuffledRolls.pop() || null

            const x = size * 1.5 * q
            const y = size * Math.sqrt(3) * (r + q / 2)

            tiles.push({
                id: id++,
                materialType: material,
                rollNumber,
                x,
                y,
            })
        }
    }

    return tiles
}

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

const getColor = (material: MaterialType) => {
    switch (material) {
        case 'wood':
            return '#228B22'
        case 'brick':
            return '#B22222'
        case 'wheat':
            return '#FFD700'
        case 'sheep':
            return '#90EE90'
        case 'ore':
            return '#A9A9A9'
        case 'desert':
            return '#DEB887'
        default:
            return '#ccc'
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
        const board = generateFullBoard()
        setTiles(board)
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
    }

    return (
        <div className="flex flex-row items-start justify-center min-h-screen p-4 gap-8">
            {/* Game Board */}
            <div className="flex flex-col items-center">
                <h1 className="text-2xl font-bold mb-4">
                    Catan Full Board (5–6 Players)
                </h1>
                <svg width="800" height="800">
                    {tiles.map((tile) => (
                        <Hex key={tile.id} tile={tile} />
                    ))}
                </svg>
            </div>

            {/* Player Sidebar */}
            <div className="w-64 bg-white shadow-lg rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-2">Players</h2>
                <ul className="space-y-2">
                    {players.map((player, index) => (
                        <li
                            key={player.id || index}
                            className="p-2 bg-gray-100 rounded hover:bg-gray-200"
                        >
                            {`${player.name}` || `Player ${index + 1}`}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Dice Roller */}
            <div className="mt-6 flex flex-col items-center gap-2">
                <button
                    onClick={rollDice}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Roll Dice
                </button>

                {dice && (
                    <div className="flex items-center gap-4 mt-2">
                        <img
                            src={`/images/dices/dice-six-faces-${dice[0]}.svg`}
                            alt={`Die 1: ${dice[0]}`}
                            className="w-12 h-12"
                        />
                        <img
                            src={`/images/dices/dice-six-faces-${dice[1]}.svg`}
                            alt={`Die 2: ${dice[1]}`}
                            className="w-12 h-12"
                        />
                        <span className="text-xl font-bold">
                            = {dice[0] + dice[1]}
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default CatanGamePage
