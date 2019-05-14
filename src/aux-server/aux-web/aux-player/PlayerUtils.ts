import {
    AuxFile,
    FileCalculationContext,
    calculateFileValue,
    getFileConfigContexts,
    AsyncCalculationContext,
} from '@casual-simulation/aux-common';

interface PlayerContextSearchResult {
    /**
     * Is there a matching player context?
     */
    matchFound: boolean;

    /**
     * All player contexts found during the search.
     */
    playerContexts: string[];
}

export async function doesFileDefinePlayerContext(
    file: AuxFile,
    context: string,
    calc: AsyncCalculationContext
): Promise<PlayerContextSearchResult> {
    const contexts = await calc.getFileConfigContexts(file);
    return {
        playerContexts: contexts,
        matchFound: contexts.indexOf(context) >= 0,
    };
}
