import { parseUri } from './CasualOSFileSystemProvider';

describe('parseUri()', () => {
    it('should return a null bot ID and tag when the URI has the wrong scheme', () => {
        const { botId, tag } = parseUri(uri('wrong', '/uuid/tag'));

        expect(botId).toBe(null);
        expect(tag).toBe(null);
    });

    it('should return a null bot ID and tag when the URI does not have a bot or tag', () => {
        const { botId, tag } = parseUri(uri('casualos', '/'));

        expect(botId).toBe(null);
        expect(tag).toBe(null);
    });

    it('should return a the bot ID in the URI', () => {
        const { botId, tag } = parseUri(uri('casualos', '/uuid'));

        expect(botId).toBe('uuid');
        expect(tag).toBe(null);
    });

    it('should return a the bot ID and tag in the URI', () => {
        const { botId, tag } = parseUri(uri('casualos', '/uuid/tag'));

        expect(botId).toBe('uuid');
        expect(tag).toBe('tag');
    });
});

function uri(scheme: string, path: string) {
    return {
        scheme,
        path,
        authority: '',
        fragment: '',
        query: '',
        fsPath: null as any,
        toJSON: null as any,
        toString: null as any,
        with: null as any,
    } as const;
}
