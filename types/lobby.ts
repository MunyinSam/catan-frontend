export interface Player {
    id: string
    name: string
    color: string

    resources: {
        wood: number
        brick: number
        wheat: number
        sheep: number
        ore: number
    }

    devCards: { type: 'point' | 'robber' | 'road'; used?: boolean }[]
    newDevCards: string[] // bought this turn

    playedDevCard: boolean

    points: number
    knightsPlayed: number
    hasLongestRoad: boolean
    hasLargestArmy: boolean

    longestRoad: number
    robberUsed: number

    invRoad: number
    invSettlement: number
    invCity: number

    buildings: Building[] // List of roads/houses/mansions with positions
    isMyTurn: boolean

    isReady: boolean
}

export type BuildingType = 'road' | 'settlement' | 'city'

export interface Building {
    type: BuildingType
    position: number[] // [q, r, cornerIndex] or edge
    connectedTo?: number[][] // For roads (from → to)
}

export interface Room {
    players: Player[]
    // add more room properties as needed, e.g.:
    gameState?: any
    createdAt?: number
    // etc.
}
