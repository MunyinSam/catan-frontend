'use client'

import React, { useEffect, useState, useRef } from 'react'
import { socket } from '../lib/socket'
import { Player, Room } from '../types/lobby'
import {
    HexTile,
    Port,
    ResourceType,
    Road,
    Settlement,
    City,
} from '../types/game'
import { getPolygonImage } from '../functions/maingame'

const Hex = ({ tile }: { tile: HexTile }) => {
    const size = 40
    const centerX = 400 + tile.x
    const centerY = 350 + tile.y
    
    const points = [...Array(6).keys()]
        .map((i) => {
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

const portCoords: { x: number; y: number }[] = [
    { x: 340, y: 90 },
    { x: 460, y: 90 },
    { x: 600, y: 160 },
    { x: 670, y: 280 },
    { x: 670, y: 420 },
    { x: 130, y: 280 },
    { x: 130, y: 420 },
    { x: 600, y: 530 },
    { x: 200, y: 540 },
    { x: 200, y: 160 },
    { x: 330, y: 600 },
    { x: 470, y: 600 },
]

function shuffle<T>(array: T[]): T[] {
    return array
        .map((a) => [Math.random(), a] as const)
        .sort(([a], [b]) => a - b)
        .map(([_, b]) => b)
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
    const [roadAngle, setRoadAngle] = useState(0)
    const [isBuildingSettlement, setIsBuildingSettlement] = useState(false)
    const [isBuildingCity, setIsBuildingCity] = useState(false)

    const [roads, setRoads] = useState<
        {
            start: { x: number; y: number }
            end: { x: number; y: number }
            ownerId: string
        }[]
    >([])
    const [settlements, setSettlements] = useState<
        { position: { x: number; y: number }; ownerId: string }[]
    >([])
    const [cities, setCities] = useState<
        { position: { x: number; y: number }; ownerId: string }[]
    >([])

    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
        null
    )

    const [logs, setLogs] = useState<string[]>([])
    const [ports] = useState(() => generatePorts())
    const [isPlacingRobber, setIsPlacingRobber] = useState(false)
    const [robberTileId, setRobberTileId] = useState<number | null>(null)

    const isMyTurn = playerIndex === currentTurnIndex
    const resourceCosts: {
        [action: string]: Partial<Record<keyof Player['resources'], number>>
    } = {
        'Buy Road': { brick: 1, wood: 1 },
        'Buy Settlement': { brick: 1, wood: 1, wheat: 1, sheep: 1 },
        'Buy City': { wheat: 2, ore: 3 },
        'Buy Dev Card': { wheat: 1, sheep: 1, ore: 1 },
    }

    const logRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight
        }
    }, [logs])

    useEffect(() => {
        socket.emit('gameStart', roomCode)
        socket.emit('getPlayer', { roomCode })
        socket.emit('getRoomInfo', roomCode)
        socket.emit('getPlayerList', roomCode)

        const handleStartGame = (board: HexTile[]) => {
            setTiles(board)
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

    useEffect(() => {
        socket.on('resourceLog', (msg: string) => {
            setLogs((prev) => [...prev, msg])
        })
        return () => {
            socket.off('resourceLog')
        }
    }, [])

    useEffect(() => {
        const handleRemoteRoad = ({ road }: { road: Road }) => {
            console.log('ROAD ', road)
            setRoads((prev) => [...prev, road])
        }

        socket.on('roadBuilt', handleRemoteRoad)

        return () => {
            socket.off('roadBuilt', handleRemoteRoad)
        }
    }, [])

    useEffect(() => {
        const handleRemoteSettlement = ({
            settlement,
        }: {
            settlement: Settlement
        }) => {
            setSettlements((prev) => [...prev, settlement])
        }

        socket.on('settlementBuilt', handleRemoteSettlement)

        return () => {
            socket.off('settlementBuilt', handleRemoteSettlement)
        }
    }, [])

    useEffect(() => {
        const handleRemoteCity = ({ city }: { city: City }) => {
            setCities((prev) => [...prev, city])
        }

        socket.on('cityBuilt', handleRemoteCity)

        return () => {
            socket.off('cityBuilt', handleRemoteCity)
        }
    }, [])

    useEffect(() => {
        // console.log('isBuildingRoad:', isBuildingRoad)
    }, [isBuildingRoad])

    useEffect(() => {
        // console.log('mousePos:', mousePos)
    }, [mousePos])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isBuildingRoad && (e.key === 'r' || e.key === 'R')) {
                setRoadAngle((prev) => (prev + 60) % 360)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isBuildingRoad])

    useEffect(() => {
        socket.on('robberMoved', ({ tileId }) => {
            setRobberTileId(tileId)
        })
        return () => {
            socket.off('robberMoved')
        }
    }, [])

    const rollDice = () => {
        const die1 = Math.floor(Math.random() * 6) + 1
        const die2 = Math.floor(Math.random() * 6) + 1
        setDice([die1, die2])
        socket.emit('diceRoll', { roomCode, rolls: [die1, die2] })
        const msg = `${players[playerIndex!]?.name} rolled ${die1} and ${die2}`
        setLogs((prev) => [...prev, msg])
        socket.emit('resourceLog', msg)
    }

    const actionHandlers = {
        Trade: () => {
            const msg = `${players[playerIndex!]?.name} opened the Trade panel`
            setLogs((prev) => [...prev, msg])
            socket.emit('resourceLog', msg)
            setShowTradeUI(true) // we'll design a simple trade UI next
        },
        'Buy Dev Card': () => {
            if (spendResources(resourceCosts['Buy Dev Card'])) {
                const msg = `${
                    players[playerIndex!]?.name
                } bought a Development Card`
                setLogs((prev) => [...prev, msg])
                socket.emit('resourceLog', msg)
                // Add dev card logic here
            }
        },
        'Buy Road': () => {
            if (spendResources(resourceCosts['Buy Road'])) {
                const msg = `${
                    players[playerIndex!]?.name
                } started building a Road`
                setLogs((prev) => [...prev, msg])
                socket.emit('resourceLog', msg)
                setIsBuildingRoad(true)
            }
        },
        'Buy Settlement': () => {
            if (spendResources(resourceCosts['Buy Settlement'])) {
                const msg = `${
                    players[playerIndex!]?.name
                } started building a Settlement`
                setLogs((prev) => [...prev, msg])
                socket.emit('resourceLog', msg)
                setIsBuildingSettlement(true)
                // Add settlement placing logic here
            }
        },
        'Buy City': () => {
            if (spendResources(resourceCosts['Buy City'])) {
                const msg = `${
                    players[playerIndex!]?.name
                } started building a City`
                setLogs((prev) => [...prev, msg])
                socket.emit('resourceLog', msg)
                setIsBuildingCity(true)
                // Add city upgrade logic here
            }
        },
        'End Turn': () => {
            const msg = `${players[playerIndex!]?.name} ended their turn`
            setLogs((prev) => [...prev, msg])
            socket.emit('resourceLog', msg)
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

    function generatePorts(): Port[] {
        const resources: ResourceType[] = [
            'brick',
            'wood',
            'ore',
            'wheat',
            'sheep',
        ]

        // 2 null ports (3:1)
        const portsData: Omit<Port, 'x' | 'y'>[] = [
            { ratio: '3:1', resource: null },
            { ratio: '3:1', resource: null },
        ]

        // Add each resource once
        const baseResources = [...resources]

        // Add 5 more random ones from all 5
        const additional = shuffle([...resources]).slice(0, 5)

        const finalResources = shuffle([...baseResources, ...additional])

        portsData.push(
            ...finalResources.map((resource) => ({
                ratio: '2:1' as const,
                resource,
            }))
        )

        const shuffledCoords = shuffle(portCoords)

        return shuffledCoords.map((coord, i) => ({
            ...coord,
            ...portsData[i],
        }))
    }

    return (
        <div className="relative w-screen h-screen bg-blue-200 overflow-hidden">
            <div className="absolute top-4 left-60 flex gap-2 bg-white shadow-md rounded-lg p-3">
                Current Turn:{' '}
                {players[currentTurnIndex ?? 0]?.name || 'Waiting...'}
            </div>
            {/* Game Board Centered */}
            <div className="absolute inset-0 flex justify-center items-center">
                <svg
                    width="700"
                    height="700"
                    viewBox="0 0 700 700"
                    onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const x = e.clientX - rect.left
                        const y = e.clientY - rect.top
                        setMousePos({ x, y })
                    }}
                    onClick={() => {
                        if (!mousePos || !isMyTurn) return

                        if (isBuildingRoad) {
                            const length = 40
                            const angleRad = (roadAngle * Math.PI) / 180
                            const dx = (length / 2) * Math.cos(angleRad)
                            const dy = (length / 2) * Math.sin(angleRad)

                            const newRoad = {
                                start: {
                                    x: mousePos.x - dx,
                                    y: mousePos.y - dy,
                                },
                                end: { x: mousePos.x + dx, y: mousePos.y + dy },
                                ownerId: socket.id as string,
                            }

                            setRoads((prev) => [...prev, newRoad])
                            socket.emit('buildRoad', {
                                roomCode,
                                road: newRoad,
                            })
                            setIsBuildingRoad(false)
                            setMousePos(null)
                            setRoadAngle(0) // reset angle after placing
                            return
                        }

                        if (isBuildingSettlement) {
                            const newSettlement = {
                                position: { x: mousePos.x, y: mousePos.y },
                                ownerId: socket.id as string,
                            }
                            setSettlements((prev) => [...prev, newSettlement])
                            socket.emit('buildSettlement', {
                                roomCode,
                                settlement: newSettlement,
                            })
                            setIsBuildingSettlement(false)
                            setMousePos(null)
                            return
                        }

                        if (isBuildingCity) {
                            const newCity = {
                                position: { x: mousePos.x, y: mousePos.y },
                                ownerId: socket.id as string,
                            }
                            setCities((prev) => [...prev, newCity])
                            socket.emit('buildCity', {
                                roomCode,
                                city: newCity,
                            })
                            setIsBuildingCity(false)
                            setMousePos(null)
                            return
                        }

                        if (isPlacingRobber) {
                            // Find the closest tile to mousePos
                            let closestTile = null
                            let minDist = Infinity
                            for (const tile of tiles) {
                                const centerX = 400 + tile.x
                                const centerY = 350 + tile.y
                                const dist = Math.hypot(
                                    centerX - mousePos.x,
                                    centerY - mousePos.y
                                )
                                if (dist < minDist) {
                                    minDist = dist
                                    closestTile = tile
                                }
                            }
                            if (closestTile) {
                                setRobberTileId(closestTile.id)
                                setIsPlacingRobber(false)
                                const msg = `${
                                    players[playerIndex!]?.name
                                } placed the Robber on ${
                                    closestTile.materialType
                                } (${closestTile.rollNumber ?? ''})`
                                setLogs((prev) => [...prev, msg])
                                socket.emit('resourceLog', msg)
                                socket.emit('robberMoved', {
                                    roomCode,
                                    tileId: closestTile.id,
                                })
                            }
                            return
                        }
                    }}
                >
                    <g transform="translate(-50, -10)">
                        {tiles.map((tile) => (
                            <Hex key={tile.id} tile={tile} />
                        ))}

                        {ports.map((port, idx) => (
                            <g
                                key={idx}
                                transform={`translate(${port.x},${port.y})`}
                            >
                                <rect
                                    x={-32}
                                    y={-22}
                                    width={64}
                                    height={44}
                                    rx={8}
                                    fill="#fffbe6"
                                    stroke="#bfa14a"
                                    strokeWidth={2}
                                    opacity={0.95}
                                />
                                <text
                                    x={-20}
                                    y={5}
                                    fontSize="16"
                                    fontWeight="bold"
                                    fill="#bfa14a"
                                >
                                    {port.ratio}
                                </text>
                                {port.resource ? (
                                    <image
                                        href={`/images/cards/${port.resource}.svg`}
                                        x={10}
                                        y={-13}
                                        width={25}
                                        height={25}
                                    />
                                ) : (
                                    <text
                                        x={18}
                                        y={5}
                                        fontSize="18"
                                        fontWeight="bold"
                                        fill="#bfa14a"
                                    >
                                        ?
                                    </text>
                                )}
                            </g>
                        ))}

                        {roads.map((road, idx) => {
                            const owner = players.find(
                                (p) => p.id === road.ownerId
                            )
                            return (
                                <line
                                    key={idx}
                                    x1={road.start.x}
                                    y1={road.start.y}
                                    x2={road.end.x}
                                    y2={road.end.y}
                                    stroke={owner?.color || 'black'}
                                    strokeWidth={6}
                                    strokeLinecap="round"
                                />
                            )
                        })}

                        {settlements.map((settlement, idx) => {
                            const owner = players.find(
                                (p) => p.id === settlement.ownerId
                            )
                            return (
                                <circle
                                    key={idx}
                                    cx={settlement.position.x}
                                    cy={settlement.position.y}
                                    r={10}
                                    fill={owner?.color || 'brown'}
                                    stroke="#fff"
                                    strokeWidth={2}
                                />
                            )
                        })}

                        {cities.map((city, idx) => {
                            const owner = players.find(
                                (p) => p.id === city.ownerId
                            )
                            return (
                                <rect
                                    key={idx}
                                    x={city.position.x - 10}
                                    y={city.position.y - 10}
                                    width={20}
                                    height={20}
                                    fill={owner?.color || 'gray'}
                                    stroke="#fff"
                                    strokeWidth={2}
                                    rx={4}
                                />
                            )
                        })}

                        {robberTileId &&
                            tiles.map((tile) =>
                                tile.id === robberTileId ? (
                                    <circle
                                        key="robber"
                                        cx={400 + tile.x}
                                        cy={350 + tile.y}
                                        r={18}
                                        fill="black"
                                        stroke="gold"
                                        strokeWidth={3}
                                        opacity={0.8}
                                    >
                                        <title>Robber</title>
                                    </circle>
                                ) : null
                            )}

                        {/* Ghost road preview that follows mouse */}
                        {isBuildingRoad &&
                            mousePos &&
                            (() => {
                                const length = 40
                                const angleRad = (roadAngle * Math.PI) / 180
                                const dx = (length / 2) * Math.cos(angleRad)
                                const dy = (length / 2) * Math.sin(angleRad)
                                return (
                                    <line
                                        x1={mousePos.x - dx}
                                        y1={mousePos.y - dy}
                                        x2={mousePos.x + dx}
                                        y2={mousePos.y + dy}
                                        stroke={
                                            players[playerIndex!]?.color ||
                                            'gray'
                                        }
                                        strokeWidth={6}
                                        strokeDasharray="6, 4"
                                        opacity={0.7}
                                        pointerEvents="none"
                                    />
                                )
                            })()}
                        {isBuildingSettlement && mousePos && (
                            <circle
                                cx={mousePos.x}
                                cy={mousePos.y}
                                r={10}
                                fill={players[playerIndex!]?.color || 'brown'}
                                opacity={0.5}
                                stroke="#fff"
                                strokeWidth={2}
                                pointerEvents="none"
                            />
                        )}
                        {isBuildingCity && mousePos && (
                            <rect
                                x={mousePos.x - 10}
                                y={mousePos.y - 10}
                                width={20}
                                height={20}
                                fill={players[playerIndex!]?.color || 'gray'}
                                opacity={0.5}
                                stroke="#fff"
                                strokeWidth={2}
                                rx={4}
                                pointerEvents="none"
                            />
                        )}

                        {isPlacingRobber && mousePos && (
                            <circle
                                cx={mousePos.x}
                                cy={mousePos.y}
                                r={18}
                                fill="black"
                                opacity={0.4}
                                stroke="gold"
                                strokeWidth={2}
                                pointerEvents="none"
                            />
                        )}
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

            {/* RESOURCES*/}
            {players[playerIndex ?? 0] &&
                players[playerIndex ?? 0].resources && (
                    <div className="absolute bottom-4 left-16 flex flex-col gap-2 bg-white shadow-md rounded-lg p-3 z-20">
                        <div className="font-bold mb-1 text-center">
                            Your Resources
                        </div>
                        {(
                            [
                                'brick',
                                'ore',
                                'sheep',
                                'wheat',
                                'wood',
                            ] as (keyof Player['resources'])[]
                        ).map((resource) => (
                            <div
                                key={resource}
                                className="flex items-center gap-2"
                            >
                                <button
                                    className="bg-green-400 hover:bg-green-500 text-white font-bold px-2 rounded"
                                    onClick={() => {
                                        setPlayers((prev) =>
                                            prev.map((p, i) =>
                                                i === playerIndex
                                                    ? {
                                                          ...p,
                                                          resources: {
                                                              ...p.resources,
                                                              [resource]:
                                                                  (p.resources[
                                                                      resource
                                                                  ] || 0) + 1,
                                                          },
                                                      }
                                                    : p
                                            )
                                        )
                                        const msg = `${
                                            players[playerIndex!]?.name
                                        } gained 1 ${resource}`
                                        setLogs((prev) => [...prev, msg])
                                        socket.emit('resourceLog', msg)
                                    }}
                                >
                                    +
                                </button>
                                <img
                                    src={`/images/cards/${resource}.svg`}
                                    alt={resource}
                                    className="w-8 h-12"
                                />
                                <span className="text-sm font-semibold">
                                    {players[playerIndex!]?.resources[
                                        resource
                                    ] ?? 0}
                                </span>
                                <button
                                    className="bg-red-400 hover:bg-red-500 text-white font-bold px-2 rounded"
                                    onClick={() => {
                                        setPlayers((prev) =>
                                            prev.map((p, i) =>
                                                i === playerIndex
                                                    ? {
                                                          ...p,
                                                          resources: {
                                                              ...p.resources,
                                                              [resource]:
                                                                  Math.max(
                                                                      0,
                                                                      (p
                                                                          .resources[
                                                                          resource
                                                                      ] || 0) -
                                                                          1
                                                                  ),
                                                          },
                                                      }
                                                    : p
                                            )
                                        )
                                        const msg = `${
                                            players[playerIndex!]?.name
                                        } lost 1 ${resource}`
                                        setLogs((prev) => [...prev, msg])
                                        socket.emit('resourceLog', msg)
                                    }}
                                >
                                    –
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            {/* LOGS */}
            <div className="absolute top-4 right-4 w-80 bg-white shadow-lg rounded-lg p-4 z-30">
                <h2 className="text-lg font-semibold mb-2">Game Log</h2>
                <div ref={logRef} className="h-48 overflow-y-auto text-sm">
                    {logs.map((log, idx) => (
                        <div key={idx} className="mb-1">
                            {log}
                        </div>
                    ))}
                </div>
            </div>
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
                <button
                    className={`bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded shadow
        ${!isMyTurn ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={
                        isMyTurn ? () => setIsPlacingRobber(true) : undefined
                    }
                    disabled={!isMyTurn}
                >
                    Place Robber
                </button>
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
                        if (isMyTurn) rollDice()
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
