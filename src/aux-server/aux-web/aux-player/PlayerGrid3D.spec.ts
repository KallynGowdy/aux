import {
    PlayerGrid3D,
    calculateTileCornerPoints,
    calculateGridTilePoints,
    calculateGridTileLocalCenter,
} from './PlayerGrid3D';
import { Vector3, Vector2 } from 'three';

describe('PlayerGrid', () => {
    const testScales = [
        1,
        2,
        3,
        -1,
        -2,
        -3,
        0.5,
        -0.5,
        -5,
        5,
        100,
        -100,
        -1002.3,
        1002.3,
    ];

    const testTiles = [
        [0, 0],
        [0, 1],
        [1, 1],
        [-1, 1],
        [2, 2],
        [-2, -2],
        [2, 3],
        [5, 5],
        [100, 100],
        [200, -200],
        [1000, 5000],
        [-3000, -1500],
    ];

    // Construct test table for tests that need both scale and tiles to test with.
    let testTable: any[] = [];
    for (let i = 0; i < testScales.length; i++) {
        for (let k = 0; k < testTiles.length; k++) {
            testTable.push([testScales[i], testTiles[k][0], testTiles[k][1]]);
        }
    }

    describe('helper functions', () => {
        describe('calculateTileCornerPoints() should return expected local points for the given tile scales:', () => {
            it.each(testScales)('scale: %d', scale => {
                let points = calculateTileCornerPoints(scale);

                // Should have 4 points.
                expect(points.length).toEqual(4);
                // topLeft (-0.5, 0.5)
                expect(points[0]).toEqual(
                    new Vector3(-0.5 * scale, 0, 0.5 * scale)
                );
                // topRight (0.5, 0.5)
                expect(points[1]).toEqual(
                    new Vector3(0.5 * scale, 0, 0.5 * scale)
                );
                // bottomRight (0.5, -0.5)
                expect(points[2]).toEqual(
                    new Vector3(0.5 * scale, 0, -0.5 * scale)
                );
                // bottomLeft (-0.5, -0.5)
                expect(points[3]).toEqual(
                    new Vector3(-0.5 * scale, 0, -0.5 * scale)
                );
            });
        });

        describe('calculateGridTileLocalCenter() should return expected center position for the given tile scale and coordinates:', () => {
            it.each(testTable)('scale: %d, tile: (%d, %d)', (scale, x, y) => {
                let center = calculateGridTileLocalCenter(x, y, scale);
                expect(center).toEqual(new Vector3(x * scale, 0, y * scale));
            });
        });

        describe('calculateGridTile() should return expected center position and corner points for give tile scale and coordinates:', () => {
            it.each(testTable)('scale: %d, tile: (%d, %d)', (scale, x, y) => {
                let tile = calculateGridTilePoints(x, y, scale);

                expect(tile.center).toEqual(
                    new Vector3(x * scale, 0, y * scale)
                );
                // Should have 4 points.
                expect(tile.corners.length).toEqual(4);
                // topLeft (-0.5, 0.5)
                expect(tile.corners[0]).toEqual(
                    new Vector3(
                        tile.center.x + -0.5 * scale,
                        0,
                        tile.center.z + 0.5 * scale
                    )
                );
                // topRight (0.5, 0.5)
                expect(tile.corners[1]).toEqual(
                    new Vector3(
                        tile.center.x + 0.5 * scale,
                        0,
                        tile.center.z + 0.5 * scale
                    )
                );
                // bottomRight (0.5, -0.5)
                expect(tile.corners[2]).toEqual(
                    new Vector3(
                        tile.center.x + 0.5 * scale,
                        0,
                        tile.center.z + -0.5 * scale
                    )
                );
                // bottomLeft (-0.5, -0.5)
                expect(tile.corners[3]).toEqual(
                    new Vector3(
                        tile.center.x + -0.5 * scale,
                        0,
                        tile.center.z + -0.5 * scale
                    )
                );
            });
        });
    });

    describe('class instance', () => {
        it('should construct with default parameters', () => {
            let grid = new PlayerGrid3D();
            expect(grid.tileScale).toEqual(1);
        });

        it('should construct with custom parameters', () => {
            let grid = new PlayerGrid3D(2);
            expect(grid.tileScale).toEqual(2);
        });

        describe("getTileFromPosition() should return given tile for points generated inside the given tile's boundries:", () => {
            it.each(testTable)('scale: %d, tile: (%d, %d)', (scale, x, y) => {
                let grid = new PlayerGrid3D(scale);
                let tile = calculateGridTilePoints(x, y, scale);

                for (let i = 0; i < tile.corners.length; i++) {
                    // Pull the tile's corner points in just a little bit so that this test does not conflict with neigboring tiles.
                    // Real world use we wont care which tile we return if the point is directly between to tiles, but for this test we want to get expected results.
                    let dir = tile.center.clone().sub(tile.corners[i]);
                    let point = tile.corners[i]
                        .clone()
                        .add(dir.clone().multiplyScalar(0.01));
                    let tileFromPos = grid.getTileFromPosition(point);

                    expect(tileFromPos.tileCoordinate.x).toBe(x);
                    expect(tileFromPos.tileCoordinate.y).toBe(y);
                }
            });
        });

        describe('getTileFromCoordinate() should return expected tile position given the grid scale and tile coordinate:', () => {
            it.each(testTable)('scale: %d, tile: (%d, %d)', (scale, x, y) => {
                let grid = new PlayerGrid3D(scale);
                let gridTile = grid.getTileFromCoordinate(x, y);

                expect(gridTile.tileCoordinate).toEqual(new Vector2(x, y));
                expect(gridTile.center).toEqual(
                    new Vector3(x * scale, 0, y * scale)
                );
            });
        });
    });
});
