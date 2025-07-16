import { socket } from '../lib/socket'
import { Player, Room } from '../types/lobby'
import { MaterialType, HexTile } from '../types/game'

export const getPolygonImage = (material: MaterialType) => {
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

