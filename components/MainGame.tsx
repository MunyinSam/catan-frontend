'use client'

import React, { useEffect, useState } from 'react'
import { socket } from '../lib/socket'
import { Player, Room } from '../types/lobby'
import { MaterialType, HexTile } from '../types/game'
import { getPolygonImage } from '../functions/maingame'

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
    const [currentTurnIndex, setCurrentTurnIndex] = useState<number | null>(
        null
    )
    const [playerIndex, setPlayerIndex] = useState<number | null>(null) // this player's index
    const [showTradeUI, setShowTradeUI] = useState(false)
    const [isBuildingRoad, setIsBuildingRoad] = useState(false)

    const isMyTurn = playerIndex === currentTurnIndex
    const resourceCosts: {
        [action: string]: Partial<Record<keyof Player['resources'], number>>
    } = {
        'Buy Road': { brick: 1, wood: 1 },
        'Buy Settlement': { brick: 1, wood: 1, wheat: 1, sheep: 1 },
        'Buy City': { wheat: 2, ore: 3 },
        'Buy Dev Card': { wheat: 1, sheep: 1, ore: 1 },
    }

    useEffect(() => {
        socket.emit('gameStart', roomCode)
        socket.emit('getPlayer', { roomCode })
        socket.emit('getRoomInfo', roomCode)
        socket.emit('getPlayerList', roomCode)

        const handleStartGame = (board: HexTile[]) => {
            setTiles(board)
            console.log('board state:', board)
        }

        const handleRoomInfo = (room: Room) => {
            console.log('Room Info IN GAME:', room)
            setPlayers(room.players)
        }

        const handlePlayerList = (players: Player[]) => {
            setPlayers(players)
            const index = players.findIndex((p) => p.id === socket.id)
            setPlayerIndex(index)
        }

        const handleDiceRoll = (rolls: [number, number]) => {
            console.log('SOCKET: updateDiceRoll')
            setDice(rolls)
        }

        const handleTurnChanged = (turnIndex: number) => {
            setCurrentTurnIndex(turnIndex)
        }

        socket.on('gameStart', handleStartGame)
        socket.on('roomInfo', handleRoomInfo)
        socket.on('playerList', handlePlayerList)
        socket.on('updateDiceRoll', handleDiceRoll)
        socket.on('turnChanged', handleTurnChanged)

        return () => {
            socket.off('gameStart', handleStartGame)
            socket.off('roomInfo', handleRoomInfo)
            socket.off('playerList', handlePlayerList)
            socket.off('updateDiceRoll', handleDiceRoll)
            socket.off('turnChanged', handleTurnChanged)
        }
    }, [roomCode])

    const rollDice = () => {
        const die1 = Math.floor(Math.random() * 6) + 1
        const die2 = Math.floor(Math.random() * 6) + 1
        setDice([die1, die2])
        socket.emit('diceRoll', { roomCode, rolls: [die1, die2] })
    }

    const actionHandlers = {
        Trade: () => {
            console.log('Trade clicked')
            setShowTradeUI(true) // we'll design a simple trade UI next
        },
        'Buy Dev Card': () => {
            if (spendResources(resourceCosts['Buy Dev Card'])) {
                console.log('Bought Dev Card')
                // Add dev card logic here
            }
        },
        'Buy Road': () => {
            if (spendResources(resourceCosts['Buy Road'])) {
                console.log('Bought Road')
                setIsBuildingRoad(true)
            }
        },
        'Buy Settlement': () => {
            if (spendResources(resourceCosts['Buy Settlement'])) {
                console.log('Built Settlement')
                // Add settlement placing logic here
            }
        },
        'Buy City': () => {
            if (spendResources(resourceCosts['Buy City'])) {
                console.log('Upgraded to City')
                // Add city upgrade logic here
            }
        },
        'End Turn': () => {
            console.log('End Turn clicked')
            socket.emit('endTurn', roomCode)
        },
    }

    const spendResources = (
        cost: Partial<Record<keyof Player['resources'], number>>
    ): boolean => {
        const player = players.find(
            (p) => p.name === players[currentTurnIndex ?? 0]?.name
        )
        if (!player) return false

        // Check if player has enough resources
        for (const [resource, amount] of Object.entries(cost)) {
            if (
                (player.resources[resource as keyof Player['resources']] || 0) <
                amount!
            ) {
                alert(`Not enough ${resource}`)
                return false
            }
        }

        // Deduct resources
        const updatedPlayers = players.map((p) => {
            if (p.name !== players[currentTurnIndex ?? 0]?.name) return p
            const updatedResources = { ...p.resources }
            for (const [resource, amount] of Object.entries(cost)) {
                updatedResources[resource as keyof Player['resources']] -=
                    amount!
            }
            return { ...p, resources: updatedResources }
        })

        setPlayers(updatedPlayers)
        return true
    }

    return (
        <div className="relative w-screen h-screen bg-blue-200 overflow-hidden">
            <div className="absolute top-4 left-200 flex gap-2 bg-white shadow-md rounded-lg p-3">
                Current Turn:{' '}
                {players[currentTurnIndex ?? 0]?.name || 'Waiting...'}
            </div>

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
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: player.color }}
                                ></div>
                                <div className="font-bold">{player.name}</div>
                            </div>
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
                <div className="absolute bottom-4 left-16 flex gap-2 bg-white shadow-md rounded-lg p-3">
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
                {Object.entries(actionHandlers).map(([action, handler]) => (
                    <button
                        key={action}
                        className={`bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 px-3 rounded shadow
            ${!isMyTurn ? 'opacity-50 cursor-not-allowed' : ''}
        `}
                        onClick={isMyTurn ? handler : undefined}
                        disabled={!isMyTurn}
                    >
                        {action}
                    </button>
                ))}
            </div>

            {/* Dice Panel - Above Shop, Left of Player Tab */}
            <div className="absolute bottom-4 right-76 flex flex-col items-center gap-2">
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
                        {/* <span className="text-lg font-bold">
                            = {dice[0] + dice[1]}
                        </span> */}
                    </div>
                )}
                <button
                    onClick={() => {
                        isMyTurn ? rollDice() : undefined
                    }}
                    disabled={!isMyTurn}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Roll Dice
                </button>
            </div>

            {/* Shop Cost Display (Image) - Bottom Left */}
            <img
                src={'/images/shop/shop.png'}
                alt="Shop Cost"
                className="absolute top-4 left-4 w-56 h-64 object-contain"
            />

            {showTradeUI && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                        <h2 className="text-xl font-bold mb-4">Trade</h2>
                        <p className="text-sm mb-4">
                            This is where you can implement trade with bank or
                            player.
                        </p>

                        {/* Placeholder: You can design dropdowns or select inputs here */}
                        <div className="flex justify-end gap-2">
                            <button
                                className="bg-gray-300 px-4 py-2 rounded"
                                onClick={() => setShowTradeUI(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="bg-blue-500 text-white px-4 py-2 rounded"
                                onClick={() => {
                                    alert('Trade confirmed (demo)')
                                    setShowTradeUI(false)
                                }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CatanGamePage
