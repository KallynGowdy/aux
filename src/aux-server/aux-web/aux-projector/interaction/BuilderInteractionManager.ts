import {
    Vector2,
    Vector3,
    Intersection,
    Raycaster,
    Object3D,
    Ray,
    Camera,
} from 'three';
import {
    ContextMenuEvent,
    ContextMenuAction,
} from '../../shared/interaction/ContextMenuEvent';
import {
    File,
    Workspace,
    DEFAULT_WORKSPACE_HEIGHT_INCREMENT,
    DEFAULT_WORKSPACE_MIN_HEIGHT,
    DEFAULT_USER_MODE,
    UserMode,
    DEFAULT_WORKSPACE_HEIGHT,
    objectsAtWorkspace,
    isMinimized,
    FileCalculationContext,
    getContextMinimized,
    getBuilderContextGrid,
    getContextSize,
    getContextScale,
    getContextDefaultHeight,
    getContextColor,
    createFile,
    isContext,
    getFileConfigContexts,
    filesInContext,
    AuxObject,
    toast,
    PartialFile,
} from '@casual-simulation/aux-common';
import { BuilderFileClickOperation } from '../../aux-projector/interaction/ClickOperation/BuilderFileClickOperation';
import { Physics } from '../../shared/scene/Physics';
import { flatMap, minBy, keys, uniqBy } from 'lodash';
import {
    Axial,
    realPosToGridPos,
    gridDistance,
    keyToPos,
    posToKey,
} from '../../shared/scene/hex';
import { Input } from '../../shared/scene/Input';
import { ColorPickerEvent } from '../../aux-projector/interaction/ColorPickerEvent';
import { EventBus } from '../../shared/EventBus';
import { IOperation } from '../../shared/interaction/IOperation';
import { BuilderEmptyClickOperation } from '../../aux-projector/interaction/ClickOperation/BuilderEmptyClickOperation';
import { BuilderNewFileClickOperation } from '../../aux-projector/interaction/ClickOperation/BuilderNewFileClickOperation';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import { BuilderGroup3D } from '../../shared/scene/BuilderGroup3D';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import GameView from '../GameView/GameView';
import { GameObject } from '../../shared/scene/GameObject';
import MiniFile from '../MiniFile/MiniFile';
import FileTag from '../FileTag/FileTag';
import FileTable from '../FileTable/FileTable';
import { appManager } from '../../shared/AppManager';
import { AsyncSimulation } from '@casual-simulation/aux-vm';
import { Simulation3D } from 'aux-web/shared/scene/Simulation3D';

export class BuilderInteractionManager extends BaseInteractionManager {
    // This overrides the base class IGameView
    protected _gameView: GameView;

    private _surfaceColliders: Object3D[];
    private _surfaceObjectsDirty: boolean;

    mode: UserMode = DEFAULT_USER_MODE;

    constructor(gameView: GameView) {
        super(gameView);
        this._surfaceObjectsDirty = true;
    }

    createGameObjectClickOperation(
        gameObject: GameObject,
        hit: Intersection
    ): IOperation {
        if (
            gameObject instanceof AuxFile3D ||
            gameObject instanceof ContextGroup3D
        ) {
            let fileClickOp = new BuilderFileClickOperation(
                this._gameView.simulation3D,
                this,
                gameObject,
                hit
            );
            return fileClickOp;
        } else {
            return null;
        }
    }

    createEmptyClickOperation(): IOperation {
        let emptyClickOp = new BuilderEmptyClickOperation(this._gameView, this);
        return emptyClickOp;
    }

    createHtmlElementClickOperation(element: HTMLElement): IOperation {
        const vueElement: any = Input.getVueParent(element);
        if (vueElement instanceof MiniFile) {
            const file = <File>vueElement.file;
            this._gameView.simulation3D.selectRecentFile(file);
            let newFileClickOp = new BuilderNewFileClickOperation(
                this._gameView.simulation3D,
                this,
                file
            );
            return newFileClickOp;
        } else if (vueElement instanceof FileTag && vueElement.allowCloning) {
            const tag = vueElement.tag;
            const table = vueElement.$parent;
            if (table instanceof FileTable) {
                if (
                    table.selectionMode === 'single' &&
                    table.files.length === 1
                ) {
                    const file = table.files[0];
                    const newFile = createFile(file.id, {
                        [tag]: file.tags[tag],
                        'aux._diff': true,
                        'aux._diffTags': [tag],
                    });
                    return new BuilderNewFileClickOperation(
                        this._gameView.simulation3D,
                        this,
                        newFile
                    );
                } else {
                    console.log('not valid');
                }
            } else {
                console.log('Not table');
            }
        }

        return null;
    }

    findGameObjectObjectForHit(hit: Intersection): GameObject {
        if (!hit) {
            return null;
        }

        let obj = this.findGameObjectUpHierarchy(hit.object);

        if (obj) {
            return obj;
        } else {
            return this.findWorkspaceForIntersection(hit);
        }
    }

    findWorkspaceForIntersection(hit: Intersection): BuilderGroup3D {
        if (!hit) {
            return null;
        }

        return this.findWorkspaceForMesh(hit.object);
    }

    findWorkspaceForMesh(mesh: Object3D): BuilderGroup3D {
        if (!mesh) {
            return null;
        }

        if (mesh instanceof BuilderGroup3D) {
            return mesh;
        } else if (mesh instanceof AuxFile3D) {
            return <BuilderGroup3D>mesh.contextGroup;
        } else {
            return this.findWorkspaceForMesh(mesh.parent);
        }
    }

    async canShrinkWorkspace(file: ContextGroup3D) {
        if (!file) {
            return false;
        }
        const size = await file.simulation.simulation.getContextSize(file.file);
        if (size > 1) {
            return true;
        }

        return false;
    }

    /**
     * Determines if we're in the correct mode to manipulate the given file.
     * @param file The file.
     */
    isInCorrectMode(file: AuxFile3D | ContextGroup3D) {
        if (!file) {
            return true;
        }
        if (file instanceof ContextGroup3D) {
            return this.mode === 'worksurfaces';
        } else {
            return this.mode === 'files';
        }
    }

    /**
     * Determines if we're currently in worksurfaces mode.
     */
    isInWorksurfacesMode() {
        return this.mode === 'worksurfaces';
    }

    /**
     * Raises the tile at the given point by the given amount.
     * @param file The file.
     * @param position The tile position.
     * @param height The new height.
     */
    async updateTileHeightAtGridPosition(file: ContextGroup3D, height: number) {
        let partial: PartialFile = {
            tags: {
                [`aux.context.grid`]: {},
            },
        };

        partial.tags[`aux.context.grid`]['0:0'] = {
            height: height,
        };

        await this._gameView.simulation3D.simulation.updateFile(
            file.file,
            partial
        );
    }

    handlePointerEnter(file: File, simulation: AsyncSimulation): IOperation {
        return null;
    }

    handlePointerExit(file: File, simulation: AsyncSimulation): IOperation {
        return null;
    }

    handlePointerDown(file: File, simulation: AsyncSimulation): IOperation {
        return null;
    }

    /**
     * Calculates the grid location and workspace that the given ray intersects with.
     * @param ray The ray to test.
     */
    async pointOnWorkspaceGrid(screenPos: Vector2, camera: Camera) {
        let raycaster = new Raycaster();
        raycaster.setFromCamera(screenPos, camera);
        const workspaces = this.getSurfaceObjects();
        const hits = raycaster.intersectObjects(workspaces, true);
        const hit = hits[0];
        if (hit) {
            const point = hit.point;
            const workspace = this.findWorkspaceForIntersection(hit);
            if (
                workspace &&
                workspace.contexts.size > 0 &&
                !(await workspace.simulation.simulation.isMinimized(
                    workspace.file
                ))
            ) {
                const workspaceMesh = workspace.surface;
                const closest = workspaceMesh.closestTileToPoint(point);

                if (closest) {
                    return {
                        good: true,
                        gridPosition: closest.tile.gridPosition,
                        workspace,
                    };
                }
            }
        }
        return {
            good: false,
        };
    }

    /**
     * Gets the first context that the given workspace has.
     */
    firstContextInWorkspace(workspace: ContextGroup3D): string {
        const contexts = [...workspace.contexts.keys()];
        if (contexts.length > 0) {
            return contexts[0];
        }
        return null;
    }

    isFile(hit: Intersection): boolean {
        return this.findWorkspaceForIntersection(hit) === null;
    }

    getSurfaceObjects() {
        if (this._surfaceObjectsDirty) {
            this._surfaceColliders = flatMap(
                (<GameView>this._gameView)
                    .getContexts()
                    .filter(f => f.contexts.size > 0),
                (f: BuilderGroup3D) => f.surface.colliders
            );
            this._surfaceObjectsDirty = false;
        }
        return this._surfaceColliders;
    }

    protected async _contextMenuActions(
        simulation: Simulation3D,
        gameObject: GameObject,
        point: Vector3,
        pagePos: Vector2
    ): Promise<ContextMenuAction[]> {
        let actions: ContextMenuAction[] = [];

        if (gameObject) {
            if (
                gameObject instanceof ContextGroup3D &&
                gameObject.contexts.size > 0
            ) {
                const currentGrid = await simulation.simulation.getBuilderContextGrid(
                    gameObject.file
                );
                // TODO: Ensure these work right
                const defaultHeight = simulation.simulation.getContextDefaultHeight(
                    gameObject.file
                );
                let currentHeight =
                    (!!currentGrid
                        ? currentGrid['0:0'].height
                        : defaultHeight) || DEFAULT_WORKSPACE_HEIGHT;
                const increment = DEFAULT_WORKSPACE_HEIGHT_INCREMENT; // TODO: Replace with a configurable value.
                const minHeight = DEFAULT_WORKSPACE_MIN_HEIGHT; // TODO: This too
                const minimized = await simulation.simulation.isMinimized(
                    gameObject.file
                );

                //if (this.isInCorrectMode(gameObject)) {
                if (!minimized) {
                    actions.push({
                        label: 'Raise',
                        onClick: () =>
                            this.SetAllHexHeight(
                                gameObject,
                                currentHeight + increment
                            ),
                    });
                    if (currentHeight - increment >= minHeight) {
                        actions.push({
                            label: 'Lower',
                            onClick: () =>
                                this.SetAllHexHeight(
                                    gameObject,
                                    currentHeight - increment
                                ),
                        });
                    }

                    actions.push({
                        label: 'Expand',
                        onClick: () => this._expandWorkspace(gameObject),
                    });
                    if (await this.canShrinkWorkspace(gameObject)) {
                        actions.push({
                            label: 'Shrink',
                            onClick: () => this._shrinkWorkspace(gameObject),
                        });
                    }
                }
                //}

                const minimizedLabel = minimized ? 'Maximize' : 'Minimize';
                actions.push({
                    label: minimizedLabel,
                    onClick: () => this._toggleWorkspace(gameObject),
                });

                actions.push({
                    label: 'Copy',
                    onClick: () => this._copyWorkspace(gameObject),
                });

                actions.push({
                    label: 'Switch to Player',
                    onClick: () => this._switchToPlayer(gameObject),
                });
            }
        }

        return actions;
    }

    private async _shrinkWorkspace(file: ContextGroup3D) {
        if (file && file.contexts.size > 0) {
            const size = await file.simulation.simulation.getContextSize(
                file.file
            );
            await file.simulation.simulation.updateFile(file.file, {
                tags: {
                    [`aux.context.size`]: (size || 0) - 1,
                },
            });
        }
    }

    /**
     * On raise or lower, set all hexes in workspace to given height
     * @param file
     */
    private SetAllHexHeight(gameObject: ContextGroup3D, height: number) {
        if (gameObject instanceof BuilderGroup3D) {
            let tiles = gameObject.surface.hexGrid.hexes.map(
                hex => hex.gridPosition
            );

            this.updateTileHeightAtGridPosition(gameObject, height);
        }
    }

    /**
     * Minimizes or maximizes the given workspace.
     * @param file
     */
    private async _toggleWorkspace(file: ContextGroup3D) {
        if (file && file.contexts.size > 0) {
            const minimized = !(await file.simulation.simulation.isMinimized(
                file.file
            ));
            await file.simulation.simulation.updateFile(file.file, {
                tags: {
                    [`aux.context.minimized`]: minimized,
                },
            });
        }
    }

    /**
     * Copies all the files on the workspace to the given user's clipboard.
     * @param file
     */
    private async _copyWorkspace(file: ContextGroup3D) {
        if (file && file.contexts.size > 0) {
            const contexts = await file.simulation.simulation.getFileConfigContexts(
                file.file
            );
            let files: File[] = [];
            for (let i = 0; i < contexts.length; i++) {
                files.push(
                    ...(await file.simulation.simulation.filesInContext(
                        contexts[i]
                    ))
                );
            }
            const deduped = uniqBy(files, f => f.id);
            await appManager.copyFilesFromSimulation(
                file.simulation.simulation,
                <AuxObject[]>deduped
            );

            await file.simulation.simulation.transaction(
                toast('Worksurface Copied!')
            );
        }
    }

    private async _expandWorkspace(file: ContextGroup3D) {
        if (file) {
            const size = await file.simulation.simulation.getContextSize(
                file.file
            );
            await this._gameView.simulation3D.simulation.updateFile(file.file, {
                tags: {
                    [`aux.context.size`]: (size || 0) + 1,
                },
            });
        }
    }

    private _switchToPlayer(file: ContextGroup3D) {
        let contexts = [...file.contexts.keys()];
        let context = contexts[0];

        let url = `${appManager.config.playerBaseUrl}/`;

        // https://auxbuilder.com/
        //   ^     |     host    |     path           |
        // simulationId: ''
        const simulationId = window.location.pathname.split('/')[1];

        // open in same tab
        //window.location.assign(`${url}/${simulationId || 'default'}/${context}`);

        // open in new tab
        window.open(`${url}${simulationId || 'default'}/${context}`, '_blank');
    }

    protected _markDirty() {
        super._markDirty();
        this._surfaceObjectsDirty = true;
    }
}
