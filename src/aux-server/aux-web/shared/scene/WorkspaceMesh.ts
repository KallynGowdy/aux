import { Object3D, Vector3, Color } from 'three';
import { HexGridMesh, HexGrid, HexMesh, keyToPos, Axial } from './hex';
import { GridMesh } from './grid/GridMesh';
import {
    DEFAULT_WORKSPACE_HEIGHT,
    DEFAULT_WORKSPACE_SCALE,
    DEFAULT_WORKSPACE_GRID_SCALE,
    DEFAULT_MINI_WORKSPACE_SCALE,
    AuxDomain,
    calculateFileValue,
    getContextSize,
    getContextDefaultHeight,
    getContextScale,
    getBuilderContextGrid,
    getContextGridScale,
    isMinimized,
    isContext,
    getContextColor,
    isUserFile,
    DEFAULT_WORKSPACE_COLOR,
    hasValue,
    getContextGridHeight,
    AsyncCalculationContext,
} from '@casual-simulation/aux-common/Files';
import { keys, minBy, isEqual } from 'lodash';
import { GridChecker, GridCheckResults } from './grid/GridChecker';
import { GameObject } from './GameObject';
import { AuxFile } from '@casual-simulation/aux-common/aux-format';
import { idEquals } from '@casual-simulation/causal-trees';
import { disposeMesh } from './SceneUtils';

/**
 * Defines a mesh that represents a workspace.
 */
export class WorkspaceMesh extends GameObject {
    private _debugMesh: Object3D;
    private _debug: boolean;
    private _debugInfo: WorkspaceMeshDebugInfo;
    private _checker: GridChecker;

    /**
     * The hex grid for this workspace.
     */
    hexGrid: HexGridMesh;

    /**
     * The square grid for this workspace.
     */
    squareGrids: GridMesh[];

    /**
     * The workspace for this mesh.
     */
    workspace: AuxFile;

    /**
     * The container for everything on the workspace.
     */
    container: Object3D;

    /**
     * The mini hex that is shown when the mesh is in mini mode.
     */
    miniHex: HexMesh;

    /**
     * The domain that this mesh should look at.
     */
    domain: AuxDomain;

    /**
     * Sets the visibility of the grids on this workspace.
     */
    set gridsVisible(visible: boolean) {
        this.squareGrids.forEach(grid => {
            grid.visible = visible;
        });
    }

    /**
     * Sets the GridChecker that this workspace should use to update its valid
     * grid positions.
     */
    set gridGhecker(val: GridChecker) {
        this._checker = val;
    }

    /**
     * Creates a new WorkspaceMesh.
     */
    constructor(domain: AuxDomain) {
        super();
        this.squareGrids = [];
        this.container = new Object3D();
        this.domain = domain;
        this.miniHex = new HexMesh(
            new Axial(0, 0),
            DEFAULT_MINI_WORKSPACE_SCALE,
            DEFAULT_WORKSPACE_HEIGHT
        );
        this.miniHex.visible = false;
        this.add(this.container);
        this.add(this.miniHex);
        this._debugInfo = {
            id: this.id,
            gridCheckResults: null,
        };
    }

    /**
     * Sets whether this mesh should display debug information.
     * @param debug Whether the info should be shown.
     */
    showDebugInfo(debug: boolean) {
        this._debug = debug;
        // TODO: Fix sometime
        // this.update(undefined, true);
    }

    /**
     * Gets the most recent debug info from the workspace.
     */
    getDebugInfo() {
        return this._debugInfo;
    }

    /**
     * Calculates the GridTile that is the closest to the given world point.
     * @param point The world point to test.
     */
    closestTileToPoint(point: Vector3) {
        const tiles = this.squareGrids
            .map(g => g.closestTileToPoint(point))
            .filter(t => !!t);
        const closest = minBy(tiles, t => t.distance);
        return closest;
    }

    /**
     * Updates the mesh with the new workspace data and optionally updates the square grid using the given
     * grid checker.
     * @param calc The file calculation context.
     * @param workspace The new workspace data. If not provided the mesh will re-update using the existing data.
     * @param force Whether to force the workspace to update everything, even aspects that have not changed.
     */
    async update(
        calc: AsyncCalculationContext,
        workspace?: AuxFile,
        force?: boolean
    ) {
        if (!workspace) {
            return;
        }
        const prev = this.workspace;
        this.workspace = workspace || prev;

        this.visible = await calc.isContext(this.workspace);
        this.container.visible = !(await calc.isMinimized(this.workspace));
        this.miniHex.visible = !this.container.visible;

        let gridUpdate: GridCheckResults = this._debugInfo.gridCheckResults;

        if (this._gridChanged(this.workspace, prev, calc) || force) {
            this.updateHexGrid(calc);
            if (this._checker) {
                gridUpdate = await this.updateSquareGrids(this._checker, calc);

                if (this._debugMesh) {
                    this.remove(this._debugMesh);
                }
                if (this._debug) {
                    this._debugMesh = new Object3D();
                    this._debugMesh.add(
                        GridChecker.createVisualization(gridUpdate)
                    );
                    this.add(this._debugMesh);
                }
            }
        }

        // Hex color.
        const colorValue = await calc.getContextColor(this.workspace);
        const color: Color = hasValue(colorValue)
            ? new Color(colorValue)
            : new Color(DEFAULT_WORKSPACE_COLOR);
        const hexes = this.hexGrid.hexes;
        hexes.forEach(h => {
            h.color = color;
        });
        this.miniHex.color = color;

        this.updateMatrixWorld(false);

        if (this._debug) {
            this._debugInfo = {
                gridCheckResults: gridUpdate,
                id: this.id,
            };
        }
    }

    public frameUpdate() {}

    public dispose() {
        super.dispose();
    }

    /**
     * Updates the hex grid to match the workspace data.
     */
    public async updateHexGrid(calc: AsyncCalculationContext) {
        if (this.hexGrid) {
            this.hexGrid.dispose();
            this.container.remove(this.hexGrid);
        }

        const size = await calc.getContextSize(this.workspace);
        let centerHeight: number = await calc.getContextGridHeight(
            this.workspace,
            '0:0'
        );
        const defaultHeight = await calc.getContextDefaultHeight(
            this.workspace
        );
        const scale = await calc.getContextScale(this.workspace);
        this.hexGrid = HexGridMesh.createFilledInHexGrid(
            size,
            centerHeight || DEFAULT_WORKSPACE_HEIGHT,
            scale || DEFAULT_WORKSPACE_SCALE
        );

        // why does this not ge the out ring of hexes, they need to be updated
        const grid = await calc.getBuilderContextGrid(this.workspace);
        const positionsKeys = grid ? keys(grid) : [];
        positionsKeys.forEach(key => {
            const position = keyToPos(key);
            const workspaceHex = grid[key];

            if (grid['0:0'] != null) {
                centerHeight = grid['0:0'].height;
            }

            const hex = this.hexGrid.addAt(position);
            let nextHeight =
                centerHeight || defaultHeight || DEFAULT_WORKSPACE_HEIGHT;
            if (nextHeight < 0) {
                nextHeight = defaultHeight || DEFAULT_WORKSPACE_HEIGHT;
            }
            hex.height = nextHeight;
        });

        this.colliders = [...this.hexGrid.hexes, this.miniHex];
        this.container.add(this.hexGrid);
    }

    /**
     * Updates the square grid to match the workspace data.
     * @param checker The grid checker to use.
     */
    async updateSquareGrids(
        checker: GridChecker,
        calc: AsyncCalculationContext
    ) {
        if (this.squareGrids && this.squareGrids.length > 0) {
            this.squareGrids.forEach(g => g.dispose());
            this.container.remove(...this.squareGrids);
        }

        const gridScale = await calc.getContextGridScale(this.workspace);
        checker.tileRatio = gridScale || DEFAULT_WORKSPACE_GRID_SCALE;
        const results = await checker.check(this.hexGrid);
        const levels = results.levels;
        this.squareGrids = levels.map(l => new GridMesh(l));
        this.squareGrids.forEach(grid => (grid.visible = false));
        if (this.squareGrids && this.squareGrids.length > 0) {
            this.container.add(...this.squareGrids);
        }
        return results;
    }

    private async _gridChanged(
        current: AuxFile,
        previous: AuxFile,
        calc: AsyncCalculationContext
    ) {
        if (!previous) {
            return true;
        } else {
            const currentSize = await calc.getContextSize(current);
            const previousSize = await calc.getContextSize(previous);
            if (currentSize !== previousSize) {
                return true;
            } else {
                const currentGrid = await calc.getBuilderContextGrid(current);
                const previousGrid = await calc.getBuilderContextGrid(previous);

                return !isEqual(currentGrid, previousGrid);
            }
        }
    }
}

export interface WorkspaceMeshDebugInfo {
    id: number;
    gridCheckResults: GridCheckResults;
}
