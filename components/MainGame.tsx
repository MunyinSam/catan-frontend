'use client'

import React, { useEffect, useState, useRef } from 'react'
import { socket } from '../lib/socket'
import { Player, Room } from '../types/lobby'
import { HexTile, Port, Road, Settlement, City } from '../types/game'
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
    const [ports, setPorts] = useState<Port[]>([])
    const [isPlacingRobber, setIsPlacingRobber] = useState(false)
    const [robberTileId, setRobberTileId] = useState<number | null>(null)

    const [tradeOut, setTradeOut] = useState<
        Partial<Record<keyof Player['resources'], number>>
    >({})
    const [tradeIn, setTradeIn] = useState<
        Partial<Record<keyof Player['resources'], number>>
    >({})

    const [devCardEffect, setDevCardEffect] = useState<null | {
        type: 'point' | 'robber' | 'road'
    }>(null)

    const [usedCardIndex, setUsedCardIndex] = useState<number | null>(null)

    const isMyTurn = playerIndex === currentTurnIndex
    // const devCardCounts = players[playerIndex!]?.devCards.reduce(
    //     (acc, card) => {
    //         if (card.used) return acc
    //         acc[card.type] = (acc[card.type] || 0) + 1
    //         return acc
    //     },
    //     {} as Record<string, number>
    // )
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

    useEffect(() => {
        socket.on('portsGenerated', (serverPorts: Port[]) => {
            setPorts(serverPorts)
        })
        return () => {
            socket.off('portsGenerated')
        }
    }, [])

    useEffect(() => {
        socket.emit('getPorts', roomCode)
    }, [roomCode])

    useEffect(() => {
        socket.on('devCardUpdate', ({ playerId, devCards }) => {
            setPlayers((prev) =>
                prev.map((p) => (p.id === playerId ? { ...p, devCards } : p))
            )
        })
        return () => {
            socket.off('devCardUpdate')
        }
    }, [])

    useEffect(() => {
        if (!devCardEffect) return

        if (devCardEffect.type === 'point') {
            const msg = `${
                players[playerIndex!]?.name
            } used a Free Point card and gained 1 point!`
            setLogs((prev) => [...prev, msg])
            socket.emit('resourceLog', msg)
            setDevCardEffect(null)
        }

        if (devCardEffect.type === 'road') {
            setIsBuildingRoad(true)
            const msg = `${
                players[playerIndex!]?.name
            } used a 2 Free Roads card!`
            setLogs((prev) => [...prev, msg])
            socket.emit('resourceLog', msg)
            setDevCardEffect(null)
        }

        if (devCardEffect.type === 'robber') {
            const msg = `${players[playerIndex!]?.name} used a robber`
            setLogs((prev) => [...prev, msg])
            socket.emit('resourceLog', msg)
            setDevCardEffect(null)
        }
    }, [devCardEffect])

    useEffect(() => {
        if (!devCardEffect || usedCardIndex == null) return

        // ...your effect logic for each card type...

        // Remove the used dev card
        setPlayers((prev) =>
            prev.map((p, i) =>
                i === playerIndex
                    ? {
                          ...p,
                          devCards: p.devCards.filter((card, idx) => {
                              void card // satisfies linter
                              return idx !== usedCardIndex
                          }),
                      }
                    : p
            )
        )
        socket.emit('devCardUpdate', {
            roomCode,
            playerId: players[playerIndex!]?.id,
            devCards: players[playerIndex!]?.devCards.filter((card, idx) => {
                void card
                return idx !== usedCardIndex
            }),
        })

        // Reset effect and index
        setDevCardEffect(null)
        setUsedCardIndex(null)
    }, [devCardEffect, usedCardIndex])

    useEffect(() => {
        socket.on('pointsUpdated', ({ playerId, points }) => {
            setPlayers((prevPlayers) =>
                prevPlayers.map((p) =>
                    p.id === playerId ? { ...p, points } : p
                )
            )
        })

        return () => {
            socket.off('pointsUpdated')
        }
    }, [])

    useEffect(() => {
        socket.on('longestRoadUpdated', ({ playerId, roadLength }) => {
            setPlayers((prevPlayers) =>
                prevPlayers.map((p) =>
                    p.id === playerId ? { ...p, longestRoad: roadLength } : p
                )
            )
        })

        return () => {
            socket.off('longestRoadUpdated')
        }
    }, [])

    useEffect(() => {
        socket.on('robberUsedUpdated', ({ playerId, robberUsed }) => {
            setPlayers((prevPlayers) =>
                prevPlayers.map((p) =>
                    p.id === playerId ? { ...p, robberUsed } : p
                )
            )
        })

        return () => {
            socket.off('robberUsedUpdated')
        }
    }, [])

    useEffect(() => {
        socket.on('robberPlacedBroadcast', ({ tileId, log }) => {
            setRobberTileId(tileId)
            setLogs((prev) => [...prev, log])
        })

        return () => {
            socket.off('robberPlacedBroadcast')
        }
    }, [])

    useEffect(() => {
        socket.on('resourcesUpdated', ({ playerId, resources }) => {
            setPlayers((prev) =>
                prev.map((p) => (p.id === playerId ? { ...p, resources } : p))
            )
        })
        return () => {
            socket.off('resourcesUpdated')
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
                // Weighted: robber (5), road (1), point (1)
                socket.emit('getDevelopmentCardCounts', roomCode)

                const cardTypes = [
                    'robber',
                    'robber',
                    'robber',
                    'robber',
                    'robber',
                    'road',
                    'point',
                ] as const

                const randomType =
                    cardTypes[Math.floor(Math.random() * cardTypes.length)]
                const msg = `${
                    players[playerIndex!]?.name
                } bought a Development Card`
                setLogs((prev) => [...prev, msg])
                socket.emit('resourceLog', msg)

                // Add dev card to player
                setPlayers((prev) =>
                    prev.map((p, i) =>
                        i === playerIndex
                            ? {
                                  ...p,
                                  devCards: [
                                      ...p.devCards,
                                      { type: randomType },
                                  ],
                              }
                            : p
                    )
                )
                socket.emit('devCardUpdate', {
                    roomCode,
                    playerId: players[playerIndex!]?.id,
                    devCards: [
                        ...(players[playerIndex!]?.devCards || []),
                        { type: randomType },
                    ],
                })
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
        'Random Material': () => {
            const player = players[playerIndex!]
            if (!player) return

            const availableMaterials = Object.entries(player.resources)
                .filter(([resource, count]) => {
                    void resource
                    count > 0
                })
                .map(([resource]) => resource)

            if (availableMaterials.length === 0) {
                const msg = `${player.name} has no resources to randomize`
                setLogs((prev) => [...prev, msg])
                socket.emit('resourceLog', msg)
                return
            }

            const randomIndex = Math.floor(
                Math.random() * availableMaterials.length
            )
            const randomMaterial = availableMaterials[randomIndex]

            const msg = `${player.name} randomly got: ${randomMaterial}`
            setLogs((prev) => [...prev, msg])
            socket.emit('resourceLog', msg)
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
            <div className="absolute top-4 left-10 flex gap-2 bg-white shadow-md rounded-lg p-3 text-base font-bold">
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
                                socket.emit('robberPlaced', {
                                    roomCode,
                                    tileId: closestTile.id,
                                    playerId: players[playerIndex!]?.id,
                                    log: msg,
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
            <div className="absolute bottom-4 right-4 w-64 bg-white shadow-lg rounded-lg p-3 h-165 overflow-y-auto">
                <h2 className="text-lg font-semibold mb-2">Players</h2>
                <ul className="space-y-1 max-h-[calc(6*3rem)] overflow-y-auto">
                    {players.map((player, index) => (
                        <li
                            key={player.id || index}
                            className="py-1 px-2 bg-gray-100 rounded"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: player.color }}
                                ></div>
                                <div className="font-semibold text-sm truncate">
                                    {player.name}
                                </div>
                            </div>
                            <div className="text-xs text-gray-600 flex flex-wrap gap-2">
                                <span>
                                    Cards:{' '}
                                    {Object.values(player.resources).reduce(
                                        (a, c) => a + c,
                                        0
                                    )}
                                </span>
                                <span>Dev: {player.devCards.length}</span>
                                <span>
                                    Longest Road: {player.longestRoad || 0}
                                </span>
                                <span>
                                    Robber Used: {player.robberUsed || 0}
                                </span>
                                <span>Points: {player.points || 0}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* RESOURCES*/}
            {players[playerIndex ?? 0] &&
                players[playerIndex ?? 0].resources && (
                    <div className="absolute bottom-4 left-10 flex flex-col gap-2 bg-white shadow-md rounded-lg p-3 z-20">
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
                                        const newResources = {
                                            ...players[playerIndex!].resources,
                                            [resource]:
                                                (players[playerIndex!]
                                                    .resources[resource] || 0) +
                                                1,
                                        }
                                        setPlayers((prev) =>
                                            prev.map((p, i) =>
                                                i === playerIndex
                                                    ? {
                                                          ...p,
                                                          resources:
                                                              newResources,
                                                      }
                                                    : p
                                            )
                                        )
                                        const msg = `${
                                            players[playerIndex!].name
                                        } gained 1 ${resource}`
                                        setLogs((prev) => [...prev, msg])
                                        socket.emit('resourceLog', msg)
                                        socket.emit('updateResources', {
                                            roomCode,
                                            playerId: players[playerIndex!].id,
                                            resources: newResources,
                                        })
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
                                        const newResources = {
                                            ...players[playerIndex!].resources,
                                            [resource]: Math.max(
                                                0,
                                                (players[playerIndex!]
                                                    .resources[resource] || 0) -
                                                    1
                                            ),
                                        }
                                        setPlayers((prev) =>
                                            prev.map((p, i) =>
                                                i === playerIndex
                                                    ? {
                                                          ...p,
                                                          resources:
                                                              newResources,
                                                      }
                                                    : p
                                            )
                                        )
                                        const msg = `${
                                            players[playerIndex!].name
                                        } lost 1 ${resource}`
                                        setLogs((prev) => [...prev, msg])
                                        socket.emit('resourceLog', msg)
                                        socket.emit('updateResources', {
                                            roomCode,
                                            playerId: players[playerIndex!].id,
                                            resources: newResources,
                                        })
                                    }}
                                >
                                    –
                                </button>
                            </div>
                        ))}
                    </div>
                )}

            {players[playerIndex!]?.devCards?.length > 0 && (
                <div className="absolute top-89 left-80 -translate-x-1/2 bg-white shadow rounded p-3 z-30 text-sm w-64 max-h-64 overflow-y-auto text-sm">
                    <div className="font-bold mb-2">Your Dev Cards</div>
                    {Object.entries(
                        players[playerIndex!]?.devCards.reduce(
                            (acc: Record<string, number>, card) => {
                                if (!card.used) {
                                    acc[card.type] = (acc[card.type] || 0) + 1
                                }
                                return acc
                            },
                            {}
                        )
                    ).map(([type, count]) => (
                        <div
                            key={type}
                            className="flex items-center justify-between mb-2"
                        >
                            <span>
                                {type === 'point' && 'Free Point'}
                                {type === 'robber' && 'Move Robber & Steal'}
                                {type === 'road' && '2 Free Roads'}: {count}
                            </span>
                            <button
                                className="bg-purple-400 hover:bg-purple-500 text-white px-2 py-1 rounded text-sm ml-3"
                                onClick={() => {
                                    const idx = players[
                                        playerIndex!
                                    ]?.devCards.findIndex(
                                        (c) => c.type === type && !c.used
                                    )
                                    if (idx !== -1) {
                                        setDevCardEffect(
                                            players[playerIndex!]?.devCards[idx]
                                        )
                                        setUsedCardIndex(idx)
                                    }
                                }}
                            >
                                Use
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="absolute bottom-4 left-48 z-50 flex flex-col space-y-1 bg-white/80 p-2 rounded shadow text-[10px]">
                {/* POINTS */}
                <div className="flex items-center space-x-2">
                    <span className="w-28">Points</span>
                    <button
                        className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
                        onClick={() => {
                            const currentPoints =
                                players[playerIndex!]?.points || 0
                            socket.emit('updatePoints', {
                                roomCode,
                                playerId: players[playerIndex!]?.id,
                                points: currentPoints + 1,
                            })
                        }}
                    >
                        +1
                    </button>
                    <button
                        className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
                        onClick={() => {
                            const currentPoints =
                                players[playerIndex!]?.points || 0
                            socket.emit('updatePoints', {
                                roomCode,
                                playerId: players[playerIndex!]?.id,
                                points: Math.max(currentPoints - 1, 0),
                            })
                        }}
                    >
                        -1
                    </button>
                </div>

                {/* LONGEST ROAD */}
                <div className="flex items-center space-x-2">
                    <span className="w-28">Longest Road</span>
                    <button
                        className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
                        onClick={() => {
                            const currentRoad =
                                players[playerIndex!]?.longestRoad || 0
                            socket.emit('updateLongestRoad', {
                                roomCode,
                                playerId: players[playerIndex!]?.id,
                                longestRoad: currentRoad + 1,
                            })
                        }}
                    >
                        +1
                    </button>
                    <button
                        className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
                        onClick={() => {
                            const currentRoad =
                                players[playerIndex!]?.longestRoad || 0
                            socket.emit('updateLongestRoad', {
                                roomCode,
                                playerId: players[playerIndex!]?.id,
                                longestRoad: Math.max(currentRoad - 1, 0),
                            })
                        }}
                    >
                        -1
                    </button>
                </div>

                {/* ROBBER USED */}
                <div className="flex items-center space-x-2">
                    <span className="w-28">Robber Used</span>
                    <button
                        className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
                        onClick={() => {
                            const currentRobber =
                                players[playerIndex!]?.robberUsed || 0
                            socket.emit('updateRobberUsed', {
                                roomCode,
                                playerId: players[playerIndex!]?.id,
                                robberUsed: currentRobber + 1,
                            })
                        }}
                    >
                        +1
                    </button>
                    <button
                        className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
                        onClick={() => {
                            const currentRobber =
                                players[playerIndex!]?.robberUsed || 0
                            socket.emit('updateRobberUsed', {
                                roomCode,
                                playerId: players[playerIndex!]?.id,
                                robberUsed: Math.max(currentRobber - 1, 0),
                            })
                        }}
                    >
                        -1
                    </button>
                </div>
            </div>

            {/* LOGS */}
            <div className="absolute top-20 left-10 w-80 bg-white shadow-lg rounded-lg p-4 z-30">
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
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-1 bg-white shadow-md rounded-md p-2 text-xs max-w-md">
                {Object.entries(actionHandlers).map(([action, handler]) => (
                    <button
                        key={action}
                        className={`bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-1 px-2 rounded shadow
                ${!isMyTurn ? 'opacity-50 cursor-not-allowed' : ''}
            `}
                        onClick={isMyTurn ? handler : undefined}
                        disabled={!isMyTurn}
                    >
                        {action}
                    </button>
                ))}
                <button
                    className={`bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-2 rounded shadow
            ${!isMyTurn ? 'opacity-50 cursor-not-allowed' : ''}
        `}
                    onClick={
                        isMyTurn ? () => setIsPlacingRobber(true) : undefined
                    }
                    disabled={!isMyTurn}
                >
                    Place Robber
                </button>
            </div>
            {/* Dice Panel - Above Shop, Left of Player Tab */}
            <div className="absolute bottom-6 right-72 flex flex-col items-center gap-2">
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
            {/* <img
                src={'/images/shop/shop.png'}
                alt="Shop Cost"
                className="absolute top-23 left-4 w-56 h-64 object-contain"
            /> */}
            {showTradeUI && (
                <div className="absolute inset-0 backdrop-blur-sm bg-white/30 flex justify-center items-center z-50">
                    <div className="bg-white p-8 rounded-lg shadow-lg w-[700px] flex flex-col gap-6">
                        <h2 className="text-xl font-bold mb-4 text-center">
                            Trade
                        </h2>
                        <div className="flex gap-12 justify-center">
                            {/* Trade Out (Give) */}
                            <div>
                                <div className="font-semibold mb-2 text-center">
                                    You Give
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
                                        className="flex items-center gap-2 mb-2"
                                    >
                                        <img
                                            src={`/images/cards/${resource}.svg`}
                                            alt={resource}
                                            className="w-8 h-12"
                                        />
                                        <input
                                            type="number"
                                            min={0}
                                            className="w-16 px-2 py-1 border rounded text-center"
                                            value={tradeOut[resource] ?? ''}
                                            onChange={(e) => {
                                                const val = Math.max(
                                                    0,
                                                    Number(e.target.value)
                                                )
                                                setTradeOut((prev) => ({
                                                    ...prev,
                                                    [resource]: val,
                                                }))
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                            {/* Trade In (Receive) */}
                            <div>
                                <div className="font-semibold mb-2 text-center">
                                    You Get
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
                                        className="flex items-center gap-2 mb-2"
                                    >
                                        <img
                                            src={`/images/cards/${resource}.svg`}
                                            alt={resource}
                                            className="w-8 h-12"
                                        />
                                        <input
                                            type="number"
                                            min={0}
                                            className="w-16 px-2 py-1 border rounded text-center"
                                            value={tradeIn[resource] ?? ''}
                                            onChange={(e) => {
                                                const val = Math.max(
                                                    0,
                                                    Number(e.target.value)
                                                )
                                                setTradeIn((prev) => ({
                                                    ...prev,
                                                    [resource]: val,
                                                }))
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                className="bg-gray-300 px-4 py-2 rounded"
                                onClick={() => setShowTradeUI(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="bg-blue-500 text-white px-4 py-2 rounded"
                                onClick={() => {
                                    // Build trade summary string
                                    const give = Object.entries(tradeOut)
                                        .filter(([, v]) => v && v > 0)
                                        .map(([r, v]) => `${v} ${r}`)
                                        .join(', ')
                                    const get = Object.entries(tradeIn)
                                        .filter(([, v]) => v && v > 0)
                                        .map(([r, v]) => `${v} ${r}`)
                                        .join(', ')
                                    const msg = `${
                                        players[playerIndex!]?.name
                                    } wants to trade: Give [${
                                        give || 'none'
                                    }] for [${get || 'none'}]`
                                    setLogs((prev) => [...prev, msg])
                                    socket.emit('resourceLog', msg)
                                    setShowTradeUI(false)
                                    setTradeOut({})
                                    setTradeIn({})
                                }}
                            >
                                Confirm Trade
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CatanGamePage
