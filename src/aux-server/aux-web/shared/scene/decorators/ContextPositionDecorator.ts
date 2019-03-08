import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { calculateNumericalTagValue, FileCalculationContext, File, calculateGridScale, file, objectsAtWorkspaceGridPosition, getFilePosition, getFileIndex } from "@yeti-cgi/aux-common";
import { Vector3 } from "three";
import { calculateGridTileLocalCenter } from "../grid/Grid";
import { objectsAtGridPosition } from "../SceneUtils";
import { sumBy } from "lodash";
import { ContextGroup3D } from "../ContextGroup3D";

export class ContextPositionDecorator implements AuxFile3DDecorator {
    
    fileUpdated(file3D: AuxFile3D, calc: FileCalculationContext): void {
        const userContext = file3D.context;
        if (userContext) {
            const scale = calculateGridScale(calc, file3D.contextGroup.file, file3D.domain);
            const localPosition = calculateObjectPositionInContext(calc, file3D, scale);
            file3D.position.set(localPosition.x, localPosition.y, localPosition.z);
            
            // We must call this function so that child objects get their positions updated too.
            // Three render function does this automatically but there are functions in here that depend
            // on accurate positioning of child objects.
            file3D.updateMatrixWorld(true);
        }
    }

    frameUpdate(): void {
    }

    dispose(): void {
    }
}

/**
 * Calculates the position of the file and returns it.
 * @param file The file.
 * @param scale The workspace scale. Usually calculated from the workspace scale.
 */
// export function calculateObjectPositionOnWorkspace(context: FileCalculationContext, file: File, scale: number): Vector3 {
    
    
//     const objectsAtPosition = objectsAtWorkspaceGridPosition(context.objects, file.tags._workspace, file.tags._position);
//     const sortedByIndex = sortBy(objectsAtPosition, o => o.tags._index || 0);
//     const index = file.tags._index || 0;
//     const objectsBelowThis = sortedByIndex.slice(0, index);
//     const totalScales = sumBy(objectsBelowThis, obj => calculateNumericalTagValue(context, obj, 'scale.z', 1));

//     const indexOffset = new Vector3(0, totalScales * scale, 0);
//     localPosition.add(indexOffset);
//     return localPosition;
// }

/**
 * 
 * @param context The file calculation context to use to calculate forumula values.
 * @param file The file to calculate position for.
 * @param contextId The id of the context we want to get positional data for the given file.
 */
export function calculateObjectPositionInContext(context: FileCalculationContext, file: AuxFile3D, scale: number): Vector3 {
    const position = getFilePosition(context, file.file, file.context);
    const objectsAtPosition = objectsAtGridPosition(context, file.contextGroup, position);
    
    const index = getFileIndex(context, file.file, file.context);
    const objectsBelowThis = objectsAtPosition.slice(0, index);
    const totalScales = sumBy(objectsBelowThis, obj => calculateNumericalTagValue(context, obj.file, 'scale.z', 1));
    const indexOffset = new Vector3(0, totalScales * scale, 0);
    
    let localPosition = calculateGridTileLocalCenter(
        position.x,
        position.y,
        position.z,
        scale);

    localPosition.add(indexOffset);
    return localPosition;
}