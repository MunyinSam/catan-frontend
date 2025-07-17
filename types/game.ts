export type MaterialType = 'wood' | 'brick' | 'wheat' | 'sheep' | 'ore' | 'desert'

export interface HexTile {
    id: number
    materialType: MaterialType
    rollNumber: number | null
    x: number
    y: number
}

export type ResourceType = 'brick' | 'wood' | 'ore' | 'wheat' | 'sheep'
export type Port = {
  x: number
  y: number
  ratio: '2:1' | '3:1'
  resource: ResourceType | null
}

export type Road = {
    start: { x: number; y: number }
    end: { x: number; y: number }
    ownerId: string
}

export type Settlement = {
    position: { x: number; y: number }
    ownerId: string
}

export type City = {
    position: { x: number; y: number }
    ownerId: string
}