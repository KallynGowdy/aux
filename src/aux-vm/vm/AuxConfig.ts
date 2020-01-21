import { AuxPartitionConfig } from '../partitions/AuxPartitionConfig';
import { FormulaLibraryOptions } from '@casual-simulation/aux-common';

/**
 * Defines the possible configuration options for a simulation.
 */
export interface AuxConfig {
    config: AuxConfigParameters;

    /**
     * Defines the partitioning structure for bots.
     */
    partitions: AuxPartitionConfig;
}

export interface AuxConfigParameters {
    isBuilder: boolean;
    isPlayer: boolean;
    version: string;
    versionHash: string;
}

/**
 * Creates a set of formula library options for the given aux config.
 * @param config The config.
 */
export function buildFormulaLibraryOptions(
    config: AuxConfigParameters
): FormulaLibraryOptions {
    if (!config) {
        return null;
    }
    return {
        config: {
            isBuilder: config.isBuilder,
            isPlayer: config.isPlayer,
        },
        version: {
            hash: config.versionHash,
            ...parseVersionNumber(config.version),
        },
    };
}

/**
 * Parses the given version number.
 * @param version The version number.
 */
export function parseVersionNumber(version: string) {
    if (!version) {
        return {
            version: null,
            major: null,
            minor: null,
            patch: null,
        };
    }
    const versionRegex = /^v(\d+)\.(\d+)\.(\d+)$/i;
    const [str, major, minor, patch] = versionRegex.exec(version);

    return {
        version: str,
        major: parseInt(major),
        minor: parseInt(minor),
        patch: parseInt(patch),
    };
}
